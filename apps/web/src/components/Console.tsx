import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HarborScene } from "../scene/HarborScene";
import { ArcGisScene } from "../scene/ArcGisScene";
import { formatHeading, formatSpeed, siteOrigin, timeAgo } from "../lib/geo";
import { ops, type LayerState } from "../lib/store";
import { RoleGate } from "./RoleGate";
import { TrackInspector } from "./TrackInspector";
import { AdminPanel } from "./AdminPanel";

const LAYER_LABELS: Array<[keyof LayerState, string]> = [
  ["objectTracks", "Object Tracks"],
  ["trackHistory", "Track History"],
  ["sensors", "Sensors"],
  ["environment", "Environmental Data"],
  ["restrictedZones", "Restricted Zones"],
  ["devices", "Device Locations"],
];

export function Console() {
  const state = useSyncExternalStore(ops.subscribe, ops.getState, ops.getState);
  const [arcgisFailed, setArcGisFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const onSelect = useCallback((id: string | null) => ops.select(id), []);
  const onFail = useCallback(() => setArcGisFailed(true), []);
  const site = state.sites.find((item) => item.site_id === state.siteId);
  const origin = siteOrigin(site);
  const tracks = useMemo(
    () =>
      [...state.tracks.values()]
        .filter((track) => track.site_id === state.siteId || !track.site_id)
        .map((track) => ({
          ...track,
          stale: now - Date.parse(track.last_seen) > 15_000,
        })),
    [state.tracks, state.siteId, now],
  );
  const selected = state.selectedId ? tracks.find((t) => t.track_id === state.selectedId) : undefined;
  const apiKey = import.meta.env.VITE_ARCGIS_API_KEY ?? "";
  const useArcGis = Boolean(apiKey) && !arcgisFailed;
  const live = tracks.filter((t) => !t.stale).length;
  const wind = state.environment?.wind_direction ?? 210;
  const visibility = state.environment?.visibility_meters ?? 8000;
  const visPct = Math.min(100, Math.round((visibility / 9000) * 100));
  const windPct = Math.min(100, Math.round(((state.environment?.wind_speed_mps ?? 0) / 12) * 100));
  const canHistory = state.user?.role === "operator" || state.user?.role === "admin";
  const panelsOpen = state.panelOpen || state.chrome === "sidebar";
  const showLeft = panelsOpen && (state.chrome !== "sheet" || state.sheetTab === "ops");
  const showRight =
    panelsOpen &&
    (state.chrome !== "sheet" || state.sheetTab === "tracks" || state.sheetTab === "alerts");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`console chrome-${state.chrome} role-${state.user?.role ?? "viewer"}`}>
      <a className="skip-link" href="#scene">
        Skip to scene
      </a>
      <header className="topbar">
        <div className="brand">
          <img src="/hw3d-logo.png" alt="" />
          <div>
            <strong>HarborWatch 3D</strong>
            <label className="site-select">
              <span className="sr-only">Site</span>
              <select
                aria-label="Site"
                value={state.siteId}
                onChange={(event) => void ops.setSite(event.target.value)}
              >
                {state.sites.map((item) => (
                  <option key={item.site_id} value={item.site_id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="topbar-meta">
          <span className={`pulse ${state.socket}`} title={channelTitle(state)}>
            {state.socket}
            {state.socket === "reconnect" && state.reconnectInMs
              ? ` ${Math.ceil(state.reconnectInMs / 1000)}s`
              : ""}
          </span>
          <span className="chip">{live} live</span>
          <span className="chip">{tracks.length} board</span>
          <span className="chip role">{state.user?.role}</span>
          <span className="email">{state.user?.email}</span>
          <RoleGate role={state.user?.role} allow={["admin"]}>
            <button className="btn-ghost" onClick={() => ops.setAdminOpen(!state.adminOpen)}>
              {state.adminOpen ? "Close admin" : "Admin"}
            </button>
          </RoleGate>
          {state.chrome !== "sidebar" ? (
            <button className="btn-ghost" onClick={() => ops.setPanelOpen(!state.panelOpen)}>
              Panels
            </button>
          ) : null}
          <button className="btn-ghost" onClick={() => ops.logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="status-strip" aria-live="polite">
        <span>Vis {Math.round(visibility)} m</span>
        <span>
          Wind {(state.environment?.wind_speed_mps ?? 0).toFixed(1)} m/s {formatHeading(wind)}
        </span>
        <span>Temp {(state.environment?.temperature_c ?? 0).toFixed(1)} C</span>
        <span>Ingest {state.health?.ingest_age_s != null ? `${state.health.ingest_age_s.toFixed(1)}s` : "n/a"}</span>
        <span>Health {state.health?.board_size ?? tracks.length}</span>
      </div>

      <aside className={`panel left ${showLeft ? "open" : ""}`}>
        <section>
          <h2>Connection</h2>
          <ul className="kv">
            <li>
              <span>Stream</span>
              <b>{state.socket}</b>
            </li>
            <li>
              <span>/ws/tracks</span>
              <b>{state.channels.tracks.state}</b>
            </li>
            <li>
              <span>/ws/telemetry</span>
              <b>{state.channels.telemetry.state}</b>
            </li>
            <li>
              <span>/ws/status</span>
              <b>{state.channels.status.state}</b>
            </li>
            <li>
              <span>Last frame</span>
              <b>
                {state.channels.tracks.lastMessageAt
                  ? timeAgo(new Date(state.channels.tracks.lastMessageAt).toISOString())
                  : "n/a"}
              </b>
            </li>
            <li>
              <span>Backoff</span>
              <b>
                {state.socket === "reconnect"
                  ? `attempt ${state.reconnectAttempt}`
                  : "idle"}
              </b>
            </li>
            <li>
              <span>Board</span>
              <b>{tracks.length}</b>
            </li>
          </ul>
        </section>
        <section>
          <h2>Sensors</h2>
          {state.sensors.length === 0 ? (
            <p className="muted">Waiting for site sensors.</p>
          ) : (
            <ul className="list">
              {state.sensors.map((sensor) => (
                <li key={sensor.sensor_id}>
                  <span>
                    {sensor.name}
                    <i>{sensor.sensor_id}</i>
                  </span>
                  <em className={sensor.telemetry?.status ?? "operational"}>
                    {sensor.telemetry?.status ?? "pending"}
                  </em>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>Environment</h2>
          {state.environment ? (
            <>
              <ul className="kv">
                <li>
                  <span>Visibility</span>
                  <b>{Math.round(state.environment.visibility_meters)} m</b>
                </li>
                <li>
                  <span>Wind</span>
                  <b>
                    {state.environment.wind_speed_mps.toFixed(1)} m/s {formatHeading(state.environment.wind_direction)}
                  </b>
                </li>
                <li>
                  <span>Temp</span>
                  <b>{state.environment.temperature_c.toFixed(1)} C</b>
                </li>
                <li>
                  <span>Sea state</span>
                  <b>{state.environment.sea_state ?? "n/a"}</b>
                </li>
              </ul>
              <div className="gauges">
                <div>
                  <span>Visibility</span>
                  <div className="gauge">
                    <i style={{ width: `${visPct}%` }} />
                  </div>
                </div>
                <div>
                  <span>Wind</span>
                  <div className="gauge">
                    <i style={{ width: `${windPct}%` }} />
                  </div>
                </div>
                <div
                  className="compass"
                  style={{ transform: `rotate(${state.environment.wind_direction}deg)` }}
                  aria-hidden="true"
                />
              </div>
            </>
          ) : (
            <p className="muted">Waiting for telemetry</p>
          )}
        </section>
        <section>
          <h2>Device GPS</h2>
          {state.devices.length === 0 ? (
            <p className="muted">No device locations yet.</p>
          ) : (
            <ul className="list">
              {state.devices.map((device) => (
                <li key={device.device_id}>
                  <span>
                    {device.device_id}
                    <i>
                      {device.latitude?.toFixed(4)}, {device.longitude?.toFixed(4)}
                    </i>
                  </span>
                  <em className={device.connected ? "operational" : "offline"}>
                    {device.connected ? "up" : "down"}
                  </em>
                </li>
              ))}
            </ul>
          )}
        </section>
        {state.adminOpen && state.user?.role === "admin" ? <AdminPanel state={state} /> : null}
      </aside>

      <main className="scene-wrap" id="scene">
        {useArcGis ? (
          <ArcGisScene
            key={state.siteId}
            apiKey={apiKey}
            tracks={tracks}
            sensors={state.sensors}
            devices={state.devices}
            site={site}
            layers={state.layers}
            selectedId={state.selectedId}
            onSelect={onSelect}
            onFail={onFail}
          />
        ) : (
          <HarborScene
            key={state.siteId}
            tracks={tracks}
            sensors={state.sensors}
            devices={state.devices}
            layers={state.layers}
            selectedId={state.selectedId}
            windDir={wind}
            visibility={visibility}
            origin={origin}
            zones={site?.restricted_zones ?? []}
            onSelect={onSelect}
          />
        )}
        <div className="scene-legend">
          <span className="swatch vessel">Vessel</span>
          <span className="swatch vehicle">Vehicle</span>
          <span className="swatch person">Person</span>
          <span className="swatch unknown">Unknown</span>
          {useArcGis ? <span className="chip">ArcGIS SceneView</span> : <span className="chip">3D harbor</span>}
        </div>
      </main>

      <aside className={`panel right ${showRight ? "open" : ""}`}>
        <section>
          <h2>Layers</h2>
          <div className="toggles">
            {LAYER_LABELS.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={state.layers[key]}
                  onChange={() => ops.toggleLayer(key)}
                />
                {label}
              </label>
            ))}
          </div>
          {site?.restricted_zones?.length ? (
            <ul className="zone-legend">
              {site.restricted_zones.map((zone) => (
                <li key={zone.zone_id}>{zone.name}</li>
              ))}
            </ul>
          ) : null}
        </section>
        <section>
          <h2>Active tracks</h2>
          {tracks.length === 0 ? (
            <p className="muted">Waiting for ingest on this site.</p>
          ) : (
            <ul className="track-list">
              {tracks
                .slice()
                .sort((a, b) => a.track_id.localeCompare(b.track_id))
                .map((track) => (
                  <li key={track.track_id}>
                    <button
                      className={`${track.track_id === state.selectedId ? "selected" : ""} ${track.stale ? "stale" : ""}`}
                      onClick={() => ops.select(track.track_id)}
                    >
                      <b>{track.track_id}</b>
                      <span>
                        {track.object_type} · {formatSpeed(track.speed_mps)}
                        {track.stale ? " · stale" : ""}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <section>
          <h2>Alerts</h2>
          {state.alerts.length === 0 ? (
            <p className="muted">No active alerts.</p>
          ) : (
            <ul className="alerts" aria-live="polite">
              {state.alerts.slice(0, 12).map((alert) => (
                <li key={alert.alert_id} className={alert.severity}>
                  <p>{alert.message}</p>
                  <div className="alert-row">
                    <span>{alert.kind}</span>
                    <RoleGate role={state.user?.role} allow={["operator", "admin"]}>
                      {!alert.acknowledged ? (
                        <button className="btn-tiny" onClick={() => void ops.ack(alert.alert_id)}>
                          Ack
                        </button>
                      ) : (
                        <em>acked</em>
                      )}
                    </RoleGate>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      {selected ? (
        <TrackInspector
          track={selected}
          history={state.history}
          canHistory={canHistory}
          sheet={state.chrome === "sheet"}
        />
      ) : null}

      {state.chrome === "sheet" ? (
        <nav className="sheet-nav">
          <button className={state.sheetTab === "ops" ? "active" : ""} onClick={() => ops.setSheetTab("ops")}>
            Ops
          </button>
          <button className={state.sheetTab === "tracks" ? "active" : ""} onClick={() => ops.setSheetTab("tracks")}>
            Tracks
          </button>
          <button className={state.sheetTab === "alerts" ? "active" : ""} onClick={() => ops.setSheetTab("alerts")}>
            Alerts
          </button>
        </nav>
      ) : null}
    </div>
  );
}

function channelTitle(state: ReturnType<typeof ops.getState>): string {
  return `tracks ${state.channels.tracks.state}, telemetry ${state.channels.telemetry.state}, status ${state.channels.status.state}`;
}
