import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer } from "ws";
import { verifySession, type TokenUser } from "@harborwatch/auth";
import type { StreamEnvelope, TrackUpdate } from "@harborwatch/contracts";
import { gauge, inc } from "@harborwatch/telemetry";
import type { AppContext, ClientSocket } from "./context.ts";

export function broadcast(
  ctx: AppContext,
  channel: string,
  envelope: StreamEnvelope<unknown>,
  siteId: string,
): void {
  const text = JSON.stringify(envelope);
  for (const client of ctx.clients) {
    if (!client.channels.has(channel)) continue;
    if (!client.session.site_ids.includes(siteId)) continue;
    if (client.siteFilter && client.siteFilter !== siteId) continue;
    if (client.socket.readyState !== 1) continue;
    try {
      client.socket.send(text);
    } catch {
      inc("hw_ws_send_errors_total");
    }
  }
}

export function attachWebSockets(server: Server, ctx: AppContext): void {
  const wss = new WebSocketServer({ noServer: true });
  ctx.wss = wss;

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const channel = channelFromPath(url.pathname);
    if (!channel) {
      socket.destroy();
      return;
    }
    const session = sessionFromUpgrade(request, url, ctx.config.jwtSecret);
    if (!session) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      const preferredSite = session.site_ids[0] ?? null;
      const client: ClientSocket = {
        socket: ws,
        session,
        channels: new Set([channel]),
        siteFilter: preferredSite,
      };
      ctx.clients.add(client);
      gauge("hw_ws_clients", ctx.clients.size);
      ctx.logger.info({
        event: "ws.subscribe",
        service: "api",
        site_id: preferredSite ?? undefined,
        channel,
      });
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as {
            subscribe?: string[];
            site_id?: string;
          };
          if (Array.isArray(msg.subscribe)) {
            for (const name of msg.subscribe) client.channels.add(name);
          }
          if (typeof msg.site_id === "string" && client.session.site_ids.includes(msg.site_id)) {
            client.siteFilter = msg.site_id;
            if (client.channels.has("tracks")) {
              sendTrackSnapshot(ctx, client, msg.site_id);
            }
          }
        } catch {
          /* ignore malformed client frames */
        }
      });
      ws.on("close", () => {
        ctx.clients.delete(client);
        gauge("hw_ws_clients", ctx.clients.size);
      });
      if (channel === "tracks" && preferredSite) {
        sendTrackSnapshot(ctx, client, preferredSite);
      }
    });
  });
}

function sendTrackSnapshot(ctx: AppContext, client: ClientSocket, siteId: string): void {
  for (const track of ctx.board.snapshot(siteId)) {
    const envelope: StreamEnvelope<TrackUpdate> = {
      type: "track",
      schema: "harborwatch.track/1",
      site_id: track.site_id,
      seq: track.seq,
      sent_at: new Date().toISOString(),
      payload: track,
    };
    if (client.socket.readyState === 1) {
      client.socket.send(JSON.stringify(envelope));
    }
  }
}

function channelFromPath(pathname: string): string | null {
  if (pathname === "/ws/tracks") return "tracks";
  if (pathname === "/ws/telemetry") return "telemetry";
  if (pathname === "/ws/status") return "status";
  return null;
}

function sessionFromUpgrade(
  request: IncomingMessage,
  url: URL,
  secret: string,
): TokenUser | null {
  const header = request.headers.authorization;
  const token =
    (header?.startsWith("Bearer ") ? header.slice(7) : undefined) ??
    url.searchParams.get("token") ??
    "";
  if (!token) return null;
  try {
    return verifySession(token, secret);
  } catch {
    return null;
  }
}
