"""
IoT Health Data Simulator (Enhanced)
Simulates ESP32 + MAX30102 + DS18B20 sensor readings with scenario repeatability.
Features:
- Single-instance PID lockfile prevention of uncontrolled duplicate processes.
- Repeatable synthetic scenarios (normal, gradual deterioration, sudden spike, missing, stale, duplicate, noisy).
- Clear synthetic data provenance labeling on every payload.
- Client-side pre-transmission validation checks.
"""

import argparse
import atexit
import math
import os
import signal
import sys
import time
import requests
from datetime import datetime, timezone

from scenario_generator import (
    SyntheticScenarioGenerator,
    ALL_SCENARIOS,
    SCENARIO_NORMAL
)

# Fix Windows console encoding
if os.name == 'nt':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:3001/api/health-data")
DEVICE_ID = os.getenv("DEVICE_ID", "SIM-ESP32-001")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "cfa9972e0f9d2cf9d369e2558abdc26e9e614fd13e977732799b3dd4db03c062")

PID_DIR = os.path.dirname(os.path.abspath(__file__))

def get_pid_path(patient_id):
    safe_pid = patient_id.replace("/", "_").replace("\\", "_")
    return os.path.join(PID_DIR, f"simulator_{safe_pid}.pid")

def is_pid_running(pid):
    """Check if process with given PID is currently active."""
    if pid <= 0:
        return False
    if os.name == 'nt':
        import ctypes
        kernel32 = ctypes.windll.kernel32
        SYNCHRONIZE = 0x00100000
        process = kernel32.OpenProcess(SYNCHRONIZE, False, pid)
        if process:
            kernel32.CloseHandle(process)
            return True
        return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

def acquire_pid_lock(patient_id):
    """Ensure only one simulator process runs per patient ID."""
    pid_file = get_pid_path(patient_id)
    if os.path.exists(pid_file):
        try:
            with open(pid_file, 'r') as f:
                existing_pid = int(f.read().strip())
            if is_pid_running(existing_pid):
                print(f"\n[ERROR] Simulator is already running for patient '{patient_id}' (PID: {existing_pid}).")
                print("To stop it, run:")
                print(f"  python iot_simulator.py {patient_id} --stop\n")
                sys.exit(1)
            else:
                # Stale PID file
                os.remove(pid_file)
        except Exception:
            pass

    current_pid = os.getpid()
    with open(pid_file, 'w') as f:
        f.write(str(current_pid))

    def cleanup():
        try:
            if os.path.exists(pid_file):
                os.remove(pid_file)
        except Exception:
            pass

    atexit.register(cleanup)
    return cleanup

def stop_existing_simulator(patient_id):
    """Gracefully stop an existing simulator for a given patient."""
    pid_file = get_pid_path(patient_id)
    if not os.path.exists(pid_file):
        print(f"[INFO] No running simulator lock found for patient '{patient_id}'.")
        return True

    try:
        with open(pid_file, 'r') as f:
            target_pid = int(f.read().strip())
        if is_pid_running(target_pid):
            print(f"[INFO] Terminating simulator process (PID {target_pid})...")
            if os.name == 'nt':
                os.system(f"taskkill /PID {target_pid} /F >nul 2>&1")
            else:
                os.kill(target_pid, signal.SIGTERM)
            time.sleep(0.5)
            print("[OK] Simulator process stopped successfully.")
        else:
            print("[INFO] Lock file was stale (process was not active). Cleaned up.")
        if os.path.exists(pid_file):
            os.remove(pid_file)
        return True
    except Exception as e:
        print(f"[ERROR] Failed to stop process: {e}")
        return False

def validate_client_payload(payload):
    """Pre-transmission client-side validation check."""
    missing = []
    for f in ['patientId', 'deviceId', 'heartRate', 'spO2', 'temperature']:
        if f not in payload or payload[f] is None:
            missing.append(f)
    if missing:
        return False, f"Missing fields: {', '.join(missing)}"
    
    hr = payload['heartRate']
    spo2 = payload['spO2']
    temp = payload['temperature']

    if hr < 20 or hr > 260:
        return False, f"Heart rate {hr} bpm is outside plausible bounds (20-260)"
    if spo2 < 50 or spo2 > 100:
        return False, f"SpO2 {spo2}% is outside plausible bounds (50-100)"
    if temp < 32.0 or temp > 43.0:
        return False, f"Temperature {temp}°C is outside plausible bounds (32-43)"

    return True, "Valid"

