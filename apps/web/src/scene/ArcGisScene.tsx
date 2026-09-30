import { useEffect, useRef } from "react";
import type { DeviceStatus, RestrictedZone, SiteConfiguration } from "@harborwatch/contracts";
import type { LayerState } from "../lib/store";
import type { SensorRecord, TrackRecord } from "../lib/api";
import { ORIGIN } from "../lib/geo";

interface Props {
  apiKey: string;
  tracks: TrackRecord[];
  sensors: SensorRecord[];
  devices: DeviceStatus[];
  site?: SiteConfiguration;
  layers: LayerState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFail: () => void;
}

type EsriView = {
  graphics: { removeAll: () => void; add: (g: unknown) => void };
  on: (event: string, cb: (ev: { graphic?: { attributes?: { track_id?: string } } }) => void) => void;
  destroy: () => void;
};

const trails = new Map<string, Array<{ lon: number; lat: number; z: number }>>();

export function ArcGisScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EsriView | null>(null);
  const GraphicRef = useRef<new (args: unknown) => unknown>();
  const PointRef = useRef<new (args: unknown) => unknown>();
  const PolylineRef = useRef<new (args: unknown) => unknown>();
  const PolygonRef = useRef<new (args: unknown) => unknown>();

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    trails.clear();

    loadArcGis()
      .then(() => {
        if (cancelled || !host) return;
        const requireFn = (window as unknown as { require: Function }).require;
        requireFn(
          [
            "esri/config",
            "esri/Map",
            "esri/views/SceneView",
            "esri/Graphic",
            "esri/geometry/Point",
            "esri/geometry/Polyline",
            "esri/geometry/Polygon",
            "esri/layers/GraphicsLayer",
          ],
          (
            esriConfig: { apiKey: string },
            EsriMap: new (args: unknown) => unknown,
            SceneView: new (args: unknown) => EsriView,
            Graphic: new (args: unknown) => unknown,
            Point: new (args: unknown) => unknown,
            Polyline: new (args: unknown) => unknown,
            Polygon: new (args: unknown) => unknown,
            GraphicsLayer: new () => unknown,
          ) => {
            esriConfig.apiKey = props.apiKey;
            GraphicRef.current = Graphic;
            PointRef.current = Point;
            PolylineRef.current = Polyline;
            PolygonRef.current = Polygon;
            const tracksLayer = new GraphicsLayer();
            const extrasLayer = new GraphicsLayer();
            const map = new EsriMap({
              basemap: "satellite",
              ground: "world-elevation",
              layers: [extrasLayer, tracksLayer],
            });
            const camera = props.site?.default_camera;
            const view = new SceneView({
              container: host,
              map,
              camera: {
                position: {
                  longitude: (camera?.longitude ?? ORIGIN.lon) - 0.01,
                  latitude: (camera?.latitude ?? ORIGIN.lat) - 0.012,
                  z: camera?.height ?? 420,
                },
                heading: 28,
                tilt: 62,
              },
            });
            view.on("click", (ev) => props.onSelect(ev.graphic?.attributes?.track_id ?? null));
            viewRef.current = view;
            (view as unknown as { tracksLayer: unknown; extrasLayer: unknown }).tracksLayer = tracksLayer;
            (view as unknown as { extrasLayer: unknown }).extrasLayer = extrasLayer;
          },
        );
      })
      .catch(() => {
        if (!cancelled) props.onFail();
      });

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [props.apiKey, props.onFail, props.onSelect, props.site?.site_id]);

  useEffect(() => {
    const view = viewRef.current as
      | (EsriView & {
          tracksLayer?: { removeAll: () => void; add: (g: unknown) => void };
          extrasLayer?: { removeAll: () => void; add: (g: unknown) => void };
        })
      | null;
    const Graphic = GraphicRef.current;
    const Point = PointRef.current;
    const Polyline = PolylineRef.current;
    const Polygon = PolygonRef.current;
    if (!view?.tracksLayer || !view.extrasLayer || !Graphic || !Point) return;

    view.tracksLayer.removeAll();
    view.extrasLayer.removeAll();

    if (props.layers.objectTracks) {
      for (const track of props.tracks) {
        const color = track.track_id === props.selectedId ? "#ACE0E8" : track.stale ? "#8aa0b4" : "#00A0B8";
        const graphic = new Graphic({
          geometry: new Point({
            longitude: track.longitude,
            latitude: track.latitude,
            z: track.altitude,
          }),
          attributes: { track_id: track.track_id },
          symbol: {
            type: "point-3d",
            symbolLayers: [
              {
                type: "object",
                resource: { primitive: track.object_type === "vessel" ? "cylinder" : "sphere" },
                width: track.object_type === "vessel" ? 12 : 6,
                height: 8,
                material: { color },
              },
            ],
          },
        });
        view.tracksLayer.add(graphic);
        const trail = trails.get(track.track_id) ?? [];
        trail.unshift({ lon: track.longitude, lat: track.latitude, z: track.altitude });
        if (trail.length > 24) trail.length = 24;
        trails.set(track.track_id, trail);
      }
    }

    if (props.layers.trackHistory && Polyline) {
      for (const [id, trail] of trails) {
        if (trail.length < 2) continue;
        view.extrasLayer.add(
          new Graphic({
            geometry: new Polyline({
              paths: [trail.map((p) => [p.lon, p.lat, p.z])],
            }),
            symbol: { type: "simple-line", color: "#ACE0E8", width: 1.5 },
            attributes: { track_id: id },
          }),
        );
      }
    }

    if (props.layers.sensors) {
      for (const sensor of props.sensors) {
        view.extrasLayer.add(
          new Graphic({
            geometry: new Point({ longitude: sensor.longitude, latitude: sensor.latitude, z: 8 }),
            symbol: {
              type: "simple-marker",
              color: sensor.telemetry?.status === "offline" ? "#8a2030" : "#00A0B8",
              size: 10,
            },
          }),
        );
      }
    }

    if (props.layers.devices) {
      for (const device of props.devices) {
        if (device.latitude === undefined || device.longitude === undefined) continue;
        view.extrasLayer.add(
          new Graphic({
            geometry: new Point({ longitude: device.longitude, latitude: device.latitude, z: 4 }),
            symbol: { type: "simple-marker", color: device.connected ? "#006098" : "#8aa0b4", size: 8 },
          }),
        );
      }
    }

    if (props.layers.restrictedZones && Polygon && props.site?.restricted_zones) {
      for (const zone of props.site.restricted_zones as RestrictedZone[]) {
        view.extrasLayer.add(
          new Graphic({
            geometry: new Polygon({ rings: zone.polygon.coordinates }),
            symbol: {
              type: "simple-fill",
              color: [0, 160, 184, 0.18],
              outline: { color: "#ACE0E8", width: 1 },
            },
          }),
        );
      }
    }
  }, [
    props.tracks,
    props.sensors,
    props.devices,
    props.layers,
    props.selectedId,
    props.site,
  ]);

  return <div className="scene-host arcgis-host" ref={hostRef} aria-label="HarborWatch 3D" />;
}

function loadArcGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { require?: Function }).require) {
      resolve();
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://js.arcgis.com/4.31/esri/themes/dark/main.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://js.arcgis.com/4.31/";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("ArcGIS SDK failed to load"));
    document.head.appendChild(script);
  });
}
