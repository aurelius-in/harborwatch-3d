export const SITE_ID = "alder-harbor";

export const SITE = {
  site_id: SITE_ID,
  name: "Alder Harbor",
  extent: { xmin: -122.425, ymin: 47.618, xmax: -122.395, ymax: 47.638 },
  default_camera: { longitude: -122.41, latitude: 47.626, height: 420 },
  restricted_zones: [
    {
      zone_id: "zone-fuel",
      name: "Fuel pier",
      polygon: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-122.4122, 47.6294],
            [-122.4104, 47.6294],
            [-122.4104, 47.6306],
            [-122.4122, 47.6306],
            [-122.4122, 47.6294],
          ],
        ],
      },
    },
    {
      zone_id: "zone-inner",
      name: "Inner basin",
      polygon: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-122.4078, 47.6238],
            [-122.4056, 47.6238],
            [-122.4056, 47.6254],
            [-122.4078, 47.6254],
            [-122.4078, 47.6238],
          ],
        ],
      },
    },
  ],
};

export const SENSORS = [
  {
    sensor_id: "LIDAR-01",
    name: "North pier",
    latitude: 47.6312,
    longitude: -122.4118,
  },
  {
    sensor_id: "LIDAR-02",
    name: "South quay",
    latitude: 47.6224,
    longitude: -122.4072,
  },
  {
    sensor_id: "LIDAR-03",
    name: "Channel",
    latitude: 47.6268,
    longitude: -122.4051,
  },
  {
    sensor_id: "LIDAR-04",
    name: "Gate",
    latitude: 47.6279,
    longitude: -122.4146,
  },
];

export function pointInPolygon(
  lon: number,
  lat: number,
  rings: number[][][],
): boolean {
  const ring = rings[0] ?? [];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