def main():
    parser = argparse.ArgumentParser(description="Smart Healthcare IoT Sensor Telemetry Simulator")
    parser.add_argument("patient", nargs="?", default="PT-00001", help="Patient ID to simulate (default: PT-00001) or 'ALL' for all patients")
    parser.add_argument("--all", action="store_true", help="Simulate telemetry for all patients simultaneously")
    parser.add_argument("--scenario", choices=ALL_SCENARIOS, default=SCENARIO_NORMAL, help="Synthetic scenario to execute")
    parser.add_argument("--seed", type=int, default=42, help="Pseudorandom seed for repeatability")
    parser.add_argument("--count", type=int, default=None, help="Number of readings to generate (default: continuous)")
    parser.add_argument("--interval", type=float, default=3.0, help="Interval in seconds between readings")
    parser.add_argument("--dry-run", action="store_true", help="Validate and display readings locally without network HTTP POST")
    parser.add_argument("--stop", action="store_true", help="Stop any active simulator running for this patient or ALL")

    args = parser.parse_args()

    is_all_mode = args.all or args.patient.upper() == "ALL"

    ALL_PATIENT_CONFIGS = [
        {"id": "PT-00001", "name": "Amit Kumar",   "scenario": args.scenario if args.scenario != SCENARIO_NORMAL else "gradual_deterioration", "seed": args.seed + 1},
        {"id": "PT-00002", "name": "Sneha Patel",  "scenario": "normal", "seed": args.seed + 2},
        {"id": "PT-00003", "name": "Ravi Verma",   "scenario": "sudden_spike", "seed": args.seed + 3},
        {"id": "PT-00004", "name": "Anjali Singh", "scenario": "normal", "seed": args.seed + 4},
        {"id": "PT-00005", "name": "Vikram Joshi", "scenario": "normal", "seed": args.seed + 5},
    ]

    target_lock_id = "ALL" if is_all_mode else args.patient

    if args.stop:
        if is_all_mode:
            stop_existing_simulator("ALL")
            for p in ALL_PATIENT_CONFIGS:
                stop_existing_simulator(p["id"])
        else:
            stop_existing_simulator(args.patient)
        sys.exit(0)

    # Acquire PID lock to prevent uncontrolled duplicate processes
    acquire_pid_lock(target_lock_id)

    print("\n" + "=" * 64)
    print("  Smart Healthcare IoT Simulator — Multi-Patient Telemetry")
    print("  " + "-" * 60)
    if is_all_mode:
        print(f"  Mode:         ALL PATIENTS (Simulating 5 patients concurrently)")
        for p in ALL_PATIENT_CONFIGS:
            print(f"                • {p['id']} ({p['name']}) -> Scenario: {p['scenario']}")
    else:
        print(f"  Patient ID:   {args.patient}")
        print(f"  Scenario:     {args.scenario}")
    print(f"  Device ID:    {DEVICE_ID}")
    print(f"  Random Seed:  {args.seed}")
    print(f"  Interval:     {args.interval}s")
    print(f"  Endpoint:     {SERVER_URL} {'(DRY RUN - NO HTTP)' if args.dry_run else ''}")
    print(f"  Synthetic:    YES (Tagged on all records)")
    print("=" * 64 + "\n")
    print("Press Ctrl+C to stop.\n")

    # Initialize generators
    if is_all_mode:
        generators = [
            (
                p,
                SyntheticScenarioGenerator(
                    patient_id=p["id"],
                    device_id=f"SIM-DEV-{p['id']}",
                    seed=p["seed"]
                )
            )
            for p in ALL_PATIENT_CONFIGS
        ]
    else:
        generators = [
            (
                {"id": args.patient, "name": "Patient", "scenario": args.scenario},
                SyntheticScenarioGenerator(
                    patient_id=args.patient,
                    device_id=DEVICE_ID,
                    seed=args.seed
                )
            )
        ]

    t = 0
    consecutive_errors = 0
    base_time = datetime.now(timezone.utc)
    headers = {
        "X-Device-Key": DEVICE_API_KEY,
        "Content-Type": "application/json"
    }

    try:
        while True:
            if args.count is not None and t >= args.count:
                print(f"\n[DONE] Completed requested scenario run of {args.count} readings.\n")
                break

            print(f"--- [Tick {t:03d}] Telemetry Broadcast ---")
            for p_cfg, gen in generators:
                payload = gen.generate_record(t, scenario=p_cfg["scenario"], base_time=base_time)
                is_valid, val_msg = validate_client_payload(payload)

                hr   = payload.get('heartRate',  'N/A')
                spo2 = payload.get('spO2',        'N/A')
                temp = payload.get('temperature', 'N/A')
                rr   = payload.get('respRate',    'N/A')
                mapp = payload.get('map',         'N/A')
                sbp  = payload.get('sysBP',       'N/A')
                ec2  = payload.get('etco2',       'N/A')
                label = payload.get('groundTruthLabel', 'normal')

                if not is_valid:
                    print(f"  [WARN] {p_cfg['id']}: {val_msg} (Label: {label})")

                if args.dry_run:
                    icon = "[OK]" if is_valid else "[ERR]"
                    print(f"  {icon} {p_cfg['id']:<8} | HR:{str(hr):>3} | SpO2:{str(spo2):>5}% | Tmp:{str(temp):>4}C | RR:{str(rr):>4} | MAP:{str(mapp):>3} | SBP:{str(sbp):>3} | EtCO2:{str(ec2):>4} | {p_cfg['scenario']}")
                else:
                    try:
                        res = requests.post(SERVER_URL, json=payload, headers=headers, timeout=5)
                        if res.status_code in (200, 201):
                            data = res.json()
                            status = data.get('status', 'normal')
                            icon = "[OK]" if status == 'normal' else "[!!]" if status == 'warning' else "[XX]"
                            print(f"  {icon} {p_cfg['id']:<8} ({p_cfg['name']}) | HR:{str(hr):>3} | SpO2:{str(spo2):>5}% | Tmp:{str(temp):>4}C | RR:{str(rr):>4} | MAP:{str(mapp):>3} | SBP:{str(sbp):>3} | EtCO2:{str(ec2):>4} | {status}")
                            consecutive_errors = 0
                        elif res.status_code == 400:
                            data = res.json()
                            print(f"  [REJECT-400] {p_cfg['id']}: {data.get('error')}")
                        else:
                            print(f"  [ERR] {p_cfg['id']}: Server responded {res.status_code}")
                            consecutive_errors += 1
                    except requests.exceptions.ConnectionError:
                        print(f"  [WAIT] Server offline or restarting. Retrying in 3s...")
                        time.sleep(3)
                    except requests.exceptions.Timeout:
                        print(f"  [TIMEOUT] {p_cfg['id']}: Request timed out")

            t += 1
            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\n\nSimulator stopped by operator after {t} broadcast cycles.\n")
        sys.exit(0)

if __name__ == "__main__":
    main()
