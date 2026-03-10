"""
DC TheftProtector — Python ML Server
Reads ESP32 serial output, trains a baseline model, detects anomalies,
and streams everything to the React frontend via WebSocket.

Usage:
    python server.py [COM_PORT]
    python server.py COM3

If no port is given, auto-detects the first USB serial device.
WebSocket server runs at ws://localhost:8765
"""

import asyncio
import json
import re
import sys
import time

import numpy as np
import serial
import serial.tools.list_ports
import websockets

# ── Config ───────────────────────────────────────────
SERIAL_BAUD = 115200
TRAINING_DURATION = 60  # seconds
Z_THRESHOLD = 3.0
WS_HOST = "localhost"
WS_PORT = 8765
MAX_EVENTS = 200


# ── ML Detector ─────────────────────────────────────
class TheftDetector:
    def __init__(self):
        self.reset()

    def reset(self):
        self.phase = "idle"
        self.training_data: list[dict] = []
        self.training_start = 0.0
        self.baseline: dict | None = None
        self.theft_detected = False
        self.theft_events: list[dict] = []
        self.training_progress = 0

    def start_training(self):
        self.phase = "training"
        self.training_data = []
        self.training_start = time.time()
        self.theft_detected = False
        self.theft_events = []
        self.training_progress = 0

    def process_reading(self, reading: dict):
        if self.phase == "training":
            self.training_data.append(reading)
            elapsed = time.time() - self.training_start
            self.training_progress = min(100, round((elapsed / TRAINING_DURATION) * 100))

            if elapsed >= TRAINING_DURATION:
                self._build_baseline()

        elif self.phase == "monitoring" and self.baseline:
            self._check_anomaly(reading)

    def _build_baseline(self):
        data = self.training_data
        if len(data) < 10:
            self.phase = "idle"
            return

        currents = np.array([d["current_mA"] for d in data])
        voltages = np.array([d["bus_V"] for d in data])
        powers = np.array([d["power_mW"] for d in data])

        self.baseline = {
            "meanCurrent": float(np.mean(currents)),
            "stdCurrent": float(np.std(currents)),
            "meanVoltage": float(np.mean(voltages)),
            "stdVoltage": float(np.std(voltages)),
            "meanPower": float(np.mean(powers)),
            "stdPower": float(np.std(powers)),
            "sampleCount": len(data),
            "trainedAt": time.time() * 1000,
        }

        self.phase = "monitoring"
        self.training_progress = 100
        self.training_data = []
        print(
            f"[ML] Baseline trained: "
            f"{self.baseline['meanCurrent']:.2f} ± {self.baseline['stdCurrent']:.2f} mA, "
            f"{self.baseline['sampleCount']} samples"
        )

    def _check_anomaly(self, reading: dict):
        bl = self.baseline
        curr_std = bl["stdCurrent"] if bl["stdCurrent"] > 0.01 else max(bl["meanCurrent"] * 0.05, 0.1)
        volt_std = bl["stdVoltage"] if bl["stdVoltage"] > 0.001 else max(bl["meanVoltage"] * 0.05, 0.01)

        curr_dev = abs(reading["current_mA"] - bl["meanCurrent"]) / curr_std
        volt_dev = abs(reading["bus_V"] - bl["meanVoltage"]) / volt_std

        self.theft_detected = False

        if reading["current_mA"] < bl["meanCurrent"] and curr_dev > Z_THRESHOLD:
            self.theft_detected = True
            self.theft_events.append({
                "timestamp": reading["timestamp"],
                "reading": reading,
                "deviation": round(curr_dev, 2),
                "type": "current_drop",
            })
        elif reading["current_mA"] > bl["meanCurrent"] and curr_dev > Z_THRESHOLD:
            self.theft_detected = True
            self.theft_events.append({
                "timestamp": reading["timestamp"],
                "reading": reading,
                "deviation": round(curr_dev, 2),
                "type": "current_spike",
            })

        if reading["bus_V"] < bl["meanVoltage"] and volt_dev > Z_THRESHOLD:
            self.theft_detected = True
            self.theft_events.append({
                "timestamp": reading["timestamp"],
                "reading": reading,
                "deviation": round(volt_dev, 2),
                "type": "voltage_drop",
            })

        # Cap stored events
        if len(self.theft_events) > MAX_EVENTS:
            self.theft_events = self.theft_events[-MAX_EVENTS:]

    def get_status(self) -> dict:
        return {
            "phase": self.phase,
            "trainingProgress": self.training_progress,
            "baseline": self.baseline,
            "theftDetected": self.theft_detected,
            "theftEvents": self.theft_events[-20:],  # send recent subset
        }


