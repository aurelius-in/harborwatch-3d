<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# System context

> Who uses HarborWatch 3D, what it talks to, and what stays outside the box.

## In scope

HarborWatch 3D is the **application system**: browser console, streaming API, shared contracts, and a simulated edge producer. People use it to watch a harbor site, inspect tracks, and manage operators.

## Actors

| Actor | Intent | Typical role |
|---|---|---|
| Harbor viewer | Watch live tracks and telemetry | Viewer |
| Duty operator | Acknowledge alerts, inspect history, filter sites | Operator |
| Site admin | Users, sites, sensors, audit | Admin |
| Edge / streaming engineer | Produce `TrackUpdate` and telemetry | External discipline |
| GIS engineer | Scene, layers, symbology, coordinate rules | External discipline |
| Application lead | Contracts, gateway, UI shell, CI/CD | This repository |

<table>
<tr>
<td width="8" bgcolor="#00A0B8"></td>
<td>

<strong>Note.</strong> The application lead does not replace the edge or GIS specialist. They own the interfaces, environments, tests, and application architecture that connect both.

</td>
</tr>
</table>

## External systems

| System | Direction | Why it exists |
|---|---|---|
| Edge detection and tracking | In | Real deployments emit normalized tracks. The simulator stands in. |
| ArcGIS platform | Out | SceneView, basemaps. StreamLayer is a future GIS bind. |
| Identity provider | In | OAuth / OIDC login (adapter in `packages/auth`) |
| PostgreSQL | Out | Users, sites, configuration, track history |
| Email or paging (optional) | Out | Alert escalation in production, not required locally |

## C4 context

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#E8F8F8",
    "primaryTextColor": "#002C54",
    "primaryBorderColor": "#006098",
    "lineColor": "#00A0B8",
    "secondaryColor": "#ACE0E8",
    "tertiaryColor": "#FFFFFF"
  }
}}%%
flowchart LR
  viewer["Viewer"]
  operator["Operator"]
  admin["Admin"]
  hw["HarborWatch 3D"]
  edge["Edge detection<br/>and tracking"]
  gis["ArcGIS platform"]
  idp["Identity provider"]
  db["PostgreSQL"]

  viewer --> hw
  operator --> hw
  admin --> hw
  edge -->|"TrackUpdate, telemetry"| hw
  hw -->|"SceneView or WebGL"| gis
  idp -->|"OIDC tokens"| hw
  hw --> db

  style viewer fill:#ACE0E8,stroke:#006098,color:#002C54
  style operator fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style admin fill:#002C54,stroke:#002850,color:#FFFFFF
  style hw fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style edge fill:#006098,stroke:#002C54,color:#FFFFFF
  style gis fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style idp fill:#08345C,stroke:#00A0B8,color:#FFFFFF
  style db fill:#007CA8,stroke:#002C54,color:#FFFFFF
```

## Trust boundary

Everything inside HarborWatch 3D is account-based. Browsers never talk to the edge simulator directly. The API authenticates the user, applies site filters, and then forwards allowed streams.

<table>
<tr>
<td width="8" bgcolor="#002C54"></td>
<td>

<strong>Boundary.</strong> Classified networks, hardware-in-the-loop sensors, and program-specific coordinate pipelines are out of scope. The public repo uses simulated tracks so the architecture can be shown without proprietary systems.

</td>
</tr>
</table>

## Related

- [Containers](./containers.md)
- [Security](./security.md)
- [Diagrams: system overview](../diagrams/system-overview.md)
