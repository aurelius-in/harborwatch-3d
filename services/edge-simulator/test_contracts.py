import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contracts import validate_track

FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "packages"
    / "contracts"
    / "fixtures"
    / "track-update.json"
)


def test_golden_track_fixture_parses_in_python():
    envelope = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert envelope["schema"] == "harborwatch.track/1"
    validate_track(envelope["payload"])


def test_missing_speed_mps_is_rejected():
    envelope = json.loads(FIXTURE.read_text(encoding="utf-8"))
    del envelope["payload"]["speed_mps"]
    try:
        validate_track(envelope["payload"])
        raise AssertionError("expected missing speed_mps to fail")
    except ValueError as exc:
        assert "speed_mps" in str(exc)
