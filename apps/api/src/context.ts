import { createLogger, gauge } from "@harborwatch/telemetry";
import type {
  DeviceStatus,
  EnvironmentalTelemetry,
  SensorTelemetry,
} from "@harborwatch/contracts";
import { WebSocketServer, type WebSocket } from "ws";
import type { TokenUser } from "@harborwatch/auth";
import { SiteBoard } from "./board.ts";
import type { Config } from "./config.ts";
import { SENSORS, SITE_ID } from "./site.ts";
import type { DataStore } from "./store.ts";

export interface ClientSocket {
  socket: WebSocket;
  session: TokenUser;
  channels: Set<string>;
}

export interface AppContext {
  config: Config;
  store: DataStore;
  board: SiteBoard;
  sensors: Map<string, SensorTelemetry>;
  devices: Map<string, DeviceStatus>;
  environment: EnvironmentalTelemetry | null;
  lastIngestAt: number;
  logger: ReturnType<typeof createLogger>;
  clients: Set<ClientSocket>;
  wss?: WebSocketServer;
}

export function createContext(config: Config, store: DataStore): AppContext {
  const sensors = new Map<string, SensorTelemetry>();
  for (const sensor of SENSORS) {
    sensors.set(sensor.sensor_id, {
      sensor_id: sensor.sensor_id,
      site_id: SITE_ID,
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
  gauge("hw_track_board_size", 0);
  return {
    config,
    store,
    board: new SiteBoard({ staleMs: config.staleMs, expireMs: config.expireMs }),
    sensors,
    devices: new Map(),
    environment: null,
    lastIngestAt: 0,
    logger: createLogger("api", config.logLevel),
    clients: new Set(),
  };
}
