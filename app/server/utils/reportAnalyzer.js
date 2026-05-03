/**
 * AI Report Analyzer — Rule-based medical lab value analysis
 * Evaluates common lab test results against medical reference ranges
 * and generates findings, recommendations, and an overall assessment.
 */

// ── Medical Reference Ranges ────────────────────────────────────
const REFERENCE_RANGES = {
  // Complete Blood Count (CBC)
  hemoglobin:    { unit: 'g/dL',      male: [13.5, 17.5], female: [12.0, 15.5], label: 'Hemoglobin' },
  wbc:           { unit: '×10³/µL',   normal: [4.5, 11.0],  label: 'White Blood Cells (WBC)' },
  rbc:           { unit: '×10⁶/µL',   male: [4.7, 6.1], female: [4.2, 5.4], label: 'Red Blood Cells (RBC)' },
  platelets:     { unit: '×10³/µL',   normal: [150, 400],   label: 'Platelet Count' },
  hematocrit:    { unit: '%',         male: [38.3, 48.6], female: [35.5, 44.9], label: 'Hematocrit (HCT)' },

  // Metabolic Panel
  glucose_fasting: { unit: 'mg/dL',   normal: [70, 100],    label: 'Fasting Blood Glucose' },
  glucose_pp:      { unit: 'mg/dL',   normal: [70, 140],    label: 'Post-Prandial Glucose' },
  hba1c:           { unit: '%',       normal: [4.0, 5.6],   label: 'HbA1c (Glycated Hemoglobin)' },
  creatinine:      { unit: 'mg/dL',   male: [0.7, 1.3], female: [0.6, 1.1], label: 'Serum Creatinine' },
  urea:            { unit: 'mg/dL',   normal: [7, 20],      label: 'Blood Urea Nitrogen (BUN)' },
  uric_acid:       { unit: 'mg/dL',   male: [3.4, 7.0], female: [2.4, 6.0], label: 'Uric Acid' },

  // Lipid Profile
  cholesterol_total: { unit: 'mg/dL', normal: [0, 200],     label: 'Total Cholesterol' },
  hdl:               { unit: 'mg/dL', normal: [40, 200],    label: 'HDL Cholesterol (Good)' },
  ldl:               { unit: 'mg/dL', normal: [0, 100],     label: 'LDL Cholesterol (Bad)' },
  triglycerides:     { unit: 'mg/dL', normal: [0, 150],     label: 'Triglycerides' },

  // Liver Function
  sgot:         { unit: 'U/L',  normal: [8, 40],    label: 'SGOT / AST' },
  sgpt:         { unit: 'U/L',  normal: [7, 56],    label: 'SGPT / ALT' },
  bilirubin:    { unit: 'mg/dL', normal: [0.1, 1.2], label: 'Total Bilirubin' },
  albumin:      { unit: 'g/dL',  normal: [3.5, 5.0], label: 'Serum Albumin' },

  // Thyroid
  tsh:   { unit: 'mIU/L', normal: [0.4, 4.0],   label: 'TSH' },
  t3:    { unit: 'ng/dL',  normal: [80, 200],    label: 'T3 (Triiodothyronine)' },
  t4:    { unit: 'µg/dL',  normal: [5.1, 14.1],  label: 'T4 (Thyroxine)' },

  // Iron Studies
  iron:      { unit: 'µg/dL', normal: [60, 170],    label: 'Serum Iron' },
  ferritin:  { unit: 'ng/mL', male: [12, 300], female: [12, 150], label: 'Ferritin' },

  // Vitamins
  vitamin_d: { unit: 'ng/mL', normal: [30, 100],  label: 'Vitamin D (25-OH)' },
  vitamin_b12: { unit: 'pg/mL', normal: [200, 900], label: 'Vitamin B12' },

  // Electrolytes
  sodium:    { unit: 'mEq/L', normal: [136, 145], label: 'Sodium' },
  potassium: { unit: 'mEq/L', normal: [3.5, 5.0], label: 'Potassium' },
  calcium:   { unit: 'mg/dL', normal: [8.5, 10.5], label: 'Calcium' },

  // Kidney
  egfr: { unit: 'mL/min', normal: [90, 200], label: 'eGFR (Kidney Function)' },

  // Inflammation
  esr: { unit: 'mm/hr', male: [0, 22], female: [0, 29], label: 'ESR (Sed Rate)' },
  crp: { unit: 'mg/L',  normal: [0, 3.0], label: 'C-Reactive Protein (CRP)' },
};

// ── Severity Classification ─────────────────────────────────────

function classifySeverity(value, low, high) {
  if (value < low) {
    const pctBelow = ((low - value) / low) * 100;
    if (pctBelow > 30) return { status: 'critical', direction: 'low' };
    if (pctBelow > 15) return { status: 'abnormal', direction: 'low' };
    return { status: 'borderline', direction: 'low' };
  }
  if (value > high) {
    const pctAbove = ((value - high) / high) * 100;
    if (pctAbove > 50) return { status: 'critical', direction: 'high' };
    if (pctAbove > 20) return { status: 'abnormal', direction: 'high' };
    return { status: 'borderline', direction: 'high' };
  }
  return { status: 'normal', direction: 'normal' };
}

