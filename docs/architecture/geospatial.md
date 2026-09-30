<p align="center">
  <img src="../../hw3d-logo.png" alt="HarborWatch 3D" width="160" />
</p>

# Geospatial

> SceneView, StreamLayer, coordinates, tracks, zones, and layers.

## Scene

The map is an ArcGIS **SceneView**. The default camera looks at a fictional harbor extent used by the simulator. Basemap and elevation come from the ArcGIS platform. The application does not ship classified charts.

<table>
<tr>
<td width="8" bgcolor="#002C54"></td>
<td>

<strong>Boundary.</strong> Coordinate-frame fusion, sensor bore-sighting, and real hydrographic products belong to the GIS and sensor teams. This app consumes WGS84 latitudes and longitudes on the contract.

</td>
</tr>
</table>

## StreamLayer

`StreamLayer` is the live object layer:

- Connects to the custom `/ws/tracks` WebSocket (or a small adapter that speaks the StreamLayer protocol).
- Groups observations by `track_id`.
- Applies purge and maximum-age rules so the browser does not accumulate thousands of old points.
- Renders 3D symbols by `object_type`.

Trails are either StreamLayer track history or a companion graphics layer fed from the same store. Layer toggle **Track History** controls visibility.

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
| Object Tracks | StreamLayer | Object Tracks |
| Track History | Stream history or trail graphics | Track History |
| Sensors | Feature layer from `/api/sensors` | Sensors |
| Environmental Data | Overlay from telemetry (wind barbs, visibility tint) | Environmental Data |
| Restricted Zones | Site GeoJSON from config | Restricted Zones |
| Device Locations | GPS of edge cabinets or patrol units | Device Locations |

Restricted-zone hits are evaluated on the API (Operator+). The map only draws the polygons and alert badges.

## Interaction

- Click or tap a track: select ID, open inspector.
- Hover on desktop: tooltip with type and speed.
- Touch targets on phone are large. The inspector is a bottom sheet.
- Camera bookmarks per site (Admin can save).

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
