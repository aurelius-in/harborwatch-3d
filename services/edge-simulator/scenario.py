"""Alder Harbor scenario: 20-100 movers on a fictional west-coast basin."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from contracts import SCHEMA_TRACK, envelope, utcnow, validate_track

SITE_ID = "alder-harbor"
ORIGIN = {"lat": 47.6264, "lon": -122.4098}

SENSORS = [
    {"sensor_id": "LIDAR-01", "lat": 47.6312, "lon": -122.4118},
    {"sensor_id": "LIDAR-02", "lat": 47.6224, "lon": -122.4072},
    {"sensor_id": "LIDAR-03", "lat": 47.6268, "lon": -122.4051},
    {"sensor_id": "LIDAR-04", "lat": 47.6279, "lon": -122.4146},
]

DEVICES = [
    {"device_id": "DEV-GW-01", "kind": "gateway", "lat": 47.6288, "lon": -122.4124},
    {"device_id": "DEV-RAD-01", "kind": "radio", "lat": 47.6241, "lon": -122.4066},
    {"device_id": "DEV-LIDAR-01", "kind": "lidar", "lat": 47.6312, "lon": -122.4118},
    {"device_id": "DEV-LIDAR-02", "kind": "lidar", "lat": 47.6224, "lon": -122.4072},
    {"device_id": "DEV-LIDAR-03", "kind": "lidar", "lat": 47.6268, "lon": -122.4051},
    {"device_id": "DEV-LIDAR-04", "kind": "lidar", "lat": 47.6279, "lon": -122.4146},
]


@dataclass
class Mover:
    track_id: str
    object_type: str
    phase: float
    radius: float
    speed: float
    lat0: float
    lon0: float
    sensor_id: str
    seq: int = 0


def build_movers(count: int) -> list[Mover]:
    count = max(20, min(100, count))
    movers: list[Mover] = []
    mix = (
        [("vessel", 0.42), ("vehicle", 0.28), ("person", 0.18), ("unknown", 0.12)]
    )
    assigned = 0
    for kind, share in mix:
        n = max(1, round(count * share))
        for i in range(n):
            if assigned >= count:
                break
            assigned += 1
            if kind == "vessel":
                lat0, lon0 = 47.6258 + random.uniform(-0.0015, 0.0018), -122.4088 + random.uniform(
                    -0.002, 0.002
                )
                radius = random.uniform(0.0006, 0.0018)
                speed = random.uniform(2.5, 7.5)
            elif kind == "vehicle":
                lat0, lon0 = 47.6294 + random.uniform(-0.0004, 0.0003), -122.4128 + random.uniform(
                    -0.0012, 0.0008
                )
                radius = random.uniform(0.00025, 0.00055)
                speed = random.uniform(3.0, 9.0)
            elif kind == "person":
                lat0, lon0 = 47.6286 + random.uniform(-0.0003, 0.0004), -122.4112 + random.uniform(
                    -0.0006, 0.0005
                )
                radius = random.uniform(0.00008, 0.00018)
                speed = random.uniform(0.8, 1.8)
            else:
                lat0, lon0 = 47.624 + random.uniform(-0.001, 0.002), -122.407 + random.uniform(
                    -0.002, 0.002
                )
                radius = random.uniform(0.0004, 0.0012)
                speed = random.uniform(1.0, 4.0)
            movers.append(
                Mover(
                    track_id=f"TRK-{assigned:04d}",
                    object_type=kind,
                    phase=random.random() * math.tau,
                    radius=radius,
                    speed=speed,
                    lat0=lat0,
                    lon0=lon0,
                    sensor_id=random.choice(SENSORS)["sensor_id"],
                )
            )
    return movers


def step_mover(mover: Mover, elapsed: float) -> dict:
    mover.seq += 1
    omega = mover.speed / max(mover.radius * 111_000, 8.0)
    angle = mover.phase + elapsed * omega
    if mover.object_type == "vehicle":
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
    return envelope("track", SCHEMA_TRACK, SITE_ID, payload, seq=mover.seq)


def sensor_payload(sensor_id: str, flapping: str | None) -> dict:
    status = "operational"
    if flapping == sensor_id:
        status = random.choice(["degraded", "offline", "operational"])
    return {
        "sensor_id": sensor_id,
        "site_id": SITE_ID,
        "status": status,
        "temperature_c": round(10 + random.random() * 6, 1),
        "humidity_percent": round(70 + random.random() * 15, 1),
        "visibility_meters": round(6000 + random.random() * 4000, 0),
        "wind_speed_mps": round(2 + random.random() * 6, 1),
        "wind_direction": round(random.uniform(0, 359), 0),
        "battery_percent": round(80 + random.random() * 20, 0),
        "timestamp": utcnow(),
    }


def environment_payload() -> dict:
    return {
        "site_id": SITE_ID,
        "visibility_meters": round(6500 + random.random() * 3500, 0),
        "wind_speed_mps": round(2.5 + random.random() * 5, 1),
        "wind_direction": round(180 + random.random() * 80, 0),
        "temperature_c": round(9.5 + random.random() * 5, 1),
        "sea_state": round(1 + random.random() * 2, 1),
        "timestamp": utcnow(),
    }


def device_payload(device: dict) -> dict:
    return {
        "device_id": device["device_id"],
        "site_id": SITE_ID,
        "kind": device["kind"],
        "connected": True,
        "latitude": device["lat"],
        "longitude": device["lon"],
        "last_heartbeat": utcnow(),
    }
