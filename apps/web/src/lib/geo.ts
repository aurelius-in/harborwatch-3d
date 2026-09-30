export const ORIGIN = { lat: 47.6264, lon: -122.4098 };

export function toLocal(lat: number, lon: number): { x: number; z: number } {
  const x = (lon - ORIGIN.lon) * 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
  const z = -(lat - ORIGIN.lat) * 110540;
  return { x, z };
}

export function headingToYRotation(heading: number): number {
  return -((heading * Math.PI) / 180);
}

export function formatSpeed(mps: number): string {
  return `${mps.toFixed(1)} m/s`;
}

export function formatHeading(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return `${deg.toFixed(0)}° ${dirs[idx]}`;
}

export function timeAgo(iso: string): string {
  const delta = Date.now() - Date.parse(iso);
  if (!Number.isFinite(delta)) return "n/a";
  if (delta < 1000) return "now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s`;
  return `${Math.round(delta / 60_000)}m`;
}
