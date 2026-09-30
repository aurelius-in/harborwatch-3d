<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="200" />
</p>

# System overview

> A secure, real-time sensor-fusion operations console for monitoring a harbor or maritime facility.

<table>
<tr>
<td width="8" bgcolor="#00A0B8"></td>
<td>

**Note.** HarborWatch 3D is the application and integration layer. It consumes the <em>output</em> of detection and tracking. It does not implement LiDAR SLAM or object detection.

</td>
</tr>
</table>

## Purpose

Sensors around a harbor detect moving objects. The application shows those objects moving live on a 3D map, along with sensor health, weather conditions, alerts, and historical tracks.

That sentence is the product. A reviewer should be able to run the stack, see moving tracks on the 3D board, click one, watch telemetry change, toggle layers, and shrink the viewport to a phone layout. If an ArcGIS API key is present, the board is a SceneView. If it is missing, the built-in 3D harbor scene still shows live tracks. The demo never renders an empty map.

## What the screen looks like

The desktop console is a polished operations dashboard:

- A large 3D ArcGIS map occupies most of the screen.
- 20 to 100 simulated objects move around a harbor.
- Classifications are `vessel`, `vehicle`, `person`, or `unknown`.
- Trails show where an object has been.
- Clicking a track opens track ID, classification, speed, heading, confidence, last update, and the observing sensor.
- Side panels show sensor status, environmental telemetry, connection status, active tracks, and alerts.
- Layer toggles: Object Tracks, Track History, Sensors, Environmental Data, Restricted Zones, Device Locations.
- Viewer, Operator, and Admin roles change what the UI allows.
- Tablet and phone use the same data model with a drawer or bottom sheet.

## Architectural story

```text
LiDAR / Edge System
       |
Detection & Tracking
       |
Normalized Track Events
       |
Streaming Gateway
       |
WebSocket
       |
React Application
       |
ArcGIS 3D Scene
```

Parallel telemetry follows the same shape:

```text
Sensor Devices
     |
Environmental / Device Telemetry
     |
API / Streaming Gateway
     |
React Dashboard
```

The **Python edge simulator** stands in for the component an application lead would receive from an edge or streaming engineer. The **Node.js API** authenticates, authorizes, fans out, stores history, and logs. The **React** client binds a track store to ArcGIS SceneView when a key is configured, and to the built-in 3D harbor scene otherwise.

## Principles

| Principle | Meaning |
|---|---|
| Tracks, not points | Consume `TrackUpdate` events, not raw point clouds |
| Contracts first | Edge, API, and GIS agree on schemas, not internals |
| Incremental updates | Reuse `track_id` instead of creating new map objects |
| Streams, not polls | Live motion and telemetry move over WebSockets |
| Bounded memory | Purge, throttle, and expire stale tracks |
| Adaptive chrome | One application model, three presentations |
| Public and defensible | Simulated data, no government or program claims |

## Repository map

The intended tree is now the running tree. See the [root README](../../README.md):

```text
harborwatch-3d/
├── apps/web/                 React + TypeScript + Vite
├── apps/api/                 Node.js + TypeScript gateway
├── services/edge-simulator/  Python track and telemetry producer
├── packages/contracts/       Shared schemas
├── packages/auth/            Auth adapters
├── packages/telemetry/       Logging helpers
├── infra/                    Docker and deployment
├── tests/                    Integration and E2E
└── docs/                     This documentation set
```

## Non-goals

<table>
<tr>
<td width="8" bgcolor="#002C54"></td>
<td>

<strong>Boundary.</strong> This repository does not implement point-cloud ingest, SLAM, or multi-sensor association. It does not represent government or proprietary program work.

</td>
</tr>
</table>

## Related

- [System context](./context.md)
- [Containers](./containers.md)
- [Diagrams: system overview](../diagrams/system-overview.md)
- [Documentation index](../README.md)