// ── Recommendations Database ────────────────────────────────────

const RECOMMENDATIONS = {
  hemoglobin: {
    low: 'Low hemoglobin suggests anemia. Increase iron-rich foods (spinach, lentils, red meat). Consider iron supplements after consulting your doctor. A complete iron studies panel may be needed.',
    high: 'Elevated hemoglobin may indicate dehydration, lung disease, or polycythemia. Stay well hydrated and consult a hematologist for further evaluation.'
  },
  wbc: {
    low: 'Low WBC count (leukopenia) may weaken immunity. Avoid contact with sick individuals. This could indicate viral infection, bone marrow issues, or medication side effects.',
    high: 'Elevated WBC (leukocytosis) suggests infection, inflammation, or stress response. If persistent, further blood tests may be needed to rule out serious conditions.'
  },
  platelets: {
    low: 'Low platelet count (thrombocytopenia) increases bleeding risk. Avoid aspirin and NSAIDs. Report any unusual bruising or bleeding to your doctor immediately.',
    high: 'Elevated platelets may indicate inflammation, infection, or iron deficiency. Follow up with additional testing if levels remain high.'
  },
  glucose_fasting: {
    low: 'Low fasting glucose (hypoglycemia). Eat regular, balanced meals. Carry glucose tablets. If recurrent, check for insulin-related conditions.',
    high: 'Elevated fasting glucose suggests pre-diabetes or diabetes. Reduce refined carbohydrates, increase physical activity, and consult an endocrinologist. An HbA1c test is recommended.'
  },
  glucose_pp: {
    low: 'Low post-prandial glucose is unusual. Ensure adequate carbohydrate intake in meals.',
    high: 'Elevated post-meal glucose indicates impaired glucose tolerance. Manage portion sizes, choose low-glycemic foods, and monitor regularly.'
  },
  hba1c: {
    low: 'Very low HbA1c is uncommon. May indicate recent blood loss or hemolytic conditions.',
    high: 'Elevated HbA1c (>5.6%) indicates long-term elevated blood sugar. 5.7-6.4% is pre-diabetic, ≥6.5% is diabetic. Strict dietary control, regular exercise, and medication review needed.'
  },
  cholesterol_total: {
    high: 'High total cholesterol increases cardiovascular risk. Reduce saturated fats, increase omega-3 fatty acids, exercise regularly, and consider statin therapy if lifestyle changes are insufficient.'
  },
  ldl: {
    high: 'High LDL ("bad cholesterol") is a major risk factor for heart disease. Cut trans fats, increase soluble fiber (oats, beans), and exercise. Target LDL <100 mg/dL.'
  },
  hdl: {
    low: 'Low HDL ("good cholesterol") increases heart disease risk. Increase exercise, eat healthy fats (nuts, olive oil, avocados), and quit smoking if applicable.'
  },
  triglycerides: {
    high: 'High triglycerides increase cardiovascular and pancreatitis risk. Limit sugar, refined carbs, and alcohol. Increase omega-3 intake and exercise regularly.'
  },
  creatinine: {
    high: 'Elevated creatinine may indicate impaired kidney function. Stay hydrated, limit protein intake, avoid NSAIDs, and consult a nephrologist for eGFR evaluation.'
  },
  sgot: {
    high: 'Elevated SGOT/AST suggests liver cell damage. May indicate hepatitis, fatty liver, or medication toxicity. Avoid alcohol and hepatotoxic medications.'
  },
  sgpt: {
    high: 'Elevated SGPT/ALT is a more specific marker for liver damage. Common causes include fatty liver disease, hepatitis, and drug-induced liver injury. Follow up with liver ultrasound.'
  },
  bilirubin: {
    high: 'Elevated bilirubin may cause jaundice. Could indicate liver disease, bile duct obstruction, or hemolysis. Urgent evaluation recommended if >3 mg/dL.'
  },
  tsh: {
    low: 'Low TSH suggests hyperthyroidism (overactive thyroid). Symptoms include weight loss, rapid heartbeat, anxiety. Consult endocrinologist for T3/T4 testing.',
    high: 'Elevated TSH indicates hypothyroidism (underactive thyroid). Symptoms include fatigue, weight gain, cold intolerance. Levothyroxine therapy may be needed.'
  },
  vitamin_d: {
    low: 'Vitamin D deficiency is very common. May cause fatigue, bone pain, muscle weakness. Take 1000-2000 IU daily supplement and get 15-20 minutes of sunlight. Severe deficiency (<10 ng/mL) may need high-dose prescription.'
  },
  vitamin_b12: {
    low: 'Low B12 can cause fatigue, numbness, memory issues, and anemia. Common in vegetarians. Supplement with B12 tablets or injections. Include dairy, eggs, or fortified foods.'
  },
  iron: {
    low: 'Low serum iron suggests iron deficiency. Pair iron-rich foods with vitamin C for better absorption. Avoid tea/coffee with meals. Iron supplements may be prescribed.',
    high: 'High iron may indicate hemochromatosis or excessive supplementation. Avoid iron supplements and limit red meat. Further testing needed.'
  },
  potassium: {
    low: 'Low potassium (hypokalemia) can cause muscle weakness and cardiac arrhythmias. Eat potassium-rich foods: bananas, oranges, potatoes, spinach.',
    high: 'High potassium (hyperkalemia) is dangerous for heart function. Limit potassium-rich foods and check kidney function. May need urgent treatment if >6.0 mEq/L.'
  },
  esr: {
    high: 'Elevated ESR indicates inflammation somewhere in the body. Not specific — could be infection, autoimmune disease, or malignancy. Further targeted testing needed.'
  },
  crp: {
    high: 'Elevated CRP indicates acute inflammation or infection. If chronically elevated, consider cardiovascular risk assessment. Rule out infections first.'
  },
  egfr: {
    low: 'Low eGFR indicates reduced kidney function. Stage 3 CKD: 30-59, Stage 4: 15-29, Stage 5: <15 (kidney failure). Nephrologist referral recommended.'
  },
  ferritin: {
    low: 'Low ferritin confirms iron deficiency even if hemoglobin is normal. Start iron supplementation and investigate cause (dietary, blood loss, absorption issues).',
    high: 'Elevated ferritin may indicate inflammation, liver disease, or iron overload. Further evaluation with transferrin saturation test recommended.'
  }
};

