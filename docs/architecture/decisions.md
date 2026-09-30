<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Decisions

> Architectural decision records for HarborWatch 3D.

Status values: **Accepted**, **Proposed**, **Superseded**.

## ADR-001. Consume tracks, not raw LiDAR

**Status:** Accepted

**Context.** A harbor console is useful because objects move, sensors fail, and operators need a board. Raw point clouds and SLAM are a different engineering discipline.

**Decision.** The public system emits and consumes LiDAR-**derived** `TrackUpdate` events. The Python service simulates that edge output.

**Consequences.** Interview and review conversations stay on contracts, streaming, GIS binding, and RBAC. We do not pretend to ship a detection stack.

## ADR-002. Python simulator, Node API

**Status:** Accepted

**Context.** Full-stack application work for this console is TypeScript on both sides of the browser. Edge and streaming teams often work in Python.

**Decision.** `apps/api` is Node.js and TypeScript. `services/edge-simulator` is Python. They meet only at `packages/contracts`.

**Consequences.** The seam is visible in the repo. Replacing the simulator with a real edge process should not rewrite the React app.

## ADR-003. Shared contracts package

**Status:** Accepted

**Context.** Question: how do a GIS developer and an edge engineer work without blocking each other?

**Decision.** Explicit schemas (`TrackUpdate`, `SensorTelemetry`, `EnvironmentalTelemetry`, `DeviceStatus`, `SiteConfiguration`, `UserSession`) live in `packages/contracts` and version as `harborwatch.<name>/<major>`.

**Consequences.** CI contract tests become the handshake. Field renames are major versions.

## ADR-004. StreamLayer plus custom WebSocket

**Status:** Accepted

**Context.** Hundreds of moving objects need track identity, purge, and a custom data source.

**Decision.** Live positions go through `/ws/tracks` into ArcGIS `StreamLayer` on a `SceneView`. REST is for config, session, and history.

**Consequences.** We adopt StreamLayer's track and purge model instead of creating Graphics on a timer.

## ADR-005. Viewer, Operator, Admin

**Status:** Accepted

**Context.** A public demo still needs to show account-based access.

**Decision.** Three roles, enforced on the API, reflected in the UI. OIDC in hosted environments, local adapter for development.

**Consequences.** Feature work must name the minimum role. Viewer never acks alerts.

## ADR-006. PostgreSQL for config and sampled history

**Status:** Accepted

**Context.** Live ticks are too hot for a row-per-update durable log in the demo.

**Decision.** PostgreSQL stores users, sites, sensors, zones, and sampled track history. The live board is in-process memory.

**Consequences.** Replay is lossy by design. Horizontal socket fan-out needs a later pub/sub (see [scalability](./scalability.md)).

## ADR-007. One app, three presentations, PWA

**Status:** Accepted

**Context.** Desktop, tablet, and phone must share the data model.

**Decision.** Responsive chrome: sidebar, drawer, bottom sheet. PWA manifest and service worker for installable shell. No native mobile codebase in this repo.

**Consequences.** Touch targets and default layer sets differ. Contracts do not.

## ADR-008. Public reference, no program claims

**Status:** Accepted

**Context.** Defense-adjacent visualization invites sloppy storytelling.

**Decision.** Docs and README state that HarborWatch 3D is a **public reference implementation** with simulated tracks. No Navy, NSWC, classified, or contract-program claims.

**Consequences.** Architecture can be discussed in the open. Fiction about hardware or clearance is out of bounds.

## Related

- [Overview](./overview.md)
- [Contracts](./contracts.md)
- [Documentation index](../README.md)
