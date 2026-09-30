<p align="center">
  <img src="./hw3d-logo.png" alt="HarborWatch 3D" width="320" />
</p>

<h1 align="center">HarborWatch 3D</h1>

<p align="center">
  <strong>Real-Time Sensor Fusion &amp; Geospatial Operations Platform</strong>
</p>

<p align="center">
  <img alt="navy" src="https://img.shields.io/badge/navy-%23002C54.svg?style=flat-square&labelColor=002C54&color=002C54" />
  <img alt="sea" src="https://img.shields.io/badge/sea-%23006098.svg?style=flat-square&labelColor=006098&color=006098" />
  <img alt="teal" src="https://img.shields.io/badge/teal-%2300A0B8.svg?style=flat-square&labelColor=00A0B8&color=00A0B8" />
</p>

HarborWatch 3D is a reference implementation of a secure, account-based application for visualizing real-time sensor-derived object tracks in a 3D geospatial environment.

## Overview

The system models a distributed sensor deployment in which edge devices produce LiDAR-derived object tracks, device status, and environmental telemetry. A streaming application layer normalizes that information and distributes updates to authenticated browser clients using WebSockets.

Users can monitor moving objects, inspect individual tracks, view sensor and environmental telemetry, toggle visualization layers, monitor device health, and interact with the system from desktop, tablet, or mobile devices.

**The project emphasizes the application and systems-integration layer rather than LiDAR signal processing itself.**

## Features

- Real-time 3D geospatial visualization with ArcGIS SceneView
- WebSocket-based continuous track updates with track IDs
- Multi-site sensor deployment monitoring
- Sensor health, environmental telemetry, alerts, and device status
- Viewer, Operator, and Admin roles
- Responsive desktop, tablet, and mobile layouts
- Progressive Web App support
- Architecture designed for hundreds of continuously changing objects

## Architecture

```text
Edge/LiDAR System
       ↓
Detection & Tracking (normalized output)
       ↓
Python Edge Simulator
       ↓
Node.js Streaming Gateway
       ↓
WebSocket Streams
       ↓
React Application
       ↓
ArcGIS 3D Scene
```

## Repository Structure

```text
harborwatch-3d/
├── apps/
│   ├── web/                 # React + TypeScript + Vite frontend
│   └── api/                 # Node.js + Express backend
├── services/
│   └── edge-simulator/      # Python edge system simulator
├── packages/
│   ├── contracts/           # Shared TypeScript interfaces
│   ├── auth/                # Authentication utilities
│   └── telemetry/           # Telemetry and logging
├── infra/                   # Docker and deployment configuration
├── tests/                   # Integration and end-to-end tests
├── docs/                    # Architecture, security, and deployment docs
├── docker-compose.yml
└── .github/workflows/       # CI/CD pipelines
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Docker and Docker Compose
- ArcGIS Developer Account or API key

### Local Development

```bash
git clone https://github.com/aurelius-in/harborwatch-3d.git
cd harborwatch-3d
cp .env.example .env
# Edit .env with your ArcGIS API key and local configuration
docker compose up
```

Expected local endpoints:

- Frontend: http://localhost:3000
- API: http://localhost:5000
- Edge simulator: http://localhost:8000

## Technology Stack

### Frontend

- React 18, TypeScript, and Vite
- ArcGIS Maps SDK for JavaScript
- Responsive CSS/Tailwind-ready styling
- PWA manifest and service worker
- Vitest and React Testing Library

### Backend

- Node.js, Express, and TypeScript
- WebSocket streaming
- PostgreSQL-ready persistence
- JWT and OAuth/OIDC-ready authentication
- Structured logging and health endpoints

### Edge Simulator

- Python 3.9+
- AsyncIO
- WebSocket client
- Simulated LiDAR-derived track and telemetry generation

### Infrastructure

- Docker and Docker Compose
- GitHub Actions CI/CD
- Kubernetes-ready deployment configuration

## Core Contracts

The shared contract package defines the interfaces between edge, application, and GIS components.

```typescript
interface TrackUpdate {
  track_id: string;
  object_type: "vessel" | "vehicle" | "person" | "unknown";
  latitude: number;
  longitude: number;
  altitude: number;
  speed_mps: number;
  heading: number;
  confidence: number;
  sensor_id: string;
  timestamp: string;
  last_seen: string;
}

interface SensorTelemetry {
  sensor_id: string;
  site_id: string;
  status: "operational" | "degraded" | "offline";
  temperature_c: number;
  humidity_percent: number;
  visibility_meters: number;
  wind_speed_mps: number;
  wind_direction: number;
  battery_percent?: number;
  timestamp: string;
}
```

## Roles

- **Viewer**: Read-only access to tracks and telemetry
- **Operator**: Can acknowledge alerts, manage sites, and view history
- **Admin**: Full configuration, user management, and audit-log access

## Design Principles

- Track IDs and incremental updates instead of recreating objects
- WebSockets instead of polling for live data
- Server-side subscriptions and client-side throttling
- Bounded track history and stale-track expiration
- Reconnection handling with timestamps and sequence numbers
- Shared schemas between edge, API, and frontend teams
- Adaptive presentation: persistent sidebar on desktop, drawer on tablet, bottom sheet on phone

## Palette

Taken from [`hw3d-logo.png`](./hw3d-logo.png). No gold.

| Token | Hex |
|---|---|
| Navy (wordmark) | `#002C54` |
| Sea | `#006098` |
| Teal (3D accent) | `#00A0B8` |
| Beam | `#ACE0E8` |
| Mist | `#E8F8F8` |

## Documentation

- [Documentation index](./docs/README.md)
- [Architecture overview](./docs/architecture/overview.md)
- [Data flow](./docs/architecture/data-flow.md)
- [Security](./docs/architecture/security.md)
- [Deployment](./docs/architecture/deployment.md)
- [System diagrams](./docs/diagrams/system-overview.md)

## Project Scope

HarborWatch 3D is a public reference implementation. It uses simulated LiDAR-derived tracks and does not claim to represent any specific defense, government, or proprietary system. The focus is the application and systems-integration boundary: normalized sensor events, streaming services, WebSockets, React, and real-time ArcGIS 3D visualization.

## Roadmap

- [ ] Multi-site geographic filtering
- [ ] Historical track playback
- [ ] Geofenced/restricted-zone alerts
- [ ] Advanced track-fusion demonstrations
- [ ] Cloud storage integration
- [ ] SIEM integration example

## License

MIT License. See [LICENSE](./LICENSE).