// ── Main Analysis Function ──────────────────────────────────────

function analyzeReport(labValues, patientGender = 'Male') {
  const gender = (patientGender || 'Male').toLowerCase();
  const findings = [];
  const recommendations = [];
  const details = [];
  let criticalCount = 0;
  let abnormalCount = 0;
  let borderlineCount = 0;
  let normalCount = 0;

  for (const [key, value] of Object.entries(labValues)) {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || !REFERENCE_RANGES[key]) continue;

    const ref = REFERENCE_RANGES[key];
    const range = ref[gender] || ref.normal;
    if (!range) continue;

    const [low, high] = range;
    const { status, direction } = classifySeverity(numValue, low, high);

    const detail = {
      test: ref.label,
      key,
      value: numValue,
      unit: ref.unit,
      normalRange: `${low} – ${high}`,
      status,
      direction,
    };
    details.push(detail);

    if (status === 'normal') {
      normalCount++;
      continue;
    }

    if (status === 'critical') criticalCount++;
    else if (status === 'abnormal') abnormalCount++;
    else borderlineCount++;

    const statusEmoji = status === 'critical' ? '🔴' : status === 'abnormal' ? '🟠' : '🟡';
    const dirLabel = direction === 'high' ? 'HIGH' : 'LOW';
    findings.push(`${statusEmoji} **${ref.label}**: ${numValue} ${ref.unit} (${dirLabel}) — Normal range: ${low}–${high} ${ref.unit}`);

    // Get recommendation
    const rec = RECOMMENDATIONS[key];
    if (rec && rec[direction]) {
      recommendations.push({ test: ref.label, severity: status, advice: rec[direction] });
    }
  }

  // Overall assessment
  let overallStatus = 'normal';
  let summary = '';
  if (criticalCount > 0) {
    overallStatus = 'critical';
    summary = `⚠️ URGENT ATTENTION REQUIRED — ${criticalCount} critical abnormalit${criticalCount > 1 ? 'ies' : 'y'} detected. Please consult your doctor immediately.`;
  } else if (abnormalCount > 0) {
    overallStatus = 'abnormal';
    summary = `${abnormalCount} significant abnormalit${abnormalCount > 1 ? 'ies' : 'y'} found. Medical consultation recommended within the next few days.`;
  } else if (borderlineCount > 0) {
    overallStatus = 'borderline';
    summary = `${borderlineCount} borderline result${borderlineCount > 1 ? 's' : ''} detected. Monitor closely and retest in 4–6 weeks. Lifestyle modifications may help.`;
  } else if (normalCount > 0) {
    summary = `✅ All ${normalCount} tested parameters are within normal range. Great job maintaining your health!`;
  } else {
    summary = 'No lab values were provided for analysis.';
  }

  // General wellness tips
  const wellnessTips = [
    'Stay hydrated — drink 8–10 glasses of water daily.',
    'Aim for 7–8 hours of quality sleep each night.',
    'Include at least 30 minutes of moderate exercise daily.',
    'Eat a balanced diet rich in fruits, vegetables, and whole grains.',
    'Schedule regular health check-ups every 6 months.',
  ];

  return {
    summary,
    overallStatus,
    findings,
    recommendations,
    details,
    stats: { total: details.length, normal: normalCount, borderline: borderlineCount, abnormal: abnormalCount, critical: criticalCount },
    wellnessTips,
    analyzedAt: new Date(),
  };
}

module.exports = { analyzeReport, REFERENCE_RANGES };
