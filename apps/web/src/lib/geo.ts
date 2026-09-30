export interface GeoOrigin {
  lat: number;
  lon: number;
}

export const ORIGIN: GeoOrigin = { lat: 47.6264, lon: -122.4098 };

export function toLocal(
  lat: number,
  lon: number,
  origin: GeoOrigin = ORIGIN,
): { x: number; z: number } {
  const x = (lon - origin.lon) * 111320 * Math.cos((origin.lat * Math.PI) / 180);
  const z = -(lat - origin.lat) * 110540;
  return { x, z };
}

export function headingToYRotation(heading: number): number {
  return -((heading * Math.PI) / 180);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

export function lerpRadians(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.min(1, Math.max(0, t));
}

export function formatSpeed(mps: number): string {
  return `${mps.toFixed(1)} m/s`;
}

export function formatHeading(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return `${deg.toFixed(0)}° ${dirs[idx]}`;
}

export function timeAgo(iso: string): string {
  const delta = Date.now() - Date.parse(iso);
  if (!Number.isFinite(delta)) return "n/a";
  if (delta < 1000) return "now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s`;
  return `${Math.round(delta / 60_000)}m`;
}

export function siteOrigin(site?: { default_camera?: { latitude: number; longitude: number } }): GeoOrigin {
  if (!site?.default_camera) return ORIGIN;
  return { lat: site.default_camera.latitude, lon: site.default_camera.longitude };
}
