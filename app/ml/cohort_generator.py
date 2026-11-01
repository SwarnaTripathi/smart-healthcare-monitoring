"""
Clinical Cohort Generator for 6-Hour Deterioration Prediction
Generates multi-patient longitudinal telemetry with realistic clinical trajectories:
- Normal stable patients (with circadian rhythms)
- Septic shock (progressive tachycardia, hyperthermia/hypothermia, oxygen desaturation)
- Respiratory failure (progressive hypoxemia, tachypnea/tachycardia compensation)
- Acute cardiac decompensation (arrhythmic spikes, hemodynamic collapse)
- Sensor artifacts & noisy data (to train model robustness)

Outputs clean timestamped records with patientId, timestamp, vitals, scenario,
and actual clinical deterioration event timestamps (event_time).
"""

import os
import sys
import math
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

if os.name == 'nt':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def generate_patient_trajectory(patient_id, scenario, duration_hours=24, interval_seconds=60, seed=42):
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    
    total_steps = int((duration_hours * 3600) / interval_seconds)
    base_time = datetime(2026, 11, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Baseline patient physiology
    base_hr    = rng.uniform(68, 82)
    base_spo2  = rng.uniform(97, 99)
    base_temp  = rng.uniform(36.4, 37.0)
    # Extended ICU vitals — normal ranges
    base_rr    = rng.uniform(13, 18)    # Respiratory Rate breaths/min
    base_map   = rng.uniform(75, 95)    # Mean Arterial Pressure mmHg
    base_sysbp = rng.uniform(108, 132)  # Systolic BP mmHg
    base_etco2 = rng.uniform(35, 42)    # End-Tidal CO2 mmHg
    
    records = []
    
    # Deterioration event schedule (if applicable)
    deterioration_start_hour = None
    if scenario in ['sepsis', 'respiratory_failure', 'cardiac_decompensation']:
        # Event occurs between hour 10 and 18
        deterioration_start_hour = rng.uniform(10, 16)
        deterioration_start_step = int((deterioration_start_hour * 3600) / interval_seconds)
    else:
        deterioration_start_step = None

    for step in range(total_steps):
        t_hours = (step * interval_seconds) / 3600.0
        timestamp = base_time + timedelta(seconds=step * interval_seconds)
        
        # Circadian diurnal rhythm (24-hour sinusoidal wave)
        circadian_hr = math.sin((t_hours / 24.0) * 2 * math.pi - math.pi / 2) * 3.5
        circadian_temp = math.sin((t_hours / 24.0) * 2 * math.pi - math.pi / 2) * 0.25
        
        # Noise components
        hr_noise    = np_rng.normal(0, 1.2)
        spo2_noise  = np_rng.normal(0, 0.3)
        temp_noise  = np_rng.normal(0, 0.05)
        rr_noise    = np_rng.normal(0, 0.8)
        map_noise   = np_rng.normal(0, 1.5)
        sysbp_noise = np_rng.normal(0, 2.0)
        etco2_noise = np_rng.normal(0, 0.6)
        
        hr    = base_hr    + circadian_hr   + hr_noise
        spo2  = base_spo2  + spo2_noise
        temp  = base_temp  + circadian_temp + temp_noise
        rr    = base_rr    + rr_noise
        map_  = base_map   + map_noise
        sysbp = base_sysbp + sysbp_noise
        etco2 = base_etco2 + etco2_noise
        
        is_deteriorated = False
        clinical_event = "none"
        
        # Apply scenario dynamics
        if scenario == 'sepsis' and deterioration_start_step is not None:
            if step >= deterioration_start_step:
                progress = (step - deterioration_start_step) / ((6.0 * 3600) / interval_seconds)
                progress = min(progress, 1.5)
                # Progressive tachycardia, fever spikes, followed by hypoxemia
                hr    += progress * 45.0  + np_rng.normal(0, 2.0)
                temp  += progress * 2.4   + np_rng.normal(0, 0.1)
                spo2  -= progress * 9.0   + np_rng.normal(0, 0.5)
                # Tachypnea, early MAP drop due to vasodilation, rising EtCO2 then falling
                rr    += progress * 12.0  + np_rng.normal(0, 0.8)
                map_  -= progress * 18.0  + np_rng.normal(0, 2.0)
                sysbp -= progress * 25.0  + np_rng.normal(0, 3.0)
                etco2 -= progress * 6.0   + np_rng.normal(0, 0.5)
                is_deteriorated = True
                clinical_event = "septic_shock"
                
        elif scenario == 'respiratory_failure' and deterioration_start_step is not None:
            if step >= deterioration_start_step:
                progress = (step - deterioration_start_step) / ((4.0 * 3600) / interval_seconds)
                progress = min(progress, 1.5)
                # Severe progressive desaturation and compensatory tachycardia
                spo2  -= progress * 14.0 + np_rng.normal(0, 0.7)
                hr    += progress * 35.0 + np_rng.normal(0, 2.5)
                # Tachypnea is hallmark; rising EtCO2 (CO2 retention) initially, then falling
                rr    += progress * 18.0 + np_rng.normal(0, 1.0)
                etco2 += progress * 8.0  + np_rng.normal(0, 0.8)  # CO2 retention
                map_  -= progress * 10.0 + np_rng.normal(0, 1.5)
                sysbp -= progress * 15.0 + np_rng.normal(0, 2.5)
                is_deteriorated = True
                clinical_event = "respiratory_failure"
                
        elif scenario == 'cardiac_decompensation' and deterioration_start_step is not None:
            if step >= deterioration_start_step:
                progress = (step - deterioration_start_step) / ((3.0 * 3600) / interval_seconds)
                progress = min(progress, 1.5)
                # Severe tachycardia or erratic fibrillation, drop in oxygenation
                hr    += progress * 60.0 + np_rng.normal(0, 5.0)
                spo2  -= progress * 8.0  + np_rng.normal(0, 0.6)
                temp  -= progress * 0.5
                # Hemodynamic collapse: severe MAP/SysBP drop; mildly elevated RR
                map_  -= progress * 28.0 + np_rng.normal(0, 3.0)
                sysbp -= progress * 38.0 + np_rng.normal(0, 4.0)
                rr    += progress * 8.0  + np_rng.normal(0, 1.0)
                etco2 -= progress * 5.0  + np_rng.normal(0, 0.5)
                is_deteriorated = True
                clinical_event = "cardiac_decompensation"
                
        elif scenario == 'sensor_artifact':
            # Random occasional motion artifact or sensor detachment
            if rng.random() < 0.01:
                hr    = rng.choice([25, 230, 0])
                spo2  = rng.choice([50, 65, 0])
                rr    = rng.choice([4, 60, 0])
                map_  = rng.choice([20, 180, 0])
                sysbp = rng.choice([40, 250, 0])
                etco2 = rng.choice([5, 90, 0])
                clinical_event = "sensor_artifact"
                
        # Clip to physiological physical limits
        hr    = float(np.clip(hr,    20.0, 240.0))
        spo2  = float(np.clip(spo2,  50.0, 100.0))
        temp  = float(np.clip(temp,  33.0, 42.5))
        rr    = float(np.clip(rr,     4.0,  70.0))
        map_  = float(np.clip(map_,  20.0, 180.0))
        sysbp = float(np.clip(sysbp, 40.0, 260.0))
        etco2 = float(np.clip(etco2,  5.0,  90.0))
        
        records.append({
            'patientId': patient_id,
            'timestamp': timestamp,
            'heartRate': round(hr,    1),
            'spO2':      round(spo2,  1),
            'temperature': round(temp, 2),
            'respRate':  round(rr,    1),
            'map':       round(map_,  1),
            'sysBP':     round(sysbp, 1),
            'etco2':     round(etco2, 1),
            'scenario': scenario,
            'is_deteriorated': 1 if is_deteriorated else 0,
            'clinical_event': clinical_event,
            'deterioration_start_step': deterioration_start_step if deterioration_start_step is not None else -1
        })
        
    return pd.DataFrame(records)

def generate_full_cohort(num_patients=100, output_csv="d:/smart health care/app/ml/cohort_dataset.csv", seed=2026):
    print(f"Generating realistic cohort of {num_patients} patients over 24-48 hours...")
    rng = random.Random(seed)
    
    scenarios = [
        ('normal', 0.50),                  # 50% stable baseline
        ('sepsis', 0.20),                  # 20% sepsis
        ('respiratory_failure', 0.15),     # 15% respiratory failure
        ('cardiac_decompensation', 0.10),  # 10% cardiac events
        ('sensor_artifact', 0.05)          # 5% noisy artifacts
    ]
    scenario_names, scenario_probs = zip(*scenarios)
    
    all_dfs = []
    for i in range(1, num_patients + 1):
        p_id = f"PT-{i:05d}"
        chosen_scenario = rng.choices(scenario_names, weights=scenario_probs, k=1)[0]
        # Duration between 24 and 36 hours, 60s sample interval
        duration = rng.choice([24, 30, 36])
        df = generate_patient_trajectory(p_id, chosen_scenario, duration_hours=duration, interval_seconds=60, seed=seed + i)
        all_dfs.append(df)
        
    full_df = pd.concat(all_dfs, ignore_index=True)
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    full_df.to_csv(output_csv, index=False)
    print(f"✅ Generated {len(full_df):,} telemetry records across {num_patients} patients.")
    print(f"Saved to: {output_csv}")
    return full_df

if __name__ == "__main__":
    generate_full_cohort()
