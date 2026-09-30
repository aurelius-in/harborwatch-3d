import type {
  AlertEvent,
  AuditEvent,
  DeviceStatus,
  EnvironmentalTelemetry,
  HistoryPoint,
  SiteConfiguration,
  StreamEnvelope,
  UserSession,
} from "@harborwatch/contracts";
import { api, wsUrl, type HealthSnapshot, type SensorRecord, type TrackRecord } from "./api";

export interface LayerState {
  objectTracks: boolean;
  trackHistory: boolean;
  sensors: boolean;
  environment: boolean;
  restrictedZones: boolean;
  devices: boolean;
}

export type SocketState = "idle" | "connecting" | "live" | "reconnect";

export interface ChannelStatus {
  state: SocketState;
  lastMessageAt: number | null;
}

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
  channels: Record<"tracks" | "telemetry" | "status", ChannelStatus>;
  siteId: string;
  sites: SiteConfiguration[];
  siteName: string;
  history: HistoryPoint[];
  health: HealthSnapshot | null;
  users: UserSession[];
  audit: AuditEvent[];
  error: string | null;
  chrome: "sidebar" | "drawer" | "sheet";
  panelOpen: boolean;
  sheetTab: "ops" | "tracks" | "alerts";
  reconnectAttempt: number;
  reconnectInMs: number;
  adminOpen: boolean;
}

const defaultLayers: LayerState = {
  objectTracks: true,
  trackHistory: true,
  sensors: true,
  environment: false,
  restrictedZones: true,
  devices: true,
};

const idleChannel = (): ChannelStatus => ({ state: "idle", lastMessageAt: null });

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
  channels: {
    tracks: idleChannel(),
    telemetry: idleChannel(),
    status: idleChannel(),
  },
  siteId: "alder-harbor",
  sites: [],
  siteName: "Alder Harbor",
  history: [],
  health: null,
  users: [],
  audit: [],
  error: null,
  chrome: "sidebar",
  panelOpen: false,
  sheetTab: "ops",
  reconnectAttempt: 0,
  reconnectInMs: 0,
  adminOpen: false,
};

const listeners = new Set<() => void>();
const sockets: Array<{ path: "/ws/tracks" | "/ws/telemetry" | "/ws/status"; socket: WebSocket }> = [];
let reconnectTimer: number | null = null;
let healthTimer: number | null = null;
let expireTimer: number | null = null;
let mediaQueryBound = false;
let reconnectAttempt = 0;
let socketGeneration = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function set(patch: Partial<OpsState>): void {
  state = { ...state, ...patch };
  emit();
}

function summarizeSocket(): SocketState {
  const states = Object.values(state.channels).map((c) => c.state);
  if (states.every((s) => s === "live")) return "live";
  if (states.some((s) => s === "connecting")) return "connecting";
  if (states.some((s) => s === "reconnect")) return "reconnect";
  return "idle";
}

function setChannel(path: "tracks" | "telemetry" | "status", patch: Partial<ChannelStatus>): void {
  state = {
    ...state,
    channels: {
      ...state.channels,
      [path]: { ...state.channels[path], ...patch },
    },
  };
  state = { ...state, socket: summarizeSocket() };
  emit();
}

function upsertTrack(track: TrackRecord): void {
  if (track.site_id && track.site_id !== state.siteId) return;
  const prev = state.tracks.get(track.track_id);
  if (prev && track.seq <= prev.seq) return;
  const next = new Map(state.tracks);
  next.set(track.track_id, track);
  state = { ...state, tracks: next };
  emit();
}

function dropTracks(ids: string[]): void {
  if (!ids.length) return;
  const next = new Map(state.tracks);
  for (const id of ids) next.delete(id);
  const selectedId = state.selectedId && next.has(state.selectedId) ? state.selectedId : null;
  state = { ...state, tracks: next, selectedId };
  emit();
}

