import { createLogger, gauge } from "@harborwatch/telemetry";
import type {
  DeviceStatus,
  EnvironmentalTelemetry,
  SensorTelemetry,
} from "@harborwatch/contracts";
import { WebSocketServer, type WebSocket } from "ws";
import type { TokenUser } from "@harborwatch/auth";
import { HarborBoards } from "./board.ts";
import type { Config } from "./config.ts";
import { RateLimiter } from "./rateLimit.ts";
import { SITE_CATALOG, SITE_IDS } from "./site.ts";
import type { DataStore } from "./store.ts";

export interface ClientSocket {
  socket: WebSocket;
  session: TokenUser;
  channels: Set<string>;
  siteFilter: string | null;
}

export interface AppContext {
  config: Config;
  store: DataStore;
  board: HarborBoards;
  sensors: Map<string, SensorTelemetry>;
  devices: Map<string, DeviceStatus>;
  environments: Map<string, EnvironmentalTelemetry>;
  lastIngestAt: number;
  lastIngestBySite: Map<string, number>;
  lastTrackWrite: Map<string, number>;
  lastHistoryWrite: Map<string, number>;
  loginLimiter: RateLimiter;
  ingestLimiter: RateLimiter;
  logger: ReturnType<typeof createLogger>;
  clients: Set<ClientSocket>;
  wss?: WebSocketServer;
}

export function createContext(config: Config, store: DataStore): AppContext {
  const sensors = new Map<string, SensorTelemetry>();
  for (const site of SITE_CATALOG) {
    for (const sensor of site.sensors) {
      sensors.set(sensor.sensor_id, {
        sensor_id: sensor.sensor_id,
        site_id: site.site_id,
        status: "operational",
        temperature_c: 11,
        humidity_percent: 76,
        visibility_meters: 8000,
        wind_speed_mps: 3.5,
        wind_direction: 200,
        battery_percent: 95,
        timestamp: new Date().toISOString(),
      });
    }
  }
  gauge("hw_track_board_size", 0);
  return {
    config,
    store,
    board: new HarborBoards({ staleMs: config.staleMs, expireMs: config.expireMs }, SITE_IDS),
    sensors,
    devices: new Map(),
    environments: new Map(),
    lastIngestAt: 0,
    lastIngestBySite: new Map(),
    lastTrackWrite: new Map(),
    lastHistoryWrite: new Map(),
    loginLimiter: new RateLimiter(20, 60_000),
    ingestLimiter: new RateLimiter(400, 1_000),
    logger: createLogger("api", config.logLevel),
    clients: new Set(),
  };
}
