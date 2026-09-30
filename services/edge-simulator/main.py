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
    SITES,
    Weather,
    build_movers,
    device_payload,
    environment_payload,
    sensor_payload,
    step_mover,
    weather_front,
)

API_URL = os.environ.get("API_URL", "http://localhost:5000").rstrip("/")
INGEST_KEY = os.environ.get("INGEST_KEY", "harborwatch-ingest-dev")
TRACK_COUNT = int(os.environ.get("TRACK_COUNT", "48"))
PORT = int(os.environ.get("SIMULATOR_PORT", "8000"))
SITE_IDS = [
    item.strip()
    for item in os.environ.get("SITE_IDS", os.environ.get("SITE_ID", "alder-harbor,cedar-inlet")).split(",")
    if item.strip() and item.strip() in SITES
]
if not SITE_IDS:
    SITE_IDS = ["alder-harbor"]

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
    fleets: dict[str, list] = {}
    weather = {site_id: Weather() for site_id in SITE_IDS}
    for index, site_id in enumerate(SITE_IDS):
        count = TRACK_COUNT if index == 0 else max(20, TRACK_COUNT // 2)
        fleets[site_id] = build_movers(count, site_id)
    t0 = time.time()
    flap_until = 0.0
    flap_sensor: str | None = None
    tick = 0
    while True:
        elapsed = time.time() - t0
        now = time.time()
        if now > flap_until:
            if tick % 280 == 40:
                site = SITES[SITE_IDS[tick % len(SITE_IDS)]]
                flap_sensor = site["sensors"][tick % len(site["sensors"])]["sensor_id"]
                flap_until = now + 14
            else:
                flap_sensor = None
        tasks = []
        for site_id, movers in fleets.items():
            wx = weather_front(elapsed + (0 if site_id == "alder-harbor" else 22), weather[site_id])
            for mover in movers:
                body = step_mover(mover, elapsed)
                if body is not None:
                    tasks.append(post_ingest(session, body))
            if tick % 8 == 0:
                for sensor in SITES[site_id]["sensors"]:
                    tasks.append(
                        post_ingest(
                            session,
                            envelope(
                                "sensor_telemetry",
                                SCHEMA_SENSOR,
                                site_id,
                                sensor_payload(site_id, sensor["sensor_id"], flap_sensor, wx),
                            ),
                        )
                    )
                tasks.append(
                    post_ingest(
                        session,
                        envelope("environment", SCHEMA_ENV, site_id, environment_payload(site_id, wx)),
                    )
                )
            if tick % 15 == 0:
                for device in SITES[site_id]["devices"]:
                    tasks.append(
                        post_ingest(
                            session,
                            envelope(
                                "device_status",
                                SCHEMA_DEVICE,
                                site_id,
                                device_payload(site_id, device, elapsed),
                            ),
                        )
                    )
        if tasks:
            await asyncio.gather(*tasks)
        tick += 1
        await asyncio.sleep(0.45)


async def health(_request: web.Request) -> web.Response:
    return web.json_response(
        {
            "status": "ok" if last_error is None or ok_ingests > 0 else "degraded",
            "service": "edge-simulator",
            "site_ids": SITE_IDS,
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
