"""HarborWatch 3D edge simulator. Emits normalized tracks, not raw LiDAR."""

from __future__ import annotations

import asyncio
import os
import time

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aiohttp import ClientSession, ClientTimeout, web

from contracts import SCHEMA_DEVICE, SCHEMA_ENV, SCHEMA_SENSOR, envelope
from scenario import (
    DEVICES,
    SENSORS,
    SITE_ID,
    build_movers,
    device_payload,
    environment_payload,
    sensor_payload,
    step_mover,
)

API_URL = os.environ.get("API_URL", "http://localhost:5000").rstrip("/")
INGEST_KEY = os.environ.get("INGEST_KEY", "harborwatch-ingest-dev")
TRACK_COUNT = int(os.environ.get("TRACK_COUNT", "48"))
PORT = int(os.environ.get("SIMULATOR_PORT", "8000"))

started = time.time()
ok_ingests = 0
failed_ingests = 0
last_error: str | None = None


async def post_ingest(session: ClientSession, body: dict) -> None:
    global ok_ingests, failed_ingests, last_error
    url = f"{API_URL}/api/ingest"
    try:
        async with session.post(
            url,
            json=body,
            headers={"X-Ingest-Key": INGEST_KEY, "Content-Type": "application/json"},
        ) as response:
            if response.status >= 400:
                failed_ingests += 1
                last_error = f"HTTP {response.status}"
            else:
                ok_ingests += 1
                last_error = None
    except Exception as exc:  # noqa: BLE001
        failed_ingests += 1
        last_error = str(exc)


async def run_loop(session: ClientSession) -> None:
    movers = build_movers(TRACK_COUNT)
    t0 = time.time()
    flap_until = 0.0
    flap_sensor: str | None = None
    tick = 0
    while True:
        elapsed = time.time() - t0
        now = time.time()
        if now > flap_until:
            if tick % 400 == 80:
                flap_sensor = SENSORS[tick % len(SENSORS)]["sensor_id"]
                flap_until = now + 12
            else:
                flap_sensor = None
        tasks = [post_ingest(session, step_mover(mover, elapsed)) for mover in movers]
        if tick % 8 == 0:
            for sensor in SENSORS:
                tasks.append(
                    post_ingest(
                        session,
                        envelope(
                            "sensor_telemetry",
                            SCHEMA_SENSOR,
                            SITE_ID,
                            sensor_payload(sensor["sensor_id"], flap_sensor),
                        ),
                    )
                )
            tasks.append(
                post_ingest(
                    session,
                    envelope("environment", SCHEMA_ENV, SITE_ID, environment_payload()),
                )
            )
        if tick % 15 == 0:
            for device in DEVICES:
                tasks.append(
                    post_ingest(
                        session,
                        envelope("device_status", SCHEMA_DEVICE, SITE_ID, device_payload(device)),
                    )
                )
        await asyncio.gather(*tasks)
        tick += 1
        await asyncio.sleep(0.45)


async def health(_request: web.Request) -> web.Response:
    return web.json_response(
        {
            "status": "ok" if last_error is None or ok_ingests > 0 else "degraded",
            "service": "edge-simulator",
            "site_id": SITE_ID,
            "track_count": TRACK_COUNT,
            "ok_ingests": ok_ingests,
            "failed_ingests": failed_ingests,
            "last_error": last_error,
            "uptime_s": round(time.time() - started, 1),
        }
    )


async def main() -> None:
    app = web.Application()
    app.router.add_get("/health", health)
    app.router.add_get("/api/health", health)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    timeout = ClientTimeout(total=8)
    async with ClientSession(timeout=timeout) as session:
        while True:
            try:
                await run_loop(session)
            except Exception as exc:  # noqa: BLE001
                print(f"simulator loop error: {exc}")
                await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
