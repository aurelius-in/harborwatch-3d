<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="200" />
</p>

# Data-flow diagrams

> Track and telemetry movement from edge to SceneView.

## Track path

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
  e["Edge producer"]
  c["TrackUpdate contract"]
  i["API ingest"]
  b["Site board"]
  h["Sampled history"]
  s["/ws/tracks"]
  t["Client track store"]
  l["3D board"]

  e --> c --> i --> b
  b --> s --> t --> l
  b --> h

  style e fill:#006098,stroke:#002C54,color:#FFFFFF
  style c fill:#ACE0E8,stroke:#006098,color:#002C54
  style i fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style b fill:#002C54,stroke:#ACE0E8,color:#FFFFFF
  style h fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style s fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style t fill:#00A0B8,stroke:#002850,color:#FFFFFF
  style l fill:#002C54,stroke:#00A0B8,color:#FFFFFF
```

## Telemetry path

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
  d["Sensor devices"]
  env["EnvironmentalTelemetry"]
  st["SensorTelemetry"]
  ds["DeviceStatus"]
  api["API / streaming gateway"]
  w1["/ws/telemetry"]
  w2["/ws/status"]
  ui["Dashboard panels"]

  d --> env --> api
  d --> st --> api
  d --> ds --> api
  api --> w1 --> ui
  api --> w2 --> ui

  style d fill:#006098,stroke:#002C54,color:#FFFFFF
  style env fill:#ACE0E8,stroke:#006098,color:#002C54
  style st fill:#ACE0E8,stroke:#006098,color:#002C54
  style ds fill:#ACE0E8,stroke:#006098,color:#002C54
  style api fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style w1 fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style w2 fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style ui fill:#00A0B8,stroke:#002850,color:#FFFFFF
```

## Sequence (one update)

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#E8F8F8",
    "primaryTextColor": "#002C54",
    "lineColor": "#00A0B8",
    "actorBkg": "#ACE0E8",
    "actorTextColor": "#002C54",
    "actorBorder": "#006098",
    "signalColor": "#00A0B8",
    "signalTextColor": "#002C54"
  }
}}%%
sequenceDiagram
  participant Sim as Simulator
  participant API as apps/api
  participant WS as WebSocket
  participant Web as apps/web
  participant SV as SceneView

  Sim->>API: envelope + TrackUpdate
  API->>API: schema, RBAC, seq
  API->>WS: fan-out to site subscribers
  WS->>Web: upsert by track_id
  Web->>SV: upsert graphic or mesh by track_id
```

## Related

- [Data flow](../architecture/data-flow.md)
- [Realtime streaming](../architecture/realtime-streaming.md)
- [Contracts](../architecture/contracts.md)
