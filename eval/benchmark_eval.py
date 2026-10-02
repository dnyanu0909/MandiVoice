#!/usr/bin/env python3
"""
MandiVoice Benchmark Evaluation Suite
Module 5: APMC Voice Trade Extraction & MSP Verification Benchmark

Evaluates accuracy across:
- Entity extraction from Hindi / Hinglish mandi dialogue
- Math & Unit Conversion fidelity (metric standards: bori, quintal, mann, dharhi, kg)
- Government MSP price benchmark compliance flags
- End-to-end request latency (ms)
"""

import sys
import os
import io
import time
import json
import subprocess
import shutil

# If running under a Python interpreter without project dependencies (e.g. default python 3.14 on Windows),
# seamlessly re-execute using Python 3.12 where fastapi/sqlalchemy are installed.
try:
    import fastapi
    import sqlalchemy
except ImportError:
    py312 = r"C:\Users\dell\AppData\Local\Programs\Python\Python312\python.exe"
    if os.path.exists(py312) and os.path.normcase(sys.executable) != os.path.normcase(py312):
        sys.exit(subprocess.call([py312] + sys.argv))
    elif shutil.which("py"):
        sys.exit(subprocess.call(["py", "-3.12"] + sys.argv))

# Ensure stdout handles UTF-8 on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Benchmark Test Suite: 12 Realistic Mandi Dialogues
BENCHMARK_CASES = [
    {
        "id": 1,
        "transcript": "Ramesh ne Suresh se 20 bori gehun kharida 2300 rupaye prati quintal ke hisab se",
        "expected_commodity": "wheat",
        "expected_standard_kg": 1000.0,
        "expected_total_inr": 23000.0,
        "expected_below_msp": True,
    },
    {
        "id": 2,
        "transcript": "Manoj ji 50 quintal chana becha hai 5800 per quintal par buyer Sharma traders",
        "expected_commodity": "chana",
        "expected_standard_kg": 5000.0,
        "expected_total_inr": 290000.0,
        "expected_below_msp": False,
    },
    {
        "id": 3,
        "transcript": "Suraj ne 10 mann sarson 6200 rupaye prati quintal par becha",
        "expected_commodity": "mustard",
        "expected_standard_kg": 400.0,
        "expected_total_inr": 24800.0,
        "expected_below_msp": False,
    },
    {
        "id": 4,
        "transcript": "Kishan ne 100 bori dhaan 2100 rupaye prati quintal me liya",
        "expected_commodity": "paddy",
        "expected_standard_kg": 5000.0,
        "expected_total_inr": 105000.0,
        "expected_below_msp": True,
    },
    {
        "id": 5,
        "transcript": "Verma ji 15 quintal soybean 4500 per quintal me kharida",
        "expected_commodity": "soybean",
        "expected_standard_kg": 1500.0,
        "expected_total_inr": 67500.0,
        "expected_below_msp": True,
    },
    {
        "id": 6,
        "transcript": "Gupta traders ne 40 mann kapas 7500 per quintal par deal kiya",
        "expected_commodity": "cotton",
        "expected_standard_kg": 1600.0,
        "expected_total_inr": 120000.0,
        "expected_below_msp": False,
    },
    {
        "id": 7,
        "transcript": "8 dharhi gehu liya 25 rupaye kilo ke hisab se",
        "expected_commodity": "wheat",
        "expected_standard_kg": 40.0,
        "expected_total_inr": 1000.0,
        "expected_below_msp": False,
    },
    {
        "id": 8,
        "transcript": "50 bori sarson 5600 prati quintal buyer Patelji seller Ramu",
        "expected_commodity": "mustard",
        "expected_standard_kg": 2500.0,
        "expected_total_inr": 140000.0,
        "expected_below_msp": True,
    },
    {
        "id": 9,
        "transcript": "200 quintal dhaan 2400 rupaye prati quintal me bika",
        "expected_commodity": "paddy",
        "expected_standard_kg": 20000.0,
        "expected_total_inr": 480000.0,
        "expected_below_msp": False,
    },
    {
        "id": 10,
        "transcript": "30 bori chana 5400 per quintal buyer Singhania",
        "expected_commodity": "chana",
        "expected_standard_kg": 1500.0,
        "expected_total_inr": 81000.0,
        "expected_below_msp": True,
    },
    {
        "id": 11,
        "transcript": "10 quintal soybean 5100 prati quintal Mohan ne kharida",
        "expected_commodity": "soybean",
        "expected_standard_kg": 1000.0,
        "expected_total_inr": 51000.0,
        "expected_below_msp": False,
    },
    {
        "id": 12,
        "transcript": "25 mann kapas 6800 per quintal buyer Aggarwalji",
        "expected_commodity": "cotton",
        "expected_standard_kg": 1000.0,
        "expected_total_inr": 68000.0,
        "expected_below_msp": True,
    },
]


