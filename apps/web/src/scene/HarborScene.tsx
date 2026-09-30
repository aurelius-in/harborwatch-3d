import { useEffect, useRef } from "react";
import type { DeviceStatus } from "@harborwatch/contracts";
import type { LayerState } from "../lib/store";
import type { SensorRecord, TrackRecord } from "../lib/api";
import { HarborWorld } from "./harborWorld";

interface Props {
  tracks: TrackRecord[];
  sensors: SensorRecord[];
  devices: DeviceStatus[];
  layers: LayerState;
  selectedId: string | null;
  windDir: number;
  visibility: number;
  onSelect: (id: string | null) => void;
}

export function HarborScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HarborWorld | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const world = new HarborWorld(hostRef.current, { onSelect: props.onSelect });
    worldRef.current = world;
    return () => {
      world.dispose();
      worldRef.current = null;
    };
  }, [props.onSelect]);

  useEffect(() => {
    worldRef.current?.syncTracks(props.tracks);
    worldRef.current?.setSelected(props.selectedId);
  }, [props.tracks, props.selectedId]);

  useEffect(() => {
    worldRef.current?.syncSensors(props.sensors);
  }, [props.sensors]);

  useEffect(() => {
    worldRef.current?.syncDevices(props.devices);
  }, [props.devices]);

  useEffect(() => {
    worldRef.current?.setLayers(props.layers);
  }, [props.layers]);

  useEffect(() => {
    worldRef.current?.setEnvironment(props.windDir, props.visibility);
  }, [props.windDir, props.visibility]);

  return <div className="scene-host" ref={hostRef} role="application" aria-label="HarborWatch 3D" />;
}
