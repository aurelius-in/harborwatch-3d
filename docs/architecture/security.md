<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Security

> Authentication, RBAC, authorization, secrets, and auditability.

HarborWatch 3D is account-based. This public demo ships a local identity adapter. A hosted environment would sit behind OAuth / OIDC. That adapter is not implemented here.

## Authentication

| Environment | Adapter |
|---|---|
| Local | Seeded demo users (`viewer@harborwatch.local`, `operator@harborwatch.local`, `admin@harborwatch.local`) via `packages/auth` |
| Staging / production | Not wired. Session type includes `adapter: "oidc"` so a hosted adapter can be added without changing `UserSession`. |

`GET /api/user` returns `UserSession`. The demo stores the JWT in `sessionStorage` so a refresh keeps the operator on the board. Do not put access tokens in `localStorage`.

WebSocket handshake accepts `Authorization: Bearer` or `?token=` (browsers cannot set WS headers). Connections without a valid session are rejected.

## RBAC

| Role | Can |
|---|---|
| Viewer | Read tracks, telemetry, layers. Cannot ack alerts or change config. |
| Operator | Viewer plus acknowledge alerts, query history, change personal layer presets. |
| Admin | Operator plus users, site display name, audit log, and ingest health. |

UI controls that the role cannot use are hidden (`RoleGate`). The API is the real gate. Never trust the client.

Local login and ingest are rate limited. There is no WAF, no dependency CVE gate in CI, and no hosted OIDC in this repository.

## Authorization

- Site scope: a user only subscribes to `site_ids` on the session.
- Track history: same site ACL as live data.
- Admin routes: `/api/users`, `PATCH /api/users/:id`, `PATCH /api/sites/:id`, `GET /api/audit` require `admin`.
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

Admin and Operator writes emit structured audit events: actor, action, site, target, timestamp. Login, alert acknowledgements, layer toggles, and site switches are auditable. Live track ticks are not individually audited (volume). Sampled history is enough to reconstruct "what was on the board." `GET /api/audit` is admin-only.

## Threat notes (public repo)

<table>
<tr>
<td width="8" bgcolor="#002C54"></td>
<td>

<strong>Boundary.</strong> Public demo with a fictional site. Do not put sensitive coordinates, real badge lists, or operational sensor IDs in the simulator.

</td>
</tr>
</table>

Other basics: HTTPS in hosted environments, no secrets in logs, rate-limit ingest and login (implemented in-process). Dependency scanning and OIDC are out of scope for this public demo.

## Related

- [Observability](./observability.md)
- [Deployment](./deployment.md)
- [Contracts](./contracts.md)