function expireLocal(): void {
  const now = Date.now();
  const removed: string[] = [];
  for (const [id, track] of state.tracks) {
    const age = now - Date.parse(track.last_seen);
    if (!Number.isFinite(age) || age > 45_000) removed.push(id);
  }
  dropTracks(removed);
}

function connectSocket(path: "/ws/tracks" | "/ws/telemetry" | "/ws/status", token: string): void {
  const name = path.replace("/ws/", "") as "tracks" | "telemetry" | "status";
  const generation = socketGeneration;
  const socket = new WebSocket(wsUrl(path, token));
  sockets.push({ path, socket });
  setChannel(name, { state: "connecting" });
  socket.addEventListener("open", () => {
    if (generation !== socketGeneration) return;
    reconnectAttempt = 0;
    set({ reconnectAttempt: 0, reconnectInMs: 0, error: null });
    setChannel(name, { state: "live" });
    socket.send(JSON.stringify({ subscribe: [name], site_id: state.siteId }));
  });
  socket.addEventListener("message", (event) => {
    if (generation !== socketGeneration) return;
    setChannel(name, { lastMessageAt: Date.now(), state: "live" });
    try {
      const envelope = JSON.parse(String(event.data)) as StreamEnvelope<unknown>;
      if (envelope.type === "track") {
        upsertTrack(envelope.payload as TrackRecord);
      } else if (envelope.type === "track_expire") {
        const payload = envelope.payload as { track_ids?: string[] };
        dropTracks(payload.track_ids ?? []);
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
        const env = envelope.payload as EnvironmentalTelemetry;
        if (env.site_id === state.siteId) set({ environment: env });
      } else if (envelope.type === "device_status") {
        const device = envelope.payload as DeviceStatus;
        if (device.site_id !== state.siteId) return;
        const devices = state.devices.filter((d) => d.device_id !== device.device_id);
        devices.push(device);
        set({ devices });
      } else if (envelope.type === "alert") {
        const alert = envelope.payload as AlertEvent;
        if (alert.site_id !== state.siteId) return;
        const alerts = [alert, ...state.alerts.filter((a) => a.alert_id !== alert.alert_id)];
        set({ alerts: alerts.slice(0, 80) });
      }
    } catch {
      /* ignore */
    }
  });
  socket.addEventListener("close", () => {
    if (generation !== socketGeneration) return;
    setChannel(name, { state: "reconnect" });
    scheduleReconnect(token);
  });
}

function scheduleReconnect(token: string): void {
  if (reconnectTimer || !state.token) return;
  const delay = Math.min(1500 * 2 ** reconnectAttempt, 20_000);
  reconnectAttempt += 1;
  set({ socket: "reconnect", reconnectAttempt, reconnectInMs: delay });
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    stopSockets();
    connectAll(token);
  }, delay);
}

