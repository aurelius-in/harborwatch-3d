import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HarborScene } from "../scene/HarborScene";
import { ArcGisScene } from "../scene/ArcGisScene";
import { formatHeading, formatSpeed, timeAgo } from "../lib/geo";
import { ops, type LayerState } from "../lib/store";
import { RoleGate } from "./RoleGate";

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
  const tracks = useMemo(
    () =>
      [...state.tracks.values()].map((track) => ({
        ...track,
        stale: now - Date.parse(track.last_seen) > 15_000,
      })),
    [state.tracks, now],
  );
  const selected = state.selectedId ? state.tracks.get(state.selectedId) : undefined;
  const apiKey = import.meta.env.VITE_ARCGIS_API_KEY ?? "";
  const useArcGis = Boolean(apiKey) && !arcgisFailed;
  const live = tracks.filter((t) => !t.stale).length;
  const wind = state.environment?.wind_direction ?? 210;
  const visibility = state.environment?.visibility_meters ?? 8000;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`console chrome-${state.chrome}`}>
      <header className="topbar">
        <div className="brand">
          <img src="/hw3d-logo.png" alt="HarborWatch 3D" />
          <div>
            <strong>HarborWatch 3D</strong>
            <span>{state.siteName}</span>
          </div>
        </div>
        <div className="topbar-meta">
          <span className={`pulse ${state.socket}`}>{state.socket}</span>
          <span className="chip">{live} live</span>
          <span className="chip role">{state.user?.role}</span>
          <span className="email">{state.user?.email}</span>
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

      <aside className={`panel left ${state.panelOpen || state.chrome === "sidebar" ? "open" : ""}`}>
        <section>
          <h2>Connection</h2>
          <p className="metric">
            Stream <b>{state.socket}</b>
          </p>
          <p className="metric">
            Board <b>{tracks.length}</b>
          </p>
        </section>
        <section>
          <h2>Sensors</h2>
          <ul className="list">
            {state.sensors.map((sensor) => (
              <li key={sensor.sensor_id}>
                <span>{sensor.sensor_id}</span>
                <em className={sensor.telemetry?.status ?? "operational"}>
                  {sensor.telemetry?.status ?? "pending"}
                </em>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Environment</h2>
          {state.environment ? (
            <ul className="kv">
              <li>
                <span>Visibility</span>
                <b>{Math.round(state.environment.visibility_meters)} m</b>
              </li>
              <li>
                <span>Wind</span>
                <b>
                  {state.environment.wind_speed_mps.toFixed(1)} m/s{" "}
                  {formatHeading(state.environment.wind_direction)}
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
          ) : (
            <p className="muted">Waiting for telemetry</p>
          )}
        </section>
      </aside>

      <main className="scene-wrap">
        {useArcGis ? (
          <ArcGisScene
            apiKey={apiKey}
            tracks={tracks}
            sensors={state.sensors}
            layers={state.layers}
            selectedId={state.selectedId}
            onSelect={onSelect}
            onFail={onFail}
          />
        ) : (
          <HarborScene
            tracks={tracks}
            sensors={state.sensors}
            devices={state.devices}
            layers={state.layers}
            selectedId={state.selectedId}
            windDir={wind}
            visibility={visibility}
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

      <aside className={`panel right ${state.panelOpen || state.chrome === "sidebar" ? "open" : ""}`}>
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
        </section>
        <section>
          <h2>Active tracks</h2>
          <ul className="track-list">
            {tracks
              .slice()
              .sort((a, b) => a.track_id.localeCompare(b.track_id))
              .map((track) => (
                <li key={track.track_id}>
                  <button
                    className={track.track_id === state.selectedId ? "selected" : ""}
                    onClick={() => ops.select(track.track_id)}
                  >
                    <b>{track.track_id}</b>
                    <span>
                      {track.object_type} · {formatSpeed(track.speed_mps)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
        <section>
          <h2>Alerts</h2>
          <ul className="alerts">
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
        </section>
      </aside>

      {selected ? (
        <div className={`inspector ${state.chrome === "sheet" ? "sheet" : ""}`}>
          <header>
            <h2>{selected.track_id}</h2>
            <button className="btn-ghost" onClick={() => ops.select(null)}>
              Close
            </button>
          </header>
          <dl>
            <div>
              <dt>Class</dt>
              <dd>{selected.object_type}</dd>
            </div>
            <div>
              <dt>Speed</dt>
              <dd>{formatSpeed(selected.speed_mps)}</dd>
            </div>
            <div>
              <dt>Heading</dt>
              <dd>{formatHeading(selected.heading)}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{(selected.confidence * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>{timeAgo(selected.last_seen)}</dd>
            </div>
            <div>
              <dt>Sensor</dt>
              <dd>{selected.sensor_id}</dd>
            </div>
            <div>
              <dt>Altitude</dt>
              <dd>{selected.altitude.toFixed(1)} m</dd>
            </div>
            <div>
              <dt>Seq</dt>
              <dd>{selected.seq}</dd>
            </div>
          </dl>
          {state.history.length > 0 ? (
            <p className="muted">{state.history.length} sampled history points</p>
          ) : (
            <p className="muted">History available to Operator and Admin</p>
          )}
        </div>
      ) : null}

      {state.chrome === "sheet" ? (
        <button className="sheet-toggle" onClick={() => ops.setPanelOpen(!state.panelOpen)}>
          {state.panelOpen ? "Hide ops" : "Ops panels"}
        </button>
      ) : null}
    </div>
  );
}
