import type {
  AlertEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
  StreamEnvelope,
  UserSession,
} from "@harborwatch/contracts";
import { api, wsUrl, type SensorRecord, type TrackRecord } from "./api";

export interface LayerState {
  objectTracks: boolean;
  trackHistory: boolean;
  sensors: boolean;
  environment: boolean;
  restrictedZones: boolean;
  devices: boolean;
}

export type SocketState = "idle" | "connecting" | "live" | "reconnect";

export interface OpsState {
  token: string | null;
  user: UserSession | null;
  tracks: Map<string, TrackRecord>;
  sensors: SensorRecord[];
  devices: DeviceStatus[];
  environment: EnvironmentalTelemetry | null;
  alerts: AlertEvent[];
  selectedId: string | null;
  layers: LayerState;
  socket: SocketState;
  siteName: string;
  history: Array<{ latitude: number; longitude: number; timestamp: string }>;
  error: string | null;
  chrome: "sidebar" | "drawer" | "sheet";
  panelOpen: boolean;
}

const defaultLayers: LayerState = {
  objectTracks: true,
  trackHistory: true,
  sensors: true,
  environment: false,
  restrictedZones: true,
  devices: true,
};

let state: OpsState = {
  token: sessionStorage.getItem("hw3d.token"),
  user: null,
  tracks: new Map(),
  sensors: [],
  devices: [],
  environment: null,
  alerts: [],
  selectedId: null,
  layers: { ...defaultLayers },
  socket: "idle",
  siteName: "Alder Harbor",
  history: [],
  error: null,
  chrome: "sidebar",
  panelOpen: false,
};

const listeners = new Set<() => void>();
const sockets: WebSocket[] = [];
let reconnectTimer: number | null = null;
let mediaQueryBound = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function set(patch: Partial<OpsState>): void {
  state = { ...state, ...patch };
  emit();
}

function upsertTrack(track: TrackRecord): void {
  const prev = state.tracks.get(track.track_id);
  if (prev && track.seq <= prev.seq) return;
  const next = new Map(state.tracks);
  next.set(track.track_id, track);
  state = { ...state, tracks: next };
  emit();
}

function connectSocket(path: string, token: string): void {
  const socket = new WebSocket(wsUrl(path, token));
  sockets.push(socket);
  set({ socket: "connecting" });
  socket.addEventListener("open", () => set({ socket: "live", error: null }));
  socket.addEventListener("message", (event) => {
    try {
      const envelope = JSON.parse(String(event.data)) as StreamEnvelope<unknown>;
      if (envelope.type === "track") {
        upsertTrack(envelope.payload as TrackRecord);
      } else if (envelope.type === "sensor_telemetry") {
        const tel = envelope.payload as SensorRecord["telemetry"];
        if (!tel) return;
        state = {
          ...state,
          sensors: state.sensors.map((s) =>
            s.sensor_id === tel.sensor_id ? { ...s, telemetry: tel } : s,
          ),
        };
        emit();
      } else if (envelope.type === "environment") {
        set({ environment: envelope.payload as EnvironmentalTelemetry });
      } else if (envelope.type === "device_status") {
        const device = envelope.payload as DeviceStatus;
        const devices = state.devices.filter((d) => d.device_id !== device.device_id);
        devices.push(device);
        set({ devices });
      } else if (envelope.type === "alert") {
        const alert = envelope.payload as AlertEvent;
        const alerts = [alert, ...state.alerts.filter((a) => a.alert_id !== alert.alert_id)];
        set({ alerts: alerts.slice(0, 80) });
      }
    } catch {
      /* ignore */
    }
  });
  socket.addEventListener("close", () => {
    set({ socket: "reconnect" });
    scheduleReconnect(token);
  });
}

function scheduleReconnect(token: string): void {
  if (reconnectTimer) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    stopSockets();
    connectAll(token);
  }, 1500);
}

function stopSockets(): void {
  for (const socket of sockets) {
    socket.onclose = null;
    socket.close();
  }
  sockets.length = 0;
}

function connectAll(token: string): void {
  connectSocket("/ws/tracks", token);
  connectSocket("/ws/telemetry", token);
  connectSocket("/ws/status", token);
}

function applyChrome(): void {
  const width = window.innerWidth;
  const chrome: OpsState["chrome"] =
    width < 720 ? "sheet" : width < 1100 ? "drawer" : "sidebar";
  const layers = { ...state.layers };
  if (chrome === "sheet" && state.chrome !== "sheet") {
    layers.trackHistory = false;
    layers.environment = false;
  }
  set({ chrome, layers });
}

export const ops = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    if (!mediaQueryBound) {
      mediaQueryBound = true;
      applyChrome();
      window.addEventListener("resize", applyChrome);
    }
    return () => listeners.delete(listener);
  },
  async bootstrap(): Promise<void> {
    if (!state.token) return;
    try {
      const [user, sites, sensors, devices, environment, alerts] = await Promise.all([
        api.user(state.token),
        api.sites(state.token),
        api.sensors(state.token),
        api.devices(state.token),
        api.environment(state.token),
        api.alerts(state.token),
      ]);
      set({
        user,
        sensors,
        devices,
        environment,
        alerts,
        siteName: sites[0]?.name ?? "Alder Harbor",
        error: null,
      });
      connectAll(state.token);
    } catch (err) {
      sessionStorage.removeItem("hw3d.token");
      set({ token: null, user: null, error: err instanceof Error ? err.message : "session expired" });
    }
  },
  async login(email: string, password: string): Promise<void> {
    const result = await api.login(email, password);
    sessionStorage.setItem("hw3d.token", result.token);
    set({ token: result.token, user: result.user, error: null });
    await ops.bootstrap();
  },
  logout(): void {
    stopSockets();
    sessionStorage.removeItem("hw3d.token");
    set({
      token: null,
      user: null,
      tracks: new Map(),
      selectedId: null,
      socket: "idle",
    });
  },
  select(trackId: string | null): void {
    set({ selectedId: trackId, panelOpen: true });
    if (trackId && state.token && (state.user?.role === "operator" || state.user?.role === "admin")) {
      api.history(state.token, trackId).then((history) => set({ history })).catch(() => set({ history: [] }));
    } else {
      set({ history: [] });
    }
  },
  toggleLayer(key: keyof LayerState): void {
    set({ layers: { ...state.layers, [key]: !state.layers[key] } });
  },
  setPanelOpen(open: boolean): void {
    set({ panelOpen: open });
  },
  async ack(alertId: string): Promise<void> {
    if (!state.token) return;
    const updated = await api.ackAlert(state.token, alertId);
    set({
      alerts: state.alerts.map((a) => (a.alert_id === alertId ? updated : a)),
    });
  },
};
