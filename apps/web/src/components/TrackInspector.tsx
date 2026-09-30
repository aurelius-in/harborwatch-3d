import type { HistoryPoint } from "@harborwatch/contracts";
import type { TrackRecord } from "../lib/api";
import { formatHeading, formatSpeed, timeAgo } from "../lib/geo";
import { ops } from "../lib/store";

export function TrackInspector({
  track,
  history,
  canHistory,
  sheet,
}: {
  track: TrackRecord;
  history: HistoryPoint[];
  canHistory: boolean;
  sheet: boolean;
}) {
  return (
    <div className={`inspector ${sheet ? "sheet" : ""}`}>
      <header>
        <h2>{track.track_id}</h2>
        <button className="btn-ghost" onClick={() => ops.select(null)}>
          Close
        </button>
      </header>
      <dl>
        <div>
          <dt>Class</dt>
          <dd>{track.object_type}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{formatSpeed(track.speed_mps)}</dd>
        </div>
        <div>
          <dt>Heading</dt>
          <dd>{formatHeading(track.heading)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{(track.confidence * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt>Last update</dt>
          <dd>{timeAgo(track.last_seen)}</dd>
        </div>
        <div>
          <dt>Sensor</dt>
          <dd>{track.sensor_id}</dd>
        </div>
        <div>
          <dt>Altitude</dt>
          <dd>{track.altitude.toFixed(1)} m</dd>
        </div>
        <div>
          <dt>Seq</dt>
          <dd>{track.seq}</dd>
        </div>
        <div>
          <dt>Latitude</dt>
          <dd>{track.latitude.toFixed(5)}</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd>{track.longitude.toFixed(5)}</dd>
        </div>
        <div>
          <dt>Site</dt>
          <dd>{track.site_id}</dd>
        </div>
        <div>
          <dt>Timestamp</dt>
          <dd>{track.timestamp.slice(11, 19)}Z</dd>
        </div>
      </dl>
      {canHistory ? (
        <>
          <Sparkline points={history} />
          {history.length > 0 ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Speed</th>
                  <th>Hdg</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(-8).reverse().map((point) => (
                  <tr key={point.timestamp}>
                    <td>{point.timestamp.slice(11, 19)}</td>
                    <td>{point.speed_mps.toFixed(1)}</td>
                    <td>{point.heading.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No sampled history yet for this ID.</p>
          )}
        </>
      ) : (
        <p className="muted">History is available to Operator and Admin via GET /api/tracks/:id/history.</p>
      )}
    </div>
  );
}

function Sparkline({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) return null;
  const w = 280;
  const h = 42;
  const max = Math.max(...points.map((p) => p.speed_mps), 1);
  const d = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * w;
      const y = h - (point.speed_mps / max) * (h - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <figure className="sparkline">
      <figcaption>Speed history</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Track speed sparkline">
        <path d={d} fill="none" stroke="#00A0B8" strokeWidth="2" />
      </svg>
    </figure>
  );
}
