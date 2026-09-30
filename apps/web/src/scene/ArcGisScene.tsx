import { useEffect, useRef } from "react";
import type { LayerState } from "../lib/store";
import type { SensorRecord, TrackRecord } from "../lib/api";
import { ORIGIN } from "../lib/geo";

interface Props {
  apiKey: string;
  tracks: TrackRecord[];
  sensors: SensorRecord[];
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

export function ArcGisScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EsriView | null>(null);
  const GraphicRef = useRef<new (args: unknown) => unknown>();
  const PointRef = useRef<new (args: unknown) => unknown>();

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

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
            "esri/layers/GraphicsLayer",
          ],
          (
            esriConfig: { apiKey: string },
            EsriMap: new (args: unknown) => unknown,
            SceneView: new (args: unknown) => EsriView,
            Graphic: new (args: unknown) => unknown,
            Point: new (args: unknown) => unknown,
            GraphicsLayer: new () => unknown,
          ) => {
            esriConfig.apiKey = props.apiKey;
            GraphicRef.current = Graphic;
            PointRef.current = Point;
            const tracksLayer = new GraphicsLayer();
            const map = new EsriMap({
              basemap: "satellite",
              ground: "world-elevation",
              layers: [tracksLayer],
            });
            const view = new SceneView({
              container: host,
              map,
              camera: {
                position: {
                  longitude: ORIGIN.lon - 0.01,
                  latitude: ORIGIN.lat - 0.012,
                  z: 420,
                },
                heading: 28,
                tilt: 62,
              },
            });
            view.on("click", (ev) => props.onSelect(ev.graphic?.attributes?.track_id ?? null));
            viewRef.current = view;
            (view as unknown as { tracksLayer: unknown }).tracksLayer = tracksLayer;
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
  }, [props.apiKey, props.onFail, props.onSelect]);

  useEffect(() => {
    const view = viewRef.current as (EsriView & { tracksLayer?: { removeAll: () => void; add: (g: unknown) => void } }) | null;
    const Graphic = GraphicRef.current;
    const Point = PointRef.current;
    if (!view?.tracksLayer || !Graphic || !Point || !props.layers.objectTracks) {
      view?.tracksLayer?.removeAll();
      return;
    }
    view.tracksLayer.removeAll();
    for (const track of props.tracks) {
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
              material: { color: track.track_id === props.selectedId ? "#ACE0E8" : "#00A0B8" },
            },
          ],
        },
      });
      view.tracksLayer.add(graphic);
    }
  }, [props.tracks, props.layers.objectTracks, props.selectedId]);

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
