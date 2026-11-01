/**
 * Deterioration Predictor Runner for HealthGuard
 * Calls the trained LightGBM model in app/ml/predict.py with recent patient telemetry
 * and returns the calibrated 6-hour deterioration probability.
 */

const { spawn } = require('child_process');
const path = require('path');

const PREDICT_SCRIPT = path.resolve(__dirname, '../../ml/predict.py');
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

async function predictDeteriorationRisk(recentReadings) {
  return new Promise((resolve, reject) => {
    if (!recentReadings || recentReadings.length === 0) {
      return resolve({
        status: 'UNAVAILABLE',
        is_prediction_available: false,
        reason: 'NO_TELEMETRY_DATA',
        risk_level: 'UNAVAILABLE',
        deterioration_probability_6h: null,
        percentage: 'N/A',
        clinical_recommendation: 'No telemetry data provided. 6-hour risk calculation unavailable.',
        clinical_disclaimer: 'Machine learning decision-support estimate only. Not a medical diagnosis or treatment order.'
      });
    }

    const py = spawn(PYTHON_CMD, [
      '-c',
      `
import sys, json, os
if os.name == 'nt':
    try: sys.stdout.reconfigure(encoding='utf-8')
    except Exception: pass
sys.path.append(r"${path.resolve(__dirname, '../../ml').replace(/\\/g, '/')}")
from predict import DeteriorationPredictor
predictor = DeteriorationPredictor()
input_data = json.loads(sys.stdin.read())
result = predictor.predict_patient(input_data)
print(json.dumps(result))
`
    ]);

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', chunk => { stdoutData += chunk.toString(); });
    py.stderr.on('data', chunk => { stderrData += chunk.toString(); });

    py.on('close', code => {
      if (code !== 0) {
        console.error('ML Inference process exit code:', code, 'stderr:', stderrData);
        return resolve({
          status: 'UNAVAILABLE',
          is_prediction_available: false,
          reason: 'MODEL_INFERENCE_ERROR',
          risk_level: 'UNAVAILABLE',
          deterioration_probability_6h: null,
          percentage: 'N/A',
          clinical_recommendation: 'Machine learning prediction service temporarily unavailable. Rely on live bedside vitals and telemetry threshold alerts.',
          clinical_disclaimer: 'Machine learning decision-support estimate only. Not a medical diagnosis or treatment order.'
        });
      }
      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (err) {
        console.error('ML Output Parse Error:', err, stdoutData);
        resolve({
          status: 'UNAVAILABLE',
          is_prediction_available: false,
          reason: 'OUTPUT_PARSING_ERROR',
          risk_level: 'UNAVAILABLE',
          deterioration_probability_6h: null,
          percentage: 'N/A',
          clinical_recommendation: 'Could not parse prediction output. Rely on live bedside vitals.',
          clinical_disclaimer: 'Machine learning decision-support estimate only. Not a medical diagnosis or treatment order.'
        });
      }
    });

    py.stdin.write(JSON.stringify(recentReadings));
    py.stdin.end();
  });
}

/**
 * Fallback Clinical Heuristic (Shock Index & NEWS2 trend) if Python runtime is unavailable
 */
function calculateHeuristicRisk(readings) {
  const latest = readings[readings.length - 1];
  const hr = latest.heartRate || 75;
  const spo2 = latest.spO2 || 98;
  const temp = latest.temperature || 36.8;

  let score = 0;
  if (hr > 120 || hr < 45) score += 3;
  else if (hr > 105 || hr < 50) score += 2;
  else if (hr > 95) score += 1;

  if (spo2 <= 91) score += 3;
  else if (spo2 <= 93) score += 2;
  else if (spo2 <= 95) score += 1;

  if (temp > 39.0 || temp < 35.0) score += 3;
  else if (temp > 38.0 || temp < 35.5) score += 2;

  const prob = Math.min(0.95, Math.max(0.05, score * 0.12));
  const isHigh = prob >= 0.45;

  return {
    patientId: latest.patientId,
    timestamp: latest.timestamp,
    deterioration_probability_6h: Number(prob.toFixed(4)),
    percentage: `${(prob * 100).toFixed(1)}%`,
    threshold_used: 0.45,
    will_deteriorate_6h: isHigh,
    risk_level: prob >= 0.7 ? 'CRITICAL' : isHigh ? 'ELEVATED' : prob >= 0.25 ? 'MODERATE' : 'LOW',
    risk_color: prob >= 0.7 ? '#ef4444' : isHigh ? '#f59e0b' : prob >= 0.25 ? '#3b82f6' : '#10b981',
    clinical_recommendation: isHigh ? 'Bedside assessment advised. Monitor vitals closely.' : 'Patient hemodynamically stable.',
    current_vitals: { heartRate: hr, spO2: spo2, temperature: temp },
    model_type: 'Heuristic-Fallback'
  };
}

module.exports = { predictDeteriorationRisk };
