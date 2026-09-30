import type { DeviceKind, SiteConfiguration } from "@harborwatch/contracts";

export interface SensorMeta {
  sensor_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface DeviceMeta {
  device_id: string;
  kind: DeviceKind;
  latitude: number;
  longitude: number;
}

export interface SiteDefinition extends SiteConfiguration {
  sensors: SensorMeta[];
  devices: DeviceMeta[];
}

export const ALDER_HARBOR: SiteDefinition = {
  site_id: "alder-harbor",
  name: "Alder Harbor",
  extent: { xmin: -122.425, ymin: 47.618, xmax: -122.395, ymax: 47.638 },
  default_camera: { longitude: -122.41, latitude: 47.626, height: 420 },
  restricted_zones: [
    {
      zone_id: "zone-fuel",
      name: "Fuel pier",
      polygon: {
        type: "Polygon",
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
        type: "Polygon",
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
  sensors: [
    { sensor_id: "LIDAR-01", name: "North pier", latitude: 47.6312, longitude: -122.4118 },
    { sensor_id: "LIDAR-02", name: "South quay", latitude: 47.6224, longitude: -122.4072 },
    { sensor_id: "LIDAR-03", name: "Channel", latitude: 47.6268, longitude: -122.4051 },
    { sensor_id: "LIDAR-04", name: "Gate", latitude: 47.6279, longitude: -122.4146 },
  ],
  devices: [
    { device_id: "DEV-GW-01", kind: "gateway", latitude: 47.6288, longitude: -122.4124 },
    { device_id: "DEV-RAD-01", kind: "radio", latitude: 47.6241, longitude: -122.4066 },
    { device_id: "DEV-LIDAR-01", kind: "lidar", latitude: 47.6312, longitude: -122.4118 },
    { device_id: "DEV-LIDAR-02", kind: "lidar", latitude: 47.6224, longitude: -122.4072 },
    { device_id: "DEV-LIDAR-03", kind: "lidar", latitude: 47.6268, longitude: -122.4051 },
    { device_id: "DEV-LIDAR-04", kind: "lidar", latitude: 47.6279, longitude: -122.4146 },
  ],
};

export const CEDAR_INLET: SiteDefinition = {
  site_id: "cedar-inlet",
  name: "Cedar Inlet",
  extent: { xmin: -122.475, ymin: 47.242, xmax: -122.445, ymax: 47.262 },
  default_camera: { longitude: -122.461, latitude: 47.251, height: 420 },
  restricted_zones: [
    {
      zone_id: "zone-cedar-fuel",
      name: "Cedar fuel dock",
      polygon: {
        type: "Polygon",
        coordinates: [
          [
            [-122.4632, 47.2528],
            [-122.4614, 47.2528],
            [-122.4614, 47.254],
            [-122.4632, 47.254],
            [-122.4632, 47.2528],
          ],
        ],
      },
    },
    {
      zone_id: "zone-cedar-mill",
      name: "Mill basin",
      polygon: {
        type: "Polygon",
        coordinates: [
          [
            [-122.4588, 47.2488],
            [-122.4566, 47.2488],
            [-122.4566, 47.2504],
            [-122.4588, 47.2504],
            [-122.4588, 47.2488],
          ],
        ],
      },
    },
  ],
  sensors: [
    { sensor_id: "LIDAR-C1", name: "North breakwater", latitude: 47.2544, longitude: -122.4628 },
    { sensor_id: "LIDAR-C2", name: "Mill dock", latitude: 47.2478, longitude: -122.4572 },
    { sensor_id: "LIDAR-C3", name: "Channel", latitude: 47.251, longitude: -122.4558 },
    { sensor_id: "LIDAR-C4", name: "Gate", latitude: 47.2522, longitude: -122.465 },
  ],
  devices: [
    { device_id: "DEV-CI-GW-01", kind: "gateway", latitude: 47.2526, longitude: -122.4634 },
    { device_id: "DEV-CI-RAD-01", kind: "radio", latitude: 47.2484, longitude: -122.4568 },
    { device_id: "DEV-CI-LIDAR-01", kind: "lidar", latitude: 47.2544, longitude: -122.4628 },
    { device_id: "DEV-CI-LIDAR-02", kind: "lidar", latitude: 47.2478, longitude: -122.4572 },
    { device_id: "DEV-CI-LIDAR-03", kind: "lidar", latitude: 47.251, longitude: -122.4558 },
    { device_id: "DEV-CI-LIDAR-04", kind: "lidar", latitude: 47.2522, longitude: -122.465 },
  ],
};

export const SITE_CATALOG: SiteDefinition[] = [ALDER_HARBOR, CEDAR_INLET];
export const SITES_BY_ID: Record<string, SiteDefinition> = Object.fromEntries(
  SITE_CATALOG.map((site) => [site.site_id, site]),
);
export const SITE_IDS = SITE_CATALOG.map((site) => site.site_id);
export const SITE_ID = ALDER_HARBOR.site_id;
export const SITE = ALDER_HARBOR;
export const SENSORS = ALDER_HARBOR.sensors;

export function getSite(siteId: string): SiteDefinition | undefined {
  return SITES_BY_ID[siteId];
}

export function knownSite(siteId: string): boolean {
  return Boolean(SITES_BY_ID[siteId]);
}

export function toSiteConfiguration(site: SiteDefinition): SiteConfiguration {
  return {
    site_id: site.site_id,
    name: site.name,
    extent: site.extent,
    default_camera: site.default_camera,
    restricted_zones: site.restricted_zones,
  };
}

export function pointInPolygon(lon: number, lat: number, rings: number[][][]): boolean {
  const ring = rings[0] ?? [];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
