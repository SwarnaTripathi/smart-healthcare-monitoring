"""
Repeatable Synthetic Scenario Generator
Generates deterministically reproducible vital-sign telemetry scenarios.
Clearly labels all records as synthetic and tags ground-truth labels for evaluation.
"""

import math
import random
import time
from datetime import datetime, timezone, timedelta

# Scenario Identifiers
SCENARIO_NORMAL = "normal"
SCENARIO_GRADUAL_DETERIORATION = "gradual_deterioration"
SCENARIO_SUDDEN_SPIKE = "sudden_spike"
SCENARIO_MISSING_DATA = "missing_data"
SCENARIO_STALE_DATA = "stale_data"
SCENARIO_DUPLICATE_DATA = "duplicate_data"
SCENARIO_NOISY_ARTIFACT = "noisy_artifact"

ALL_SCENARIOS = [
    SCENARIO_NORMAL,
    SCENARIO_GRADUAL_DETERIORATION,
    SCENARIO_SUDDEN_SPIKE,
    SCENARIO_MISSING_DATA,
    SCENARIO_STALE_DATA,
    SCENARIO_DUPLICATE_DATA,
    SCENARIO_NOISY_ARTIFACT
]

class SyntheticScenarioGenerator:
    """
    Generates repeatable synthetic sensor telemetry with explicit ground-truth labels.
    """
    def __init__(self, patient_id="PT-00001", device_id="SIM-ESP32-001", seed=42):
        self.patient_id = patient_id
        self.device_id = device_id
        self.seed = seed
        self.rng = random.Random(seed)
        
        # Base physiological parameters
        self.base_hr    = 75.0
        self.base_spo2  = 98.0
        self.base_temp  = 36.6
        # Extended ICU vitals — clinical reference ranges
        self.base_rr    = 16.0   # breaths/min (normal: 12–20)
        self.base_map   = 85.0   # mmHg (normal: 70–100)
        self.base_sysbp = 120.0  # mmHg (normal: 100–140)
        self.base_etco2 = 38.0   # mmHg (normal: 35–45)

    def generate_record(self, t, scenario=SCENARIO_NORMAL, base_time=None):
        """
        Generate a single synthetic telemetry record at step t.
        
        Returns a dict with sensor values and ground-truth metadata:
        - isSynthetic: True (mandatory)
        - syntheticProvenance: identifier
        - groundTruthLabel: 'normal', 'warning_trend', 'critical_anomaly', 'sensor_artifact', 'invalid'
        """
        if base_time is None:
            base_time = datetime.now(timezone.utc)
        
        record_time = base_time + timedelta(seconds=t * 3)

        # Baseline sinusoidal variation
        hr_osc    = math.sin(t * 0.05) * 4.0  + self.rng.gauss(0, 1.5)
        spo2_osc  = math.sin(t * 0.03) * 0.5  + self.rng.gauss(0, 0.2)
        temp_osc  = math.sin(t * 0.02) * 0.15 + self.rng.gauss(0, 0.04)
        rr_osc    = math.sin(t * 0.04) * 1.5  + self.rng.gauss(0, 0.8)
        map_osc   = math.sin(t * 0.03) * 3.0  + self.rng.gauss(0, 1.5)
        sysbp_osc = math.sin(t * 0.03) * 5.0  + self.rng.gauss(0, 2.0)
        etco2_osc = math.sin(t * 0.02) * 1.0  + self.rng.gauss(0, 0.5)

        hr    = round(self.base_hr    + hr_osc)
        spo2  = round(self.base_spo2  + spo2_osc,  1)
        temp  = round(self.base_temp  + temp_osc,  1)
        rr    = round(max(6.0,  self.base_rr    + rr_osc),    1)
        map_  = round(max(40.0, self.base_map   + map_osc),   1)
        sysbp = round(max(60.0, self.base_sysbp + sysbp_osc), 1)
        etco2 = round(max(10.0, self.base_etco2 + etco2_osc), 1)

        ground_truth = "normal"
        is_duplicate = False
        is_stale = False
        is_noisy = False
        has_missing = False

        if scenario == SCENARIO_NORMAL:
            ground_truth = "normal"

        elif scenario == SCENARIO_GRADUAL_DETERIORATION:
            # After t >= 5, SpO2 progressively falls and HR progressively rises
            # Extended vitals also deteriorate: RR rises, MAP/SysBP fall, EtCO2 falls
            if t >= 5:
                decay_steps = t - 5
                spo2  = round(max(85.0,  self.base_spo2  - (decay_steps * 0.6)  + self.rng.gauss(0, 0.2)), 1)
                hr    = round(min(140.0, self.base_hr    + (decay_steps * 2.5)  + self.rng.gauss(0, 1.0)))
                rr    = round(min(40.0,  self.base_rr    + (decay_steps * 0.8)  + self.rng.gauss(0, 0.5)), 1)
                map_  = round(max(50.0,  self.base_map   - (decay_steps * 1.2)  + self.rng.gauss(0, 1.0)), 1)
                sysbp = round(max(70.0,  self.base_sysbp - (decay_steps * 2.0)  + self.rng.gauss(0, 1.5)), 1)
                etco2 = round(max(20.0,  self.base_etco2 - (decay_steps * 0.5)  + self.rng.gauss(0, 0.4)), 1)
                ground_truth = "warning_trend" if spo2 >= 90 else "critical_anomaly"
            else:
                ground_truth = "normal"

        elif scenario == SCENARIO_SUDDEN_SPIKE:
            # Sudden acute critical jump at step 8 — hemodynamic crisis
            if t >= 8:
                hr    = round(self.rng.uniform(155, 175))
                spo2  = round(self.rng.uniform(82, 88),  1)
                temp  = round(self.rng.uniform(39.8, 40.5), 1)
                rr    = round(self.rng.uniform(28, 36),  1)
                map_  = round(self.rng.uniform(45, 58),  1)
                sysbp = round(self.rng.uniform(70, 88),  1)
                etco2 = round(self.rng.uniform(22, 28),  1)
                ground_truth = "critical_anomaly"
            else:
                ground_truth = "normal"

        elif scenario == SCENARIO_MISSING_DATA:
            # Missing sensor dropouts on step 4 and 8
            if t in (4, 8):
                has_missing = True
                ground_truth = "invalid"

        elif scenario == SCENARIO_STALE_DATA:
            # Stale packet: step 6 has a timestamp from 15 minutes ago
            if t == 6:
                is_stale = True
                record_time = base_time - timedelta(minutes=15)
                ground_truth = "stale"

        elif scenario == SCENARIO_DUPLICATE_DATA:
            # Duplicate packet: step 5 has exact same timestamp and readings as step 4
            if t == 5:
                is_duplicate = True
                record_time = base_time + timedelta(seconds=4 * 3)
                ground_truth = "duplicate"

        elif scenario == SCENARIO_NOISY_ARTIFACT:
            # Isolated single-point motion spike on step 6, immediately reverting on step 7
            if t == 6:
                hr    = 145    # abrupt +70 bpm spike for 1 reading (motion artifact)
                spo2  = 82.0   # sudden finger slip
                rr    = 34.0   # transient tachypnea artifact
                map_  = 48.0   # transient pressure artifact
                sysbp = 72.0
                etco2 = 24.0
                is_noisy = True
                ground_truth = "sensor_artifact"
            else:
                ground_truth = "normal"

        payload = {
            "patientId": self.patient_id,
            "deviceId": self.device_id,
            "timestamp": record_time.isoformat(),
            # Synthetic Provenance Tags
            "isSynthetic": True,
            "syntheticProvenance": "SmartHealthcare-IoT-Simulator",
            "scenario": scenario,
            "step": t,
            "groundTruthLabel": ground_truth
        }

        if not has_missing:
            payload["heartRate"]  = hr
            payload["spO2"]       = spo2
            payload["temperature"]= temp
            # Extended ICU vitals
            payload["respRate"]   = rr
            payload["map"]        = map_
            payload["sysBP"]      = sysbp
            payload["etco2"]      = etco2
        else:
            # Omit heartRate to test missing field detection
            payload["spO2"]       = spo2
            payload["temperature"]= temp
            payload["respRate"]   = rr
            payload["map"]        = map_
            payload["sysBP"]      = sysbp
            payload["etco2"]      = etco2

        if is_duplicate:
            payload["isDuplicateTest"] = True
        if is_stale:
            payload["isStaleTest"] = True
        if is_noisy:
            payload["isNoisyTest"] = True

        return payload

    def generate_scenario_sequence(self, scenario, count=20, base_time=None):
        """
        Generate a complete sequence of readings for a given scenario.
        """
        return [self.generate_record(t, scenario=scenario, base_time=base_time) for t in range(count)]
