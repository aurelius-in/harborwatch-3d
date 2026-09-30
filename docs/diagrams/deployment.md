<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="200" />
</p>

# Deployment diagrams

> Local Compose and a hosted staging or production shape.

## Local Compose

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
  subgraph laptop["Developer laptop"]
    web["apps/web :3000"]
    api["apps/api :5000"]
    sim["edge-simulator :8000"]
    pg["PostgreSQL"]
  end
  browser["Browser"]

  browser --> web
  web -->|"REST + WS"| api
  sim -->|"ingest"| api
  api --> pg

  style laptop fill:#E8F8F8,stroke:#002C54,color:#002C54
  style web fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style api fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style sim fill:#006098,stroke:#002C54,color:#FFFFFF
  style pg fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style browser fill:#ACE0E8,stroke:#006098,color:#002C54
```

## Hosted

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
  users["Operators"]
  cdn["CDN / SPA host"]
  idp["OIDC provider"]
  subgraph vpc["Application environment"]
    api["API replicas"]
    bus["Optional pub/sub"]
    db["Managed PostgreSQL"]
    sim["Simulator worker<br/>or real ingest"]
  end
  gis["ArcGIS platform"]

  users --> cdn
  users --> idp
  cdn --> api
  idp --> api
  sim --> api
  api --> bus
  api --> db
  cdn --> gis

  style users fill:#ACE0E8,stroke:#006098,color:#002C54
  style cdn fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style idp fill:#08345C,stroke:#ACE0E8,color:#FFFFFF
  style vpc fill:#E8F8F8,stroke:#002C54,color:#002C54
  style api fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style bus fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style db fill:#007CA8,stroke:#002850,color:#FFFFFF
  style sim fill:#006098,stroke:#002C54,color:#FFFFFF
  style gis fill:#ACE0E8,stroke:#006098,color:#002C54
```

## Pipeline

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
  pr["PR"] --> lint["lint"]
  lint --> unit["unit"]
  unit --> integ["integration"]
  integ --> build["web + image build"]
  build --> scan["security scan"]
  scan --> stage["staging"]
  stage --> smoke["smoke"]
  smoke --> approve["production approval"]

  style pr fill:#ACE0E8,stroke:#006098,color:#002C54
  style lint fill:#006098,stroke:#002C54,color:#FFFFFF
  style unit fill:#006098,stroke:#002C54,color:#FFFFFF
  style integ fill:#007CA8,stroke:#002C54,color:#FFFFFF
  style build fill:#002C54,stroke:#00A0B8,color:#FFFFFF
  style scan fill:#002C54,stroke:#ACE0E8,color:#FFFFFF
  style stage fill:#00A0B8,stroke:#002C54,color:#FFFFFF
  style smoke fill:#00A0B8,stroke:#002850,color:#FFFFFF
  style approve fill:#002C54,stroke:#00A0B8,color:#FFFFFF
```

## Related

- [Deployment](../architecture/deployment.md)
- [Testing](../architecture/testing.md)
- [Security](../architecture/security.md)
