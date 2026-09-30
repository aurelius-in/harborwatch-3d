<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Security

> Authentication, RBAC, authorization, secrets, and auditability.

HarborWatch 3D is account-based. The public demo may ship a local identity adapter. Production is expected to sit behind OAuth / OIDC.

## Authentication

| Environment | Adapter |
|---|---|
| Local | Seeded demo users (`viewer@harborwatch.local`, `operator@harborwatch.local`, `admin@harborwatch.local`) via `packages/auth` |
| Staging / production | OIDC code flow, JWT access tokens on REST and WebSocket |

`GET /api/user` returns `UserSession`. The local demo stores the JWT in `sessionStorage` so a refresh keeps the operator on the board. The hosted target is memory plus an httpOnly refresh cookie. Do not put access tokens in `localStorage`.

WebSocket handshake accepts `Authorization: Bearer` or `?token=` (browsers cannot set WS headers). Connections without a valid session are rejected.

## RBAC

| Role | Can |
|---|---|
| Viewer | Read tracks, telemetry, layers. Cannot ack alerts or change config. |
| Operator | Viewer plus acknowledge alerts, query history, change personal layer presets. |
| Admin | Operator plus users, sites, sensors, audit log, and environment flags. |

UI controls that the role cannot use are hidden or disabled (`RoleGate`). The API is the real gate. Never trust the client.

## Authorization

- Site scope: a user only subscribes to `site_ids` on the session.
- Track history: same site ACL as live data.
- Admin routes: `/api` config mutations require `admin`.
- Simulator ingest: service credential, not a user role. Separate from browser tokens.

## Secrets

| Secret | Where |
|---|---|
| ArcGIS API key | `.env`, never committed |
| OIDC client secret | API environment only |
| Database URL | API environment |
| Simulator ingest key | Shared between `edge-simulator` and API |

`.env.example` lists names only. CI uses GitHub Actions secrets. Docker Compose reads the local env file.

## Auditability

Admin and Operator writes emit structured audit events: actor, action, site, target, timestamp. Alert acknowledgements are auditable. Live track ticks are not individually audited (volume). Sampled history is enough to reconstruct "what was on the board."

## Threat notes (public repo)

<table>
<tr>
<td width="8" bgcolor="#002C54"></td>
<td>

<strong>Boundary.</strong> Public demo with a fictional site. Do not put sensitive coordinates, real badge lists, or operational sensor IDs in the simulator.

</td>
</tr>
</table>

Other basics: HTTPS in hosted environments, dependency scan in CI, no secrets in logs, rate-limit ingest and login.

## Related

- [Observability](./observability.md)
- [Deployment](./deployment.md)
- [Contracts](./contracts.md)
