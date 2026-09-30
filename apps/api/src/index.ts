import { createServer } from "node:http";
import { gauge } from "@harborwatch/telemetry";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createContext } from "./context.ts";
import { broadcastExpired, checkOperationalAlerts } from "./ingest.ts";
import { openStore } from "./store.ts";
import { attachWebSockets } from "./ws.ts";

async function main(): Promise<void> {
  const config = loadConfig();
  const store = await openStore(config.databaseUrl);
  const ctx = createContext(config, store);
  const app = createApp(ctx);
  const server = createServer(app);
  attachWebSockets(server, ctx);

  setInterval(() => {
    const removed = ctx.board.expire();
    gauge("hw_track_board_size", ctx.board.size());
    if (removed.length) {
      const bySite = new Map<string, string[]>();
      for (const item of removed) {
        const list = bySite.get(item.site_id) ?? [];
        list.push(item.track_id);
        bySite.set(item.site_id, list);
      }
      for (const [siteId, trackIds] of bySite) {
        broadcastExpired(ctx, siteId, trackIds);
      }
      ctx.logger.debug({
        event: "track.expire",
        service: "api",
        count: removed.length,
      });
    }
    void checkOperationalAlerts(ctx);
  }, 2000).unref();

  setInterval(() => {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    void ctx.store.purgeHistory(cutoff);
  }, 60_000).unref();

  server.listen(config.port, () => {
    ctx.logger.info({
      event: "api.listen",
      service: "api",
      port: config.port,
      database: config.databaseUrl.startsWith("memory:") ? "memory" : "postgres",
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
