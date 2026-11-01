# HealthGuard ML — Option A: MIMIC-IV Clinical Dataset Integration Guide

This guide details the complete procedure for obtaining credentialed clinical ICU data from **MIMIC-IV** (Medical Information Mart for Intensive Care) on PhysioNet, extracting real-world vital signs, and connecting real clinical deterioration outcomes directly into HealthGuard's LightGBM 6-hour prediction pipeline.

---

## 1. Prerequisites & PhysioNet Credentialing (1–2 Weeks)

MIMIC-IV contains de-identified electronic health records for over 300,000 patients admitted to Beth Israel Deaconess Medical Center. Because it contains real human clinical data, PhysioNet requires certified ethical research clearance:

### Step 1.1: Complete CITI Ethical Training
1. Go to [CITI Program](https://www.citiprogram.org/) and register an account.
2. Under "Institutional Courses", select **"Massachusetts Institute of Technology (Affiliates)"** or search for **PhysioNet**.
3. Enroll in the course: **"Data or Specimens Only Research"** (or "Conflict of Interest" / "Human Subjects Research - Biomedical").
4. Complete the required modules (~2–3 hours). Download your completion report certificate PDF.

### Step 1.2: Register & Request Access on PhysioNet
1. Create an account on [PhysioNet.org](https://physionet.org/).
2. Submit your CITI certificate under your PhysioNet profile (Account > Training).
3. Navigate to [MIMIC-IV v2.2](https://physionet.org/content/mimiciv/2.2/).
4. Click **"Request Access"** and sign the Data Use Agreement (DUA).
5. Verification typically takes **3 to 7 business days**.

---

## 2. Accessing MIMIC-IV on Google Cloud BigQuery

Once approved, you can query MIMIC-IV directly on Google Cloud BigQuery without downloading terabytes of raw CSVs:

- BigQuery project ID: `physionet-data.mimiciv_icu` and `physionet-data.mimiciv_hosp`

---

## 3. SQL Data Extraction Query: Vitals & 6-Hour Outcomes

Run the following SQL in Google BigQuery to extract hourly vital signs and compute the ground-truth deterioration outcome:

```sql
WITH vitals_hourly AS (
  SELECT
    ce.stay_id,
    TIMESTAMP_TRUNC(ce.charttime, HOUR) AS chart_hour,
    AVG(CASE WHEN ce.itemid = 220045 THEN ce.valuenum END) AS heart_rate,
    AVG(CASE WHEN ce.itemid = 220277 THEN ce.valuenum END) AS spo2,
    AVG(CASE WHEN ce.itemid IN (223761, 223762) THEN 
      IF(ce.itemid = 223761, (ce.valuenum - 32) * 5 / 9, ce.valuenum) END) AS temperature,
    AVG(CASE WHEN ce.itemid = 220210 THEN ce.valuenum END) AS resp_rate,
    AVG(CASE WHEN ce.itemid = 220181 THEN ce.valuenum END) AS mean_arterial_pressure
  FROM `physionet-data.mimiciv_icu.chartevents` ce
  WHERE ce.itemid IN (220045, 220277, 223761, 223762, 220210, 220181)
    AND ce.charttime IS NOT NULL
  GROUP BY ce.stay_id, chart_hour
),

-- Outcome Definition: Initiation of Vasopressors or Invasive Mechanical Ventilation within 6 Hours
interventions AS (
  SELECT
    stay_id,
    starttime AS event_time,
    'vasopressor' AS event_type
  FROM `physionet-data.mimiciv_icu.inputevents`
  WHERE itemid IN (221906, 221289, 221653) -- Norepinephrine, Epinephrine, Dobutamine
  UNION ALL
  SELECT
    stay_id,
    charttime AS event_time,
    'ventilation' AS event_type
  FROM `physionet-data.mimiciv_icu.procedureevents`
  WHERE itemid = 225792 -- Invasive Mechanical Ventilation
),

first_events AS (
  SELECT
    stay_id,
    MIN(event_time) AS first_deterioration_time
  FROM interventions
  GROUP BY stay_id
)

SELECT
  v.stay_id AS patientId,
  v.chart_hour AS timestamp,
  ROUND(v.heart_rate, 1) AS heartRate,
  ROUND(v.spo2, 1) AS spO2,
  ROUND(v.temperature, 2) AS temperature,
  ROUND(v.resp_rate, 1) AS respRate,
  ROUND(v.mean_arterial_pressure, 1) AS meanArterialPressure,
  -- 6-hour lookahead target: 1 if first deterioration is between t and t+6h
  CASE 
    WHEN e.first_deterioration_time > v.chart_hour 
     AND e.first_deterioration_time <= TIMESTAMP_ADD(v.chart_hour, INTERVAL 6 HOUR) 
    THEN 1 
    ELSE 0 
  END AS deterioration_within_6h
FROM vitals_hourly v
LEFT JOIN first_events e ON v.stay_id = e.stay_id
WHERE v.heart_rate IS NOT NULL
  AND v.spo2 IS NOT NULL
ORDER BY v.stay_id, v.chart_hour;
```

---

## 4. Seamless Pipeline Connection

When your MIMIC-IV export CSV is saved (e.g. `mimic_iv_vitals.csv`):

1. Place the CSV in `d:/smart health care/app/ml/mimic_iv_vitals.csv`.
2. Run `train_lightgbm.py`:
   ```bash
   python train_lightgbm.py --dataset mimic_iv_vitals.csv
   ```
3. The exact same feature engineering, group cross-validation, and metrics will evaluate on real clinical outcomes. No architecture changes required!
