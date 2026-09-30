"""Fictional Alder Harbor and Cedar Inlet scenarios.

Emits normalized tracks, weather fronts, sensor dropouts, and zone crossings.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from contracts import SCHEMA_TRACK, envelope, utcnow, validate_track

SITES: dict[str, dict] = {
    "alder-harbor": {
        "prefix": "AH",
        "origin": {"lat": 47.6264, "lon": -122.4098},
        "sensors": [
            {"sensor_id": "LIDAR-01", "lat": 47.6312, "lon": -122.4118},
            {"sensor_id": "LIDAR-02", "lat": 47.6224, "lon": -122.4072},
            {"sensor_id": "LIDAR-03", "lat": 47.6268, "lon": -122.4051},
            {"sensor_id": "LIDAR-04", "lat": 47.6279, "lon": -122.4146},
        ],
        "devices": [
            {"device_id": "DEV-GW-01", "kind": "gateway", "lat": 47.6288, "lon": -122.4124},
            {"device_id": "DEV-RAD-01", "kind": "radio", "lat": 47.6241, "lon": -122.4066},
            {"device_id": "DEV-LIDAR-01", "kind": "lidar", "lat": 47.6312, "lon": -122.4118},
            {"device_id": "DEV-LIDAR-02", "kind": "lidar", "lat": 47.6224, "lon": -122.4072},
            {"device_id": "DEV-LIDAR-03", "kind": "lidar", "lat": 47.6268, "lon": -122.4051},
            {"device_id": "DEV-LIDAR-04", "kind": "lidar", "lat": 47.6279, "lon": -122.4146},
        ],
        "zone_seed": {"lat": 47.63, "lon": -122.4113},
        "vessel": {"lat": 47.6258, "lon": -122.4088},
        "vehicle": {"lat": 47.6294, "lon": -122.4128},
        "person": {"lat": 47.6286, "lon": -122.4112},
        "unknown": {"lat": 47.624, "lon": -122.407},
    },
    "cedar-inlet": {
        "prefix": "CI",
        "origin": {"lat": 47.2512, "lon": -122.4608},
        "sensors": [
            {"sensor_id": "LIDAR-C1", "lat": 47.2544, "lon": -122.4628},
            {"sensor_id": "LIDAR-C2", "lat": 47.2478, "lon": -122.4572},
            {"sensor_id": "LIDAR-C3", "lat": 47.2510, "lon": -122.4558},
            {"sensor_id": "LIDAR-C4", "lat": 47.2522, "lon": -122.4650},
        ],
        "devices": [
            {"device_id": "DEV-CI-GW-01", "kind": "gateway", "lat": 47.2526, "lon": -122.4634},
            {"device_id": "DEV-CI-RAD-01", "kind": "radio", "lat": 47.2484, "lon": -122.4568},
            {"device_id": "DEV-CI-LIDAR-01", "kind": "lidar", "lat": 47.2544, "lon": -122.4628},
            {"device_id": "DEV-CI-LIDAR-02", "kind": "lidar", "lat": 47.2478, "lon": -122.4572},
            {"device_id": "DEV-CI-LIDAR-03", "kind": "lidar", "lat": 47.2510, "lon": -122.4558},
            {"device_id": "DEV-CI-LIDAR-04", "kind": "lidar", "lat": 47.2522, "lon": -122.4650},
        ],
        "zone_seed": {"lat": 47.2534, "lon": -122.4623},
        "vessel": {"lat": 47.2504, "lon": -122.4596},
        "vehicle": {"lat": 47.2536, "lon": -122.4636},
        "person": {"lat": 47.2528, "lon": -122.4622},
        "unknown": {"lat": 47.2488, "lon": -122.4578},
    },
}

SITE_ID = "alder-harbor"
SENSORS = SITES[SITE_ID]["sensors"]
DEVICES = SITES[SITE_ID]["devices"]
ORIGIN = SITES[SITE_ID]["origin"]


@dataclass
class Mover:
    track_id: str
    site_id: str
    object_type: str
    home_type: str
    phase: float
    radius: float
    speed: float
    lat0: float
    lon0: float
    sensor_id: str
    seq: int = 0
    dropout_until: float = 0.0
    flip_until: float = 0.0
    zone_runner: bool = False


@dataclass
class Weather:
    vis_base: float = 8200.0
    wind_speed: float = 3.4
    wind_dir: float = 210.0
    temp_c: float = 11.0


def build_movers(count: int, site_id: str) -> list[Mover]:
    count = max(20, min(100, count))
    site = SITES[site_id]
    movers: list[Mover] = []
    mix = [("vessel", 0.42), ("vehicle", 0.28), ("person", 0.18), ("unknown", 0.12)]
    assigned = 0
    prefix = site["prefix"]
    for kind, share in mix:
        n = max(1, round(count * share))
        for _ in range(n):
            if assigned >= count:
                break
            assigned += 1
            if kind == "vessel":
                lat0 = site["vessel"]["lat"] + random.uniform(-0.0015, 0.0018)
                lon0 = site["vessel"]["lon"] + random.uniform(-0.002, 0.002)
                radius = random.uniform(0.0006, 0.0018)
                speed = random.uniform(2.5, 7.5)
            elif kind == "vehicle":
                lat0 = site["vehicle"]["lat"] + random.uniform(-0.0004, 0.0003)
                lon0 = site["vehicle"]["lon"] + random.uniform(-0.0012, 0.0008)
                radius = random.uniform(0.00025, 0.00055)
                speed = random.uniform(3.0, 9.0)
            elif kind == "person":
                lat0 = site["person"]["lat"] + random.uniform(-0.0003, 0.0004)
                lon0 = site["person"]["lon"] + random.uniform(-0.0006, 0.0005)
                radius = random.uniform(0.00008, 0.00018)
                speed = random.uniform(0.8, 1.8)
            else:
                lat0 = site["unknown"]["lat"] + random.uniform(-0.001, 0.002)
                lon0 = site["unknown"]["lon"] + random.uniform(-0.002, 0.002)
                radius = random.uniform(0.0004, 0.0012)
                speed = random.uniform(1.0, 4.0)
            movers.append(
                Mover(
                    track_id=f"{prefix}-{assigned:04d}",
                    site_id=site_id,
                    object_type=kind,
                    home_type=kind,
                    phase=random.random() * math.tau,
                    radius=radius,
                    speed=speed,
                    lat0=lat0,
                    lon0=lon0,
                    sensor_id=random.choice(site["sensors"])["sensor_id"],
                )
            )
    for mover in movers[:3]:
        mover.zone_runner = True
        mover.object_type = "vessel"
        mover.home_type = "vessel"
        mover.lat0 = site["zone_seed"]["lat"]
        mover.lon0 = site["zone_seed"]["lon"]
        mover.radius = 0.00035
        mover.speed = 4.2
    return movers


def maybe_flip(mover: Mover, now: float) -> None:
    if now < mover.flip_until:
        return
    if random.random() < 0.004:
        mover.object_type = "unknown" if mover.home_type != "unknown" else "vessel"
        mover.flip_until = now + 14
    else:
        mover.object_type = mover.home_type


def maybe_dropout(mover: Mover, now: float) -> bool:
    if now < mover.dropout_until:
        return True
    if random.random() < 0.0015:
        mover.dropout_until = now + random.uniform(8, 18)
        return True
    return False


def step_mover(mover: Mover, elapsed: float) -> dict | None:
    now = elapsed
    maybe_flip(mover, now)
    if maybe_dropout(mover, now):
        return None
    mover.seq += 1
    omega = mover.speed / max(mover.radius * 111_000, 8.0)
    angle = mover.phase + elapsed * omega
    if mover.zone_runner:
        lat = mover.lat0 + math.sin(angle) * mover.radius * 0.55
        lon = mover.lon0 + math.cos(angle) * mover.radius * 0.55
        alt = 0.4
    elif mover.object_type == "vehicle":
        lat = mover.lat0 + math.sin(angle) * mover.radius * 0.35
        lon = mover.lon0 + math.cos(angle * 0.5) * mover.radius
        alt = 2.4
    elif mover.object_type == "person":
        lat = mover.lat0 + math.sin(angle) * mover.radius
        lon = mover.lon0 + math.cos(angle * 1.3) * mover.radius
        alt = 1.7
    elif mover.object_type == "unknown":
        lat = mover.lat0 + math.sin(angle * 0.6) * mover.radius
        lon = mover.lon0 + math.cos(angle * 0.9) * mover.radius
        alt = random.uniform(0.0, 6.0)
    else:
        lat = mover.lat0 + math.sin(angle) * mover.radius
        lon = mover.lon0 + math.cos(angle) * mover.radius * 1.4
        alt = 0.5
    heading = (math.degrees(angle) + 90) % 360
    confidence = 0.92 if mover.object_type != "unknown" else random.uniform(0.28, 0.7)
    ts = utcnow()
    payload = {
        "track_id": mover.track_id,
        "object_type": mover.object_type,
        "latitude": lat,
        "longitude": lon,
        "altitude": alt,
        "speed_mps": mover.speed,
        "heading": heading,
        "confidence": round(confidence, 3),
        "sensor_id": mover.sensor_id,
        "timestamp": ts,
        "last_seen": ts,
    }
    validate_track(payload)
    return envelope("track", SCHEMA_TRACK, mover.site_id, payload, seq=mover.seq)


def weather_front(elapsed: float, weather: Weather) -> dict[str, float]:
    # A visibility trough every ~90 seconds so low-visibility alerts actually fire.
    phase = (elapsed % 90.0) / 90.0
    dip = math.exp(-((phase - 0.48) ** 2) / 0.012)
    visibility = weather.vis_base - 6400 * dip
    wind = weather.wind_speed + 4.5 * dip
    direction = (weather.wind_dir + 40 * math.sin(elapsed / 18.0)) % 360
    temp = weather.temp_c - 1.8 * dip
    return {
        "visibility_meters": max(400.0, visibility),
        "wind_speed_mps": wind,
        "wind_direction": direction,
        "temperature_c": temp,
        "sea_state": 1.2 + 1.6 * dip,
    }


def sensor_payload(site_id: str, sensor_id: str, flapping: str | None, weather: dict[str, float]) -> dict:
    status = "operational"
    if flapping == sensor_id:
        status = random.choice(["degraded", "offline", "operational"])
    return {
        "sensor_id": sensor_id,
        "site_id": site_id,
        "status": status,
        "temperature_c": round(weather["temperature_c"] + random.uniform(-0.4, 0.4), 1),
        "humidity_percent": round(70 + random.random() * 15, 1),
        "visibility_meters": round(weather["visibility_meters"] + random.uniform(-120, 120), 0),
        "wind_speed_mps": round(weather["wind_speed_mps"] + random.uniform(-0.4, 0.4), 1),
        "wind_direction": round(weather["wind_direction"], 0),
        "battery_percent": round(80 + random.random() * 20, 0),
        "timestamp": utcnow(),
    }


def environment_payload(site_id: str, weather: dict[str, float]) -> dict:
    return {
        "site_id": site_id,
        "visibility_meters": round(weather["visibility_meters"], 0),
        "wind_speed_mps": round(weather["wind_speed_mps"], 1),
        "wind_direction": round(weather["wind_direction"], 0),
        "temperature_c": round(weather["temperature_c"], 1),
        "sea_state": round(weather["sea_state"], 1),
        "timestamp": utcnow(),
    }


def device_payload(site_id: str, device: dict, now: float) -> dict:
    connected = True
    if int(now) % 97 == 0 and device["kind"] != "gateway":
        connected = False
    return {
        "device_id": device["device_id"],
        "site_id": site_id,
        "kind": device["kind"],
        "connected": connected,
        "latitude": device["lat"],
        "longitude": device["lon"],
        "last_heartbeat": utcnow(),
    }
