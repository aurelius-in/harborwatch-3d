import { useState } from "react";
import type { OpsState } from "../lib/store";
import { ops } from "../lib/store";
import { timeAgo } from "../lib/geo";

export function AdminPanel({ state }: { state: OpsState }) {
  const [siteName, setSiteName] = useState(
    state.sites.find((s) => s.site_id === state.siteId)?.name ?? state.siteName,
  );
  const ingest = state.health?.sites?.[state.siteId];

  return (
    <section className="admin-panel" aria-label="Admin">
      <h2>Admin</h2>
      <p className="muted">Users, ingest health, site config, and audit. API-enforced.</p>

      <h3>Ingest health</h3>
      <ul className="kv">
        <li>
          <span>API</span>
          <b>{state.health?.status ?? "n/a"}</b>
        </li>
        <li>
          <span>Database</span>
          <b>{state.health?.database ?? "n/a"}</b>
        </li>
        <li>
          <span>Board</span>
          <b>{state.health?.board_size ?? 0}</b>
        </li>
        <li>
          <span>Site ingest</span>
          <b>{ingest?.ingest_age_s != null ? `${ingest.ingest_age_s.toFixed(1)} s` : "n/a"}</b>
        </li>
        <li>
          <span>Site board</span>
          <b>{ingest?.board_size ?? 0}</b>
        </li>
        <li>
          <span>Sockets</span>
          <b>{state.health?.ws_clients ?? 0}</b>
        </li>
      </ul>

      <h3>Site config</h3>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void ops.renameSite(state.siteId, siteName);
        }}
      >
        <label>
          Display name
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        </label>
        <button className="btn-tiny" type="submit">
          Save
        </button>
      </form>

      <h3>Users</h3>
      <ul className="user-list">
        {state.users.map((user) => (
          <li key={user.user_id}>
            <span>
              {user.email}
              <em>{user.role}</em>
            </span>
            <label className="sr-only" htmlFor={`role-${user.user_id}`}>
              Role for {user.email}
            </label>
            <select
              id={`role-${user.user_id}`}
              value={user.role}
              onChange={(event) => void ops.setUserRole(user.user_id, event.target.value)}
            >
              <option value="viewer">viewer</option>
              <option value="operator">operator</option>
              <option value="admin">admin</option>
            </select>
          </li>
        ))}
      </ul>

      <h3>Audit log</h3>
      <ul className="audit-list">
        {state.audit.length === 0 ? (
          <li className="muted">No audit events yet.</li>
        ) : (
          state.audit.slice(0, 18).map((row) => (
            <li key={`${row.id}-${row.timestamp}`}>
              <b>{row.action}</b>
              <span>
                {row.actor} · {row.target}
              </span>
              <em>{timeAgo(row.timestamp)}</em>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
