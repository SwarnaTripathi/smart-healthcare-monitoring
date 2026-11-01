"""
HealthGuard Deterioration Prediction Service
Real-time 6-Hour Patient Deterioration Inference Engine
Loads trained LightGBM model, accepts recent patient vitals history,
computes dynamic features, and outputs calibrated deterioration risk score + clinical interpretation.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from feature_engineering import extract_features, FEATURE_COLUMNS

MODEL_PATH = "d:/smart health care/app/ml/artifacts/lightgbm_deterioration_6h.joblib"
META_PATH = "d:/smart health care/app/ml/artifacts/model_metadata.json"

class DeteriorationPredictor:
    def __init__(self, model_path=MODEL_PATH, meta_path=META_PATH):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Run train_lightgbm.py first.")
        self.model = joblib.load(model_path)
        with open(meta_path, 'r') as f:
            self.metadata = json.load(f)
        self.threshold = self.metadata['metrics'].get('optimal_threshold', 0.5)

    def predict_patient(self, recent_readings):
        """
        recent_readings: list of dicts with keys:
          - patientId, timestamp, heartRate, spO2, temperature
        Must have at least a few readings (ideally 30-180 minutes of history).
        """
        if not recent_readings or len(recent_readings) == 0:
            return {
                "status": "UNAVAILABLE",
                "is_prediction_available": False,
                "reason": "NO_TELEMETRY_DATA",
                "risk_level": "UNAVAILABLE",
                "deterioration_probability_6h": None,
                "percentage": "N/A",
                "clinical_recommendation": "No telemetry data provided. 6-hour risk calculation unavailable.",
                "clinical_disclaimer": "Machine learning decision-support estimate only. Not a medical diagnosis or treatment recommendation."
            }

        df = pd.DataFrame(recent_readings)
        if len(df) < 5:
            return {
                "status": "UNAVAILABLE",
                "is_prediction_available": False,
                "reason": "INSUFFICIENT_HISTORY",
                "sample_count": len(df),
                "risk_level": "UNAVAILABLE",
                "deterioration_probability_6h": None,
                "percentage": "N/A",
                "clinical_recommendation": f"Insufficient telemetry history ({len(df)} readings provided; minimum 5 required for trend calculation). Predictive estimation unavailable.",
                "clinical_disclaimer": "Machine learning decision-support estimate only. Not a medical diagnosis or treatment recommendation."
            }

        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values(by='timestamp').reset_index(drop=True)

        # Validate physiological plausibility bounds
        invalid_mask = (
            (df['heartRate'].isna()) | (df['heartRate'] <= 0) | (df['heartRate'] > 280) |
            (df['spO2'].isna()) | (df['spO2'] <= 0) | (df['spO2'] > 100) |
            (df['temperature'].isna()) | (df['temperature'] < 25.0) | (df['temperature'] > 45.0)
        )
        if invalid_mask.any():
            return {
                "status": "UNAVAILABLE",
                "is_prediction_available": False,
                "reason": "INVALID_TELEMETRY",
                "invalid_samples": int(invalid_mask.sum()),
                "risk_level": "UNAVAILABLE",
                "deterioration_probability_6h": None,
                "percentage": "N/A",
                "clinical_recommendation": "Telemetry stream contains non-physiological or corrupted vital readings. Sensor recalibration/bedside check required.",
                "clinical_disclaimer": "Machine learning decision-support estimate only. Not a medical diagnosis or treatment recommendation."
            }

        # Observation duration check (minimum 5 minutes span)
        time_span_seconds = (df['timestamp'].iloc[-1] - df['timestamp'].iloc[0]).total_seconds()
        if time_span_seconds < 120 and len(df) < 10:
            return {
                "status": "UNAVAILABLE",
                "is_prediction_available": False,
                "reason": "INSUFFICIENT_DURATION",
                "observation_span_seconds": time_span_seconds,
                "risk_level": "UNAVAILABLE",
                "deterioration_probability_6h": None,
                "percentage": "N/A",
                "clinical_recommendation": "Telemetry duration too short to compute stable vital dynamics and rolling volatility.",
                "clinical_disclaimer": "Machine learning decision-support estimate only. Not a medical diagnosis or treatment recommendation."
            }
        
        # Calculate step interval in minutes
        diffs = df['timestamp'].diff().dt.total_seconds().dropna()
        step_minutes = max(0.1, float(diffs.median() / 60.0)) if len(diffs) > 0 else 1.0

        # Engineer features
        df_feat = extract_features(df, step_minutes=step_minutes)
        latest_row = df_feat.iloc[-1]
        
        X_infer = pd.DataFrame([latest_row[FEATURE_COLUMNS]])
        
        # Inference
        prob = float(self.model.predict_proba(X_infer)[0, 1])
        has_elevated_risk = bool(prob >= self.threshold)
        
        # Risk tiering
        if prob >= 0.70:
            risk_level = "CRITICAL"
            color = "#ef4444"
            advisory = "Elevated predicted deterioration risk (Critical). Recommend priority clinical review and vital check protocol."
        elif prob >= self.threshold:
            risk_level = "ELEVATED"
            color = "#f59e0b"
            advisory = "Elevated predicted deterioration risk. Suggest increasing vital sign monitoring frequency to 15m."
        elif prob >= 0.12:
            risk_level = "MODERATE"
            color = "#3b82f6"
            advisory = "Moderate predicted trend fluctuation. Continue routine continuous telemetry monitoring."
        else:
            risk_level = "LOW"
            color = "#10b981"
            advisory = "Predicted deterioration probability low. Patient vitals demonstrate stable trajectory."

        # Key physiological drivers
        drivers = []
        if latest_row['hr_delta_1h'] > 15:
            drivers.append(f"Accelerating tachycardia (+{latest_row['hr_delta_1h']:.1f} bpm over past hour)")
        if latest_row['spo2_delta_1h'] < -2.0:
            drivers.append(f"Progressive desaturation ({latest_row['spo2_delta_1h']:.1f}% decline over past hour)")
        if latest_row['temperature'] > 38.3:
            drivers.append(f"Febrile state ({latest_row['temperature']:.1f}°C)")
        if latest_row['hr_spo2_ratio'] > 1.2:
            drivers.append(f"Cardio-respiratory strain index ({latest_row['hr_spo2_ratio']:.2f})")
            
        if not drivers:
            drivers.append("Vitals within baseline physiological bounds.")

        return {
            "status": "AVAILABLE",
            "is_prediction_available": True,
            "patientId": str(latest_row['patientId']),
            "timestamp": latest_row['timestamp'].isoformat(),
            "deterioration_probability_6h": round(prob, 4),
            "percentage": f"{prob * 100:.1f}%",
            "threshold_used": self.threshold,
            "elevated_predicted_risk": has_elevated_risk,
            "will_deteriorate_6h": has_elevated_risk,  # Backwards compatibility alias
            "risk_level": risk_level,
            "risk_color": color,
            "key_drivers": drivers,
            "clinical_advisory": advisory,
            "clinical_recommendation": advisory,  # Backwards compatibility alias
            "alert_type": "PREDICTIVE_ML_TREND_WARNING",
            "clinical_disclaimer": "Machine learning decision-support estimate only. Not a medical diagnosis or treatment order. Always verify with direct clinical evaluation.",
            "current_vitals": {
                "heartRate": float(latest_row['heartRate']),
                "spO2": float(latest_row['spO2']),
                "temperature": float(latest_row['temperature'])
            }
        }

if __name__ == "__main__":
    import sys
    print("Testing DeteriorationPredictor...")
    try:
        predictor = DeteriorationPredictor()
        # Mock test sample
        now = pd.Timestamp.now()
        mock_data = [
            {'patientId': 'PT-TEST', 'timestamp': now - pd.Timedelta(minutes=60), 'heartRate': 78, 'spO2': 97.0, 'temperature': 36.8},
            {'patientId': 'PT-TEST', 'timestamp': now - pd.Timedelta(minutes=30), 'heartRate': 92, 'spO2': 94.5, 'temperature': 37.4},
            {'patientId': 'PT-TEST', 'timestamp': now, 'heartRate': 114, 'spO2': 90.5, 'temperature': 38.6}
        ]
        result = predictor.predict_patient(mock_data)
        print("\nPrediction Output:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Test note: {e}")