# ── Serial parser ───────────────────────────────────
LINE_RE = re.compile(
    r"Bus:\s*([\d.]+)\s*V\s+Current:\s*([\d.]+)\s*mA\s+Power:\s*([\d.]+)\s*mW"
)


def parse_serial_line(line: str) -> dict | None:
    m = LINE_RE.match(line.strip())
    if m:
        return {
            "bus_V": float(m.group(1)),
            "current_mA": float(m.group(2)),
            "power_mW": float(m.group(3)),
            "timestamp": time.time() * 1000,
        }
    return None


# ── WebSocket server ────────────────────────────────
clients: set = set()
detector = TheftDetector()


async def broadcast(msg: dict):
    if not clients:
        return
    data = json.dumps(msg)
    await asyncio.gather(
        *(c.send(data) for c in clients),
        return_exceptions=True,
    )


async def handle_client(websocket):
    clients.add(websocket)
    print(f"[WS] Client connected ({len(clients)} total)")

    # Send current ML status immediately so UI is in sync
    try:
        await websocket.send(json.dumps({"type": "ml_status", "data": detector.get_status()}))
    except Exception:
        pass

    try:
        async for message in websocket:
            try:
                cmd = json.loads(message)
                if cmd.get("type") == "retrain":
                    print("[ML] Retrain requested")
                    detector.start_training()
                    await broadcast({"type": "ml_status", "data": detector.get_status()})
            except json.JSONDecodeError:
                pass
    finally:
        clients.discard(websocket)
        print(f"[WS] Client disconnected ({len(clients)} total)")


# ── Serial reader loop ──────────────────────────────
async def serial_reader(port_name: str):
    print(f"[Serial] Opening {port_name} at {SERIAL_BAUD} baud...")
    loop = asyncio.get_event_loop()

    ser = serial.Serial(port_name, SERIAL_BAUD, timeout=1)
    print(f"[Serial] Connected to {port_name}")

    # Auto-start training
    detector.start_training()
    print(f"[ML] Training started ({TRAINING_DURATION}s window)...")

    last_status_time = 0.0

    while True:
        line_bytes = await loop.run_in_executor(None, ser.readline)
        if not line_bytes:
            continue

        try:
            text = line_bytes.decode("utf-8", errors="ignore").strip()
        except Exception:
            continue

        if not text:
            continue

        reading = parse_serial_line(text)
        if not reading:
            continue

        detector.process_reading(reading)

        # Broadcast the reading
        await broadcast({"type": "reading", "data": reading})

        # Broadcast ML status at most every 250ms to reduce traffic
        now = time.time()
        if now - last_status_time >= 0.25:
            last_status_time = now
            await broadcast({"type": "ml_status", "data": detector.get_status()})


# ── Port detection ──────────────────────────────────
def find_serial_port() -> str | None:
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        if any(kw in desc for kw in ("cp210", "ch340", "ftdi", "usb serial", "usb-serial")):
            return p.device
    # Fallback: first available port
    if ports:
        return ports[0].device
    return None


# ── Main ────────────────────────────────────────────
async def main():
    port = sys.argv[1] if len(sys.argv) > 1 else find_serial_port()
    if not port:
        print("No serial port found. Usage: python server.py [COM_PORT]")
        print("Available ports:")
        for p in serial.tools.list_ports.comports():
            print(f"  {p.device}: {p.description}")
        sys.exit(1)

    print(f"[Server] DC TheftProtector ML Server")
    print(f"[Server] WebSocket: ws://{WS_HOST}:{WS_PORT}")
    print(f"[Server] Serial: {port}")

    async with websockets.serve(handle_client, WS_HOST, WS_PORT):
        await serial_reader(port)


if __name__ == "__main__":
    asyncio.run(main())