def execute_request(transcript: str, use_live_server: bool = False, live_url: str = "http://localhost:8000"):
    """Executes extraction via HTTP request or FastAPI TestClient fallback."""
    if use_live_server:
        import requests
        start = time.perf_counter()
        resp = requests.post(f"{live_url}/api/transcribe-and-extract", data={"transcript": transcript}, timeout=5)
        latency_ms = (time.perf_counter() - start) * 1000
        return resp.json(), latency_ms
    else:
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)
        start = time.perf_counter()
        resp = client.post("/api/transcribe-and-extract", data={"transcript": transcript})
        latency_ms = (time.perf_counter() - start) * 1000
        return resp.json(), latency_ms


def check_live_server(url: str = "http://localhost:8000") -> bool:
    """Checks if FastAPI server is actively running on localhost:8000."""
    try:
        import urllib.request
        with urllib.request.urlopen(f"{url}/api/msp-data", timeout=0.8) as response:
            return response.status == 200
    except Exception:
        return False


def run_benchmark():
    print("=" * 86)
    print("  MANDIVOICE BENCHMARK EVALUATION SUITE  (Module 5)")
    print("  Testing: Speech Entity Extraction | Metric Fidelity | APMC MSP Compliance")
    print("=" * 86)

    is_live = check_live_server()
    mode_str = "Live Server (http://localhost:8000)" if is_live else "FastAPI In-Memory Client"
    print(f"  Execution Target: {mode_str}\n")

    results = []
    total_latency = 0.0
    entity_correct = 0
    math_correct = 0
    msp_correct = 0

    header = f"{'#':<3} | {'Commodity':<9} | {'Kg (Std)':<10} | {'Total (INR)':<12} | {'Below MSP':<10} | {'Latency':<8} | {'Status'}"
    print(header)
    print("-" * 86)

    for case in BENCHMARK_CASES:
        t_id = case["id"]
        transcript = case["transcript"]
        exp_com = case["expected_commodity"]
        exp_kg = case["expected_standard_kg"]
        exp_tot = case["expected_total_inr"]
        exp_msp = case["expected_below_msp"]

        data, latency = execute_request(transcript, use_live_server=is_live)
        total_latency += latency
        trade = data.get("trade", {})

        actual_com = str(trade.get("commodity", "")).lower()
        actual_kg = float(trade.get("standard_quantity_kg", 0.0))
        actual_tot = float(trade.get("total_amount_inr", 0.0))
        actual_msp = bool(trade.get("below_msp", False))

        is_entity_ok = (actual_com == exp_com)
        is_math_ok = (abs(actual_kg - exp_kg) < 0.1) and (abs(actual_tot - exp_tot) < 1.0)
        is_msp_ok = (actual_msp == exp_msp)

        if is_entity_ok:
            entity_correct += 1
        if is_math_ok:
            math_correct += 1
        if is_msp_ok:
            msp_correct += 1

        all_ok = is_entity_ok and is_math_ok and is_msp_ok
        status_tag = "PASS" if all_ok else "FAIL"

        row = (
            f"{t_id:<3} | "
            f"{actual_com:<9} | "
            f"{actual_kg:<10.1f} | "
            f"INR {actual_tot:<8.0f} | "
            f"{str(actual_msp):<10} | "
            f"{latency:>6.1f}ms | "
            f"{status_tag}"
        )
        print(row)
        results.append({
            "id": t_id,
            "passed": all_ok,
            "entity": is_entity_ok,
            "math": is_math_ok,
            "msp": is_msp_ok,
            "latency": latency,
        })

    n = len(BENCHMARK_CASES)
    avg_latency = total_latency / n
    entity_pct = (entity_correct / n) * 100.0
    math_pct = (math_correct / n) * 100.0
    msp_pct = (msp_correct / n) * 100.0
    overall_pct = (sum(1 for r in results if r["passed"]) / n) * 100.0

    print("-" * 86)
    print("\n" + "=" * 86)
    print("  AGGREGATE BENCHMARK PERFORMANCE REPORT")
    print("=" * 86)
    print(f"  • Total Benchmark Test Cases : {n}")
    print(f"  • Entity Extraction Accuracy  : {entity_pct:.1f}% ({entity_correct}/{n})")
    print(f"  • Math & Weight Fidelity     : {math_pct:.1f}% ({math_correct}/{n})")
    print(f"  • MSP Benchmark Alert Accuracy: {msp_pct:.1f}% ({msp_correct}/{n})")
    print(f"  • Overall Pipeline Pass Rate : {overall_pct:.1f}%")
    print(f"  • Average Request Latency    : {avg_latency:.2f} ms")
    print("=" * 86)

    # Save structured json report for docs / pitch deck
    report_path = os.path.join(os.path.dirname(__file__), "benchmark_results.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_cases": n,
            "overall_pass_rate_pct": overall_pct,
            "entity_accuracy_pct": entity_pct,
            "math_fidelity_pct": math_pct,
            "msp_accuracy_pct": msp_pct,
            "average_latency_ms": round(avg_latency, 2),
            "results": results
        }, f, indent=2)
    print(f"\nBenchmark results artifact exported to: {report_path}\n")


if __name__ == "__main__":
    run_benchmark()
