<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Geospatial

> SceneView, StreamLayer, coordinates, tracks, zones, and layers.

## Scene

The map is an ArcGIS **SceneView** when `VITE_ARCGIS_API_KEY` is set. Without a key, HarborWatch mounts a built-in WebGL harbor that still draws live tracks, trails, sensors, zones, and devices in the logo palette. The track store is the same either way.

The default camera looks at the selected site. Sites are fictional **Alder Harbor** and **Cedar Inlet**. The application does not ship operational charts.

<table>
<tr>
<td width="8" bgcolor="#002C54"></td>
<td>

<strong>Boundary.</strong> Coordinate-frame fusion, sensor bore-sighting, and real hydrographic products belong to the GIS and sensor teams. This app consumes WGS84 latitudes and longitudes on the contract.

</td>
</tr>
</table>

## StreamLayer

`StreamLayer` is the production binding a GIS team would use against an Esri stream service. This repository does not mount StreamLayer.

What it does instead:

- Subscribes to `/ws/tracks`.
- Groups observations by `track_id` in the client track store.
- On ArcGIS SceneView (when a key is present), upserts graphics by `track_id`, plus extra graphics for trails, sensors, zones, and devices.
- On the built-in harbor scene, moves meshes by the same IDs and interpolates pose.
- Expires tracks server-side (`EXPIRE_MS`) and dims them after `STALE_MS`.
- Renders 3D symbols by `object_type`.

Layer toggle **Track History** controls trail visibility.

## Coordinate contract

| Field | Unit | Frame |
|---|---|---|
| `latitude` | degrees | WGS84 |
| `longitude` | degrees | WGS84 |
| `altitude` | meters | Height above ellipsoid unless a site config says otherwise |
| `heading` | degrees | Clockwise from true north, 0 to 360 |
| `speed_mps` | meters / second | Horizontal speed |

If a future edge feed uses a local projected frame, the **API ingest adapter** converts to this contract. The React scene does not learn a second frame.

## Static layers

| Layer | Source | Toggle |
|---|---|---|
| Object Tracks | Track store / SceneView graphics or WebGL meshes | Object Tracks |
| Track History | Trail graphics from the same store | Track History |
| Sensors | `/api/sensors` plus telemetry socket | Sensors |
| Environmental Data | Overlay from telemetry (wind marker, visibility haze) | Environmental Data |
| Restricted Zones | Site GeoJSON from `/api/sites` | Restricted Zones |
| Device Locations | GPS of edge cabinets from `/api/devices` | Device Locations |

Restricted-zone hits are evaluated on the API (Operator+). The map only draws the polygons and alert badges.

## Interaction

- Click or tap a track: select ID, open inspector.
- Hover on desktop: tooltip with type and speed.
- Touch targets on phone are large. The inspector is a bottom sheet.
- Camera per site from `SiteConfiguration.default_camera`. Admin can rename a site. Camera bookmarks are not persisted.

## Symbology

Keep symbols readable on water and night basemaps. Prefer navy hulls and teal highlights so the console matches [`hw3d-logo.png`](../../hw3d-logo.png).

| Type | Cue |
|---|---|
| `vessel` | Hull glyph, teal wake |
| `vehicle` | Ground chevron |
| `person` | Small pin |
| `unknown` | Hollow diamond, lower confidence tint |

Confidence below 0.5 uses a dashed outline. Offline sensors render in deep navy with a sea-colored slash.

## Related

- [Realtime streaming](./realtime-streaming.md)
- [Components](./components.md)
- [Contracts](./contracts.md)
