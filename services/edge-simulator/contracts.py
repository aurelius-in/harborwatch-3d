"""Mirror of packages/contracts field names for the Python edge simulator."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

SCHEMA_TRACK = "harborwatch.track/1"
SCHEMA_SENSOR = "harborwatch.sensor_telemetry/1"
SCHEMA_ENV = "harborwatch.environment/1"
SCHEMA_DEVICE = "harborwatch.device_status/1"

OBJECT_TYPES = ("vessel", "vehicle", "person", "unknown")


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def envelope(kind: str, schema: str, site_id: str, payload: dict[str, Any], seq: int | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": kind,
        "schema": schema,
        "site_id": site_id,
        "sent_at": utcnow(),
        "payload": payload,
    }
    if seq is not None:
        body["seq"] = seq
    return body


def validate_track(payload: dict[str, Any]) -> None:
    required = (
        "track_id",
        "object_type",
        "latitude",
        "longitude",
        "altitude",
        "speed_mps",
        "heading",
        "confidence",
        "sensor_id",
        "timestamp",
        "last_seen",
    )
    for field in required:
        if field not in payload:
            raise ValueError(f"missing {field}")
    if payload["object_type"] not in OBJECT_TYPES:
        raise ValueError("invalid object_type")
    if not 0 <= float(payload["confidence"]) <= 1:
        raise ValueError("confidence must be 0 to 1")
