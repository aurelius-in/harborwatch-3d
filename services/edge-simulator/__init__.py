"""HarborWatch 3D Python edge simulator.

This process stands in for detection and tracking. It emits TrackUpdate,
SensorTelemetry, EnvironmentalTelemetry, and DeviceStatus envelopes to
the Node ingest API. It does not simulate raw LiDAR or SLAM.
"""