function stopSockets(): void {
  socketGeneration += 1;
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  for (const entry of sockets) {
    entry.socket.close();
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

async function loadSiteData(token: string, siteId: string): Promise<void> {
  const [sensors, devices, environment, alerts, tracks] = await Promise.all([
    api.sensors(token, siteId),
    api.devices(token, siteId),
    api.environment(token, siteId),
    api.alerts(token, siteId),
    api.tracks(token, siteId).catch(() => [] as TrackRecord[]),
  ]);
  const next = new Map<string, TrackRecord>();
  for (const track of tracks) next.set(track.track_id, track);
  set({ sensors, devices, environment, alerts, tracks: next, error: null });
}

function startTimers(): void {
  if (!healthTimer) {
    const tick = () => {
      void api
        .health()
        .then((health) => set({ health }))
        .catch(() => undefined);
    };
    tick();
    healthTimer = window.setInterval(tick, 5000);
  }
  if (!expireTimer) {
    expireTimer = window.setInterval(expireLocal, 2000);
  }
}

function stopTimers(): void {
  if (healthTimer) {
    window.clearInterval(healthTimer);
    healthTimer = null;
  }
  if (expireTimer) {
    window.clearInterval(expireTimer);
    expireTimer = null;
  }
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
      const [user, sites] = await Promise.all([api.user(state.token), api.sites(state.token)]);
      const siteId =
        sites.find((s) => s.site_id === state.siteId)?.site_id ?? sites[0]?.site_id ?? "alder-harbor";
      const site = sites.find((s) => s.site_id === siteId);
      set({
        user,
        sites,
        siteId,
        siteName: site?.name ?? "Alder Harbor",
        error: null,
      });
      await loadSiteData(state.token, siteId);
      connectAll(state.token);
      startTimers();
      if (user.role === "admin") {
        void ops.refreshAdmin();
      }
    } catch (err) {
      sessionStorage.removeItem("hw3d.token");
      stopSockets();
      stopTimers();
      set({
        token: null,
        user: null,
        error: err instanceof Error ? err.message : "session expired",
      });
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
    stopTimers();
    sessionStorage.removeItem("hw3d.token");
    set({
      token: null,
      user: null,
      tracks: new Map(),
      selectedId: null,
      socket: "idle",
      channels: {
        tracks: idleChannel(),
        telemetry: idleChannel(),
        status: idleChannel(),
      },
      adminOpen: false,
    });
  },
  async setSite(siteId: string): Promise<void> {
    if (!state.token || siteId === state.siteId) return;
    const site = state.sites.find((s) => s.site_id === siteId);
    set({
      siteId,
      siteName: site?.name ?? siteId,
      tracks: new Map(),
      selectedId: null,
      history: [],
      alerts: [],
    });
    void api.audit(state.token, { action: "site.switch", target: siteId, site_id: siteId });
    await loadSiteData(state.token, siteId);
    for (const entry of sockets) {
      if (entry.socket.readyState === 1) {
        entry.socket.send(JSON.stringify({ site_id: siteId }));
      }
    }
  },
  select(trackId: string | null): void {
    set({ selectedId: trackId, panelOpen: true });
    if (trackId && state.token && (state.user?.role === "operator" || state.user?.role === "admin")) {
      api
        .history(state.token, trackId)
        .then((history) => set({ history }))
        .catch(() => set({ history: [] }));
    } else {
      set({ history: [] });
    }
  },
  toggleLayer(key: keyof LayerState): void {
    const next = { ...state.layers, [key]: !state.layers[key] };
    set({ layers: next });
    if (state.token) {
      void api.audit(state.token, {
        action: "layer.toggle",
        target: `${key}:${next[key] ? "on" : "off"}`,
        site_id: state.siteId,
      });
    }
  },
  setPanelOpen(open: boolean): void {
    set({ panelOpen: open });
  },
  setSheetTab(tab: OpsState["sheetTab"]): void {
    set({ sheetTab: tab, panelOpen: true });
  },
  setAdminOpen(open: boolean): void {
    set({ adminOpen: open });
    if (open) void ops.refreshAdmin();
  },
  async ack(alertId: string): Promise<void> {
    if (!state.token) return;
    const updated = await api.ackAlert(state.token, alertId);
    set({
      alerts: state.alerts.map((a) => (a.alert_id === alertId ? updated : a)),
    });
  },
  async refreshAdmin(): Promise<void> {
    if (!state.token || state.user?.role !== "admin") return;
    const [users, audit, health] = await Promise.all([
      api.users(state.token),
      api.listAudit(state.token),
      api.health(),
    ]);
    set({ users, audit, health });
  },
  async setUserRole(userId: string, role: string): Promise<void> {
    if (!state.token) return;
    const updated = await api.patchUser(state.token, userId, { role });
    set({ users: state.users.map((u) => (u.user_id === userId ? updated : u)) });
  },
  async renameSite(siteId: string, name: string): Promise<void> {
    if (!state.token) return;
    const site = await api.patchSite(state.token, siteId, { name });
    set({
      sites: state.sites.map((s) => (s.site_id === siteId ? site : s)),
      siteName: siteId === state.siteId ? site.name : state.siteName,
    });
  },
};
