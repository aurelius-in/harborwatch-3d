<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="200" />
</p>

# System overview diagrams

> End-to-end HarborWatch 3D architecture in the logo palette.

**Colors.** Navy `#002C54` application core · Sea `#006098` edge · Teal `#00A0B8` live UI and streams · Beam `#ACE0E8` contracts · Mid cyan `#007CA8` data.

## Integration stack

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
flowchart TB
  lidar["LiDAR / edge hardware"]
  detect["Detection and tracking"]
  sim["Python edge simulator<br/>services/edge-simulator"]
  contracts["packages/contracts"]
  api["Node streaming gateway<br/>apps/api"]
  ws["WebSockets<br/>tracks · telemetry · status"]
  web["React PWA<br/>apps/web"]
  scene["ArcGIS SceneView or<br/>3D harbor fallback"]

  lidar -.->|"real deployment"| detect
  detect -.->|"normalized tracks"| api
  sim -->|"demo ingest"| api
  contracts --- sim
  contracts --- api
  contracts --- web
  api --> ws
  ws --> web
  web --> scene

  style lidar fill:#08345C,stroke:#ACE0E8,color:#FFFFFF
  style detect fill:#006098,stroke:#002C54,color:#FFFFFF
  style sim fill:#006098,stroke:#00A0B8,color:#FFFFFF
  style contracts fill:#ACE0E8,stroke:#006098,color:#002C54
  style api fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style ws fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style web fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style scene fill:#002C54,stroke:#ACE0E8,color:#FFFFFF
```

Dotted arrows are the production edge path. Solid arrows are what this repository runs locally.

## Application lead and specialists

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#E8F8F8",
    "primaryTextColor": "#002C54",
    "lineColor": "#00A0B8"
  }
}}%%
flowchart TB
  lead["Application lead<br/>contracts, gateway, UI shell, CI"]
  edge["Edge engineer<br/>track and telemetry streams"]
  gis["GIS engineer<br/>SceneView, layers, symbology"]
  app["React application"]

  lead --> edge
  lead --> gis
  edge --> app
  gis --> app

  style lead fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style edge fill:#006098,stroke:#002C54,color:#FFFFFF
  style gis fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style app fill:#00A0B8,stroke:#002C54,color:#FFFFFF
```

## Console layout

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#E8F8F8",
    "primaryTextColor": "#002C54",
    "lineColor": "#00A0B8"
  }
}}%%
flowchart LR
  subgraph desktop["Desktop"]
    side["Telemetry sidebar"]
    map1["SceneView"]
  end
  subgraph tablet["Tablet"]
    draw["Drawer"]
    map2["SceneView"]
  end
  subgraph phone["Phone"]
    map3["SceneView"]
    sheet["Bottom sheet"]
  end

  style desktop fill:#E8F8F8,stroke:#002C54,color:#002C54
  style tablet fill:#E8F8F8,stroke:#006098,color:#002C54
  style phone fill:#E8F8F8,stroke:#00A0B8,color:#002C54
  style side fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style draw fill:#006098,stroke:#002C54,color:#FFFFFF
  style sheet fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style map1 fill:#ACE0E8,stroke:#006098,color:#002C54
  style map2 fill:#ACE0E8,stroke:#006098,color:#002C54
  style map3 fill:#ACE0E8,stroke:#006098,color:#002C54
```

## Related

- [Architecture overview](../architecture/overview.md)
- [Context](../architecture/context.md)
- [Containers](../architecture/containers.md)
