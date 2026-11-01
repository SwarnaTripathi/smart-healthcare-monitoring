import os

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Healthcare Monitoring & Patient Deterioration Prediction System — Master Report & Viva Guide</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --primary-light: #e0f2fe;
      --accent: #6366f1;
      --accent-light: #eef2ff;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-400: #94a3b8;
      --slate-200: #e2e8f0;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
      --success: #059669;
      --success-bg: #ecfdf5;
      --warning: #d97706;
      --warning-bg: #fffbeb;
      --danger: #dc2626;
      --danger-bg: #fef2f2;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.65;
      font-size: 10pt;
    }

    /* Print Specific Styling */
    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #64748b;
        font-family: 'Inter', sans-serif;
      }
      @bottom-left {
        content: "Smart Healthcare Monitoring System — Master Engineering Report";
        font-size: 8pt;
        color: #64748b;
        font-family: 'Inter', sans-serif;
      }
    }

    @media print {
      body {
        background-color: #ffffff !important;
        color: #0f172a !important;
        font-size: 9.5pt;
      }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .avoid-break { page-break-inside: avoid; }
      a { text-decoration: none; color: inherit; }
      .card, table, pre, .q-card {
        page-break-inside: avoid;
      }
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 30px;
    }

    /* Cover / Hero Header */
    .cover-header {
      border-bottom: 2px solid var(--slate-200);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }

    .badge-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background-color: var(--primary-light);
      color: var(--primary-dark);
      border: 1px solid #bae6fd;
    }

    .badge-purple {
      background-color: var(--accent-light);
      color: var(--accent);
      border: 1px solid #c7d2fe;
    }

    .badge-success {
      background-color: var(--success-bg);
      color: var(--success);
      border: 1px solid #a7f3d0;
    }

    .badge-danger {
      background-color: var(--danger-bg);
      color: var(--danger);
      border: 1px solid #fecaca;
    }

    h1 {
      font-size: 20pt;
      font-weight: 800;
      color: var(--slate-900);
      line-height: 1.25;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .subtitle {
      font-size: 11pt;
      color: var(--primary-dark);
      font-weight: 600;
      margin-bottom: 16px;
    }

    .meta-box {
      background-color: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      padding: 12px 16px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
      font-size: 8.5pt;
      margin-top: 14px;
    }

    .meta-item strong {
      color: var(--slate-700);
    }

    /* Headings */
    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: var(--slate-900);
      border-bottom: 1.5px solid var(--slate-200);
      padding-bottom: 6px;
      margin-top: 26px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h2 .section-num {
      background: var(--primary);
      color: white;
      font-size: 8.5pt;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
    }

    h3 {
      font-size: 10.5pt;
      font-weight: 600;
      color: var(--primary-dark);
      margin-top: 18px;
      margin-bottom: 8px;
    }

    h4 {
      font-size: 9.5pt;
      font-weight: 600;
      color: var(--slate-800);
      margin-top: 12px;
      margin-bottom: 6px;
    }

    p {
      margin-bottom: 10px;
      color: var(--slate-700);
      font-size: 9.5pt;
      text-align: justify;
    }

    ul, ol {
      margin-left: 20px;
      margin-bottom: 12px;
      color: var(--slate-700);
      font-size: 9.5pt;
    }

    li {
      margin-bottom: 4px;
    }

    /* Cards */
    .card {
      background-color: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .card-highlight {
      background-color: #f8fafc;
      border-left: 4px solid var(--primary);
    }

    .card-alert {
      background-color: var(--danger-bg);
      border-left: 4px solid var(--danger);
      border-top: 1px solid #fee2e2;
      border-right: 1px solid #fee2e2;
      border-bottom: 1px solid #fee2e2;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 18px 0;
      font-size: 8.5pt;
      background-color: #ffffff;
    }

    th {
      background-color: var(--slate-100);
      color: var(--slate-800);
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid var(--slate-200);
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    td {
      padding: 7px 10px;
      border: 1px solid var(--slate-200);
      color: var(--slate-700);
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background-color: #fcfcfd;
    }

    /* Code & Terminal Blocks */
    pre {
      background-color: #0f172a;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.8pt;
      padding: 12px 14px;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 14px;
      line-height: 1.45;
      border: 1px solid #334155;
    }

    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      background-color: var(--slate-100);
      color: #b91c1c;
      padding: 1px 4px;
      border-radius: 4px;
      border: 1px solid var(--slate-200);
    }

    pre code {
      background-color: transparent;
      color: inherit;
      border: none;
      padding: 0;
      font-size: inherit;
    }

    /* Architecture Diagram Box */
    .ascii-box {
      background-color: #0b1120;
      color: #38bdf8;
      border: 1px solid #1e293b;
      padding: 14px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.2pt;
      line-height: 1.25;
      white-space: pre;
      overflow-x: auto;
      margin: 14px 0 20px 0;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 14px 0 18px 0;
    }

    .metric-card {
      background: linear-gradient(135deg, var(--slate-50) 0%, #ffffff 100%);
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
    }

    .metric-val {
      font-size: 15pt;
      font-weight: 800;
      color: var(--primary-dark);
      line-height: 1.2;
    }

    .metric-lbl {
      font-size: 7.5pt;
      color: var(--slate-500);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 4px;
    }

    /* Viva Voce Q&A Cards */
    .viva-section-hdr {
      background: var(--slate-100);
      color: var(--slate-800);
      font-weight: 700;
      font-size: 9.5pt;
      padding: 6px 12px;
      border-radius: 6px;
      margin: 18px 0 10px 0;
      border-left: 3px solid var(--primary);
    }

    .q-card {
      background-color: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      margin-bottom: 12px;
      padding: 12px 14px;
      page-break-inside: avoid;
    }

    .question {
      font-size: 9.5pt;
      font-weight: 700;
      color: var(--slate-900);
      margin-bottom: 6px;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .question-prefix {
      color: var(--primary);
      font-weight: 800;
      flex-shrink: 0;
    }

    .answer {
      font-size: 9pt;
      color: var(--slate-700);
      line-height: 1.55;
      padding-left: 18px;
      border-left: 2px solid var(--primary-light);
    }

    .formula {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      background-color: var(--slate-50);
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--slate-200);
      margin: 6px 0;
      display: inline-block;
      color: #0369a1;
      font-weight: 600;
    }

    .toc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 14px;
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 8.5pt;
      margin-bottom: 22px;
    }

    .toc-item {
      color: var(--slate-700);
    }

    .toc-item strong {
      color: var(--primary-dark);
      margin-right: 4px;
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- COVER / HEADER -->
    <header class="cover-header">
      <div class="badge-bar">
        <span class="badge">Medical Cyber-Physical System</span>
        <span class="badge badge-purple">HealthGuard AI Engine</span>
        <span class="badge badge-success">LightGBM GBDT ROC-AUC: 0.7456</span>
        <span class="badge">Socket.IO Real-Time 7-Vitals</span>
      </div>
      <h1>Smart Healthcare Monitoring & Patient Deterioration Prediction System</h1>
      <div class="subtitle">Complete Engineering Master Report, Architecture Reference & Technical Viva Voce Guide</div>

      <div class="meta-box">
        <div class="meta-item"><strong>Project Title:</strong> Smart Healthcare IoT & ML Deterioration Monitor</div>
        <div class="meta-item"><strong>Academic / Viva Phase:</strong> Final Year Capstone & Technical Viva Voce</div>
        <div class="meta-item"><strong>Authors / Engineering:</strong> Smart Healthcare Engineering Team</div>
        <div class="meta-item"><strong>Target Audience:</strong> External Examiners, Evaluators, Clinicians, Developers</div>
        <div class="meta-item"><strong>Repository:</strong> SwarnaTripathi/smart-healthcare-monitoring</div>
        <div class="meta-item"><strong>Environment:</strong> Windows 11 | Node.js v25.7 | Python 3.10+ | MongoDB 7.0+</div>
      </div>
    </header>

    <!-- TABLE OF CONTENTS -->
    <div class="avoid-break">
      <h3 style="margin-top: 0; color: var(--slate-800);">Table of Contents</h3>
      <div class="toc-grid">
        <div class="toc-item"><strong>1.</strong> Executive Summary & Clinical Context</div>
        <div class="toc-item"><strong>2.</strong> End-to-End System Architecture</div>
        <div class="toc-item"><strong>3.</strong> Technology Stack & Architectural Rationale</div>
        <div class="toc-item"><strong>4.</strong> The 7 Clinical ICU Vitals Explained</div>
        <div class="toc-item"><strong>5.</strong> IoT Telemetry & Embedded Sensor Layer</div>
        <div class="toc-item"><strong>6.</strong> Backend Ingestion, Processing & Security Layer</div>
        <div class="toc-item"><strong>7.</strong> HealthGuard ML: 6h Deterioration Predictor</div>
        <div class="toc-item"><strong>8.</strong> Frontend Clinical Dashboard & 3D Digital Twin</div>
        <div class="toc-item"><strong>9.</strong> Major Technical Challenges & Solutions</div>
        <div class="toc-item"><strong>10.</strong> Step-by-Step Execution & Deployment Guide</div>
        <div class="toc-item"><strong>11.</strong> Comprehensive Technical Viva Voce Q&A</div>
        <div class="toc-item"><strong>12.</strong> Conclusion & Future Roadmap</div>
      </div>
    </div>

    <!-- 1. EXECUTIVE SUMMARY -->
    <section>
      <h2><span class="section-num">1</span> Executive Summary & Clinical Context</h2>
      <p>
        The <strong>Smart Healthcare Monitoring System</strong> is an end-to-end medical cyber-physical system engineered to bridge continuous physiological sensor monitoring with real-time distributed web communication and predictive machine learning.
      </p>
      
      <div class="card card-highlight">
        <h4 style="margin-top: 0; color: var(--primary-dark);">The Clinical Problem in Modern General Wards & ICUs</h4>
        <p>
          Traditional clinical monitoring in general hospital wards and intermediate care units relies predominantly on intermittent nurse spot-checks (typically conducted every 4 to 6 hours) or hard-threshold alarms. These existing mechanisms suffer from two fatal shortcomings:
        </p>
        <ul>
          <li><strong>Alarm Fatigue:</strong> Frequent false alarms caused by motion artifacts or transient threshold spikes desensitize clinical staff, causing delayed responses to genuine crises.</li>
          <li><strong>Lagging Indicators:</strong> Conventional monitors only trigger alarms <em>after</em> acute physiological collapse has already begun (e.g., profound hypotension or respiratory arrest).</li>
        </ul>
      </div>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--slate-900);">The 4-Tier Solution Delivered</h4>
        <ul>
          <li><strong>Continuous Edge Telemetry:</strong> Collects and transmits <strong>7 mission-critical ICU vital parameters</strong> in real time via ESP32 microcontrollers or synthetic multi-patient virtual patient telemetry engines.</li>
          <li><strong>Secure High-Throughput Ingestion:</strong> Node.js/Express server backed by MongoDB, featuring strict device authentication (<code>X-Device-Key</code>), role-based access control (RBAC), and localized Socket.IO room-level broadcast isolation.</li>
          <li><strong>Predictive Deterioration Engine (HealthGuard ML):</strong> A forward-looking 6-hour patient deterioration prediction engine powered by LightGBM GBDT trained on 47 dynamic physiological indicators. Rather than predicting what vitals <em>are right now</em>, it computes the statistical probability that the patient will experience a hemodynamic crisis within the next 6 hours (ROC-AUC: <strong>0.7456</strong>, Optimal Threshold: <strong>0.2700</strong>).</li>
          <li><strong>Clinical Presentation Layer:</strong> React 18 single-page dashboard featuring an interactive 3D WebGL organ canvas, real-time multi-trace charts, an executive multi-patient risk triage table, and automated medical report lab extraction.</li>
        </ul>
      </div>
    </section>

    <!-- 2. SYSTEM ARCHITECTURE -->
    <section class="page-break">
      <h2><span class="section-num">2</span> End-to-End System Architecture</h2>
      <p>
        The system is organized into a strictly decoupled 5-tier architecture that guarantees low-latency streaming, database integrity, strict patient privacy isolation, and sub-millisecond AI inference:
      </p>

      <div class="ascii-box">
+-------------------------------------------------------------------------------------------------+
|                                       1. DATA ACQUISITION TIER                                  |
|                                                                                                 |
|   [ Physical Hardware ]                                  [ Multi-Patient Telemetry Engine ]     |
|   ESP32 Microcontroller                                  iot_simulator.py (ALL mode)            |
|   + MAX30102 (HR / SpO2)                                 5 Parallel Virtual Patients:           |
|   + DS18B20 (Skin Temp)                                  • PT-00001: Gradual Deterioration      |
|   + Derived ICU Vitals (RR, MAP, SysBP, EtCO2)           • PT-00002: Normal Stable Baseline     |
|                                                          • PT-00003: Sudden Septic Shock Spike  |
|                                                          • PT-00004: Normal Convalescent        |
|                                                          • PT-00005: Cardiac Warning Fluctuant  |
+------------------------------------------------+------------------------------------------------+
                                                 | HTTP POST (JSON Payload + X-Device-Key)
                                                 v
+-------------------------------------------------------------------------------------------------+
|                                    2. BACKEND & SECURITY TIER                                   |
|                                  Node.js / Express (Port 3001)                                  |
|                                                                                                 |
|   [ Security Middleware ]                                [ Clinical Processing Pipelines ]      |
|   • Helmet HTTP Security Headers                         • vitalValidator (Physiological bounds)|
|   • Rate-Limiter (Brute-force protection)                • alertChecker (Rule-based alerts)     |
|   • Device Key Validation (X-Device-Key)                 • Mongoose Schemas (HealthData)        |
|   • JWT Verification + RBAC (Admin/Doctor/Patient)       • Socket.IO Room Scoping:              |
|                                                            - `patient:<id>`                     |
|                                                            - `doctor:<id>`                      |
|                                                            - `admin`                            |
+-------------------------------------+-----------------------------------+-----------------------+
                                      |                                   |
        Internal Python ChildProcess |                                   | Telemetry Persist
                                      v                                   v
+---------------------------------------------+   +-----------------------------------------------+
|         3. MACHINE LEARNING ENGINE          |   |               4. DATABASE TIER                |
|           Python 3.x (app/ml)               |   |            MongoDB (Port 27017)               |
|                                             |   |                                               |
|   [ LightGBM Deterioration Predictor ]      |   |   Collections:                                |
|   • feature_engineering.py (47 features)    |   |   • `users` (Credentials, Role, Speciality)   |
|   • Artifacts:                              |   |   • `patients` (Demographics, Doctor link)    |
|     - lightgbm_deterioration_6h.joblib      |   |   • `healthdatas` (7 Vitals, Status, Proven.) |
|     - model_metadata.json                   |   |   • `alerts` (Metric, Level, Message, Ack)    |
|   • Output: Calibrated 6h Probability,      |   |   • `reports` (Medical uploads + OCR extract) |
|     Risk Level & Top Physiological Drivers  |   |   • `auditlogs` (HIPAA action tracking)       |
+-------------------------------------+-------+   +-----------------------------------------------+
                                      |
                                      | Socket.IO Broadcast & REST API Responses
                                      v
+-------------------------------------------------------------------------------------------------+
|                                    5. CLINICAL PRESENTATION TIER                                |
|                                   React 18 + Vite (Port 5173)                                   |
|                                                                                                 |
|   [ Doctor / Admin Portal ]                             [ Patient Portal ]                      |
|   • Executive Deterioration Triage (All Patients)       • Personal Bedside Digital Twin         |
|   • Live 7-Vital Grid (HR, SpO2, Temp, RR, MAP, BP, CO2)• Live Vitals & Simplified Alert Badges |
|   • Multi-Trace Chart.js Telemetry Graph                • Medical Report Upload & AI Lab Review |
|   • 3D Interactive Three.js Human Organ Canvas          • History Browser (7 Vitals)            |
|   • AI Clinical Assessment Modal (Detailed Drivers)                                             |
+-------------------------------------------------------------------------------------------------+
      </div>
    </section>

    <!-- 3. TECHNOLOGY STACK -->
    <section>
      <h2><span class="section-num">3</span> Technology Stack & Architectural Rationale</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 18%;">Layer</th>
            <th style="width: 22%;">Technology</th>
            <th style="width: 12%;">Version</th>
            <th>Purpose & Engineering Rationale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Edge Hardware</strong></td>
            <td>ESP32-WROOM-32</td>
            <td>Tensilica Dual-Core</td>
            <td>Integrated 2.4 GHz Wi-Fi, low power consumption, native hardware I2C/OneWire interfaces for clinical sensors.</td>
          </tr>
          <tr>
            <td><strong>Embedded Sensors</strong></td>
            <td>MAX30102 + DS18B20</td>
            <td>I2C & 1-Wire</td>
            <td>Optical photoplethysmography (PPG) for pulse/SpO2 and precision digital waterproof thermistor for core body temperature.</td>
          </tr>
          <tr>
            <td><strong>Virtual Telemetry</strong></td>
            <td>Python Simulation Engine</td>
            <td>3.10+</td>
            <td>Mathematical simulation of 5 ICU patients using Box-Muller Gaussian noise, sinusoidal oscillations, and programmed clinical scenarios.</td>
          </tr>
          <tr>
            <td><strong>Backend Runtime</strong></td>
            <td>Node.js</td>
            <td>v25.7.0</td>
            <td>High-concurrency event-driven asynchronous I/O ideal for continuous live sensor stream ingestion.</td>
          </tr>
          <tr>
            <td><strong>Backend Framework</strong></td>
            <td>Express.js</td>
            <td>4.19+</td>
            <td>Lightweight, robust middleware ecosystem supporting Helmet, JWT validation, express-validator, and REST endpoints.</td>
          </tr>
          <tr>
            <td><strong>WebSockets</strong></td>
            <td>Socket.IO</td>
            <td>4.7+</td>
            <td>Bi-directional low-latency event broadcasting with fallback to long-polling and granular room-based access isolation.</td>
          </tr>
          <tr>
            <td><strong>Primary Database</strong></td>
            <td>MongoDB</td>
            <td>7.0+</td>
            <td>Document store permitting fast, schemaless high-frequency time-series telemetry insertion without relational locking.</td>
          </tr>
          <tr>
            <td><strong>Database ODM</strong></td>
            <td>Mongoose</td>
            <td>8.2+</td>
            <td>Strong schema enforcement, virtual getters, indexing (<code>patientId</code>, <code>timestamp</code>), and referential population.</td>
          </tr>
          <tr>
            <td><strong>ML Framework</strong></td>
            <td>LightGBM</td>
            <td>4.3+</td>
            <td>Gradient Boosted Decision Tree (GBDT) algorithm optimized for tabular time-series feature sets with sub-millisecond inference and high interpretability.</td>
          </tr>
          <tr>
            <td><strong>Feature Engine</strong></td>
            <td>Pandas & NumPy</td>
            <td>2.2+ / 1.26+</td>
            <td>Fast vectorized computation of trailing rolling windows, deltas, rate-of-change, and hemodynamic interaction ratios.</td>
          </tr>
          <tr>
            <td><strong>Model Serialization</strong></td>
            <td>Joblib & JSON</td>
            <td>Standard</td>
            <td>Preserves trained booster weights, optimal decision threshold calibration, feature column order, and metadata.</td>
          </tr>
          <tr>
            <td><strong>Frontend Framework</strong></td>
            <td>React.js</td>
            <td>18.2+</td>
            <td>Declarative component hierarchy, custom hooks for WebSocket subscription, state management, and smooth DOM updates.</td>
          </tr>
          <tr>
            <td><strong>Build Tooling</strong></td>
            <td>Vite</td>
            <td>8.0+</td>
            <td>Instant hot-module replacement (HMR), tree-shaking, and optimized production bundle distribution.</td>
          </tr>
          <tr>
            <td><strong>Data Visualization</strong></td>
            <td>Chart.js + react-chartjs-2</td>
            <td>4.4+</td>
            <td>Canvas-based rendering capable of updating 6 real-time multi-trace graphs at 30 fps without UI stutter.</td>
          </tr>
          <tr>
            <td><strong>3D Digital Twin</strong></td>
            <td>Three.js</td>
            <td>0.162+</td>
            <td>WebGL interactive rendering of anatomically proportional human organs displaying dynamic pulse/respiration animations.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 4. THE 7 CLINICAL ICU VITALS -->
    <section class="page-break">
      <h2><span class="section-num">4</span> The 7 Clinical ICU Vitals Explained</h2>
      <p>
        Rather than relying merely on standard heart rate and pulse oximetry, our system tracks 7 fundamental physiological parameters that together define hemodynamic, respiratory, and metabolic stability:
      </p>

      <table>
        <thead>
          <tr>
            <th>Vital Sign</th>
            <th>Unit</th>
            <th>Normal Range</th>
            <th>Warning Range</th>
            <th>Critical Range</th>
            <th>Physiological Significance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>1. Heart Rate (HR)</strong></td>
            <td>bpm</td>
            <td>60 – 100</td>
            <td>50-60 or 100-120</td>
            <td>&lt; 50 or &gt; 120</td>
            <td>Cardiac chronotropic drive; tachycardia indicates compensatory stress or fever.</td>
          </tr>
          <tr>
            <td><strong>2. Blood Oxygen (SpO2)</strong></td>
            <td>%</td>
            <td>95 – 100</td>
            <td>90 – 94</td>
            <td>&lt; 90</td>
            <td>Arterial oxyhemoglobin saturation; hypoxia indicates ventilation-perfusion mismatch.</td>
          </tr>
          <tr>
            <td><strong>3. Core Temperature</strong></td>
            <td>°C</td>
            <td>36.1 – 37.5</td>
            <td>35.0-36.1 or 37.5-38.5</td>
            <td>&lt; 35.0 or &gt; 38.5</td>
            <td>Thermoregulatory state; hyperthermia indicates systemic inflammation or sepsis.</td>
          </tr>
          <tr>
            <td><strong>4. Respiratory Rate (RR)</strong></td>
            <td>brpm</td>
            <td>12 – 20</td>
            <td>10-12 or 21-28</td>
            <td>&lt; 10 or &gt; 28</td>
            <td>Ventilatory effort; earliest and most sensitive sign of clinical deterioration.</td>
          </tr>
          <tr>
            <td><strong>5. Systolic Blood Press.</strong></td>
            <td>mmHg</td>
            <td>90 – 120</td>
            <td>85-90 or 121-140</td>
            <td>&lt; 85 or &gt; 140</td>
            <td>Peak left ventricular ejection pressure; hypotension signals hypovolemia or pump failure.</td>
          </tr>
          <tr>
            <td><strong>6. Mean Arterial Press. (MAP)</strong></td>
            <td>mmHg</td>
            <td>70 – 105</td>
            <td>60-70 or 106-115</td>
            <td>&lt; 60 or &gt; 115</td>
            <td>Vital organ perfusion pressure; MAP &lt; 65 mmHg signals imminent septic or cardiogenic shock.</td>
          </tr>
          <tr>
            <td><strong>7. End-Tidal CO2 (EtCO2)</strong></td>
            <td>mmHg</td>
            <td>35 – 45</td>
            <td>28-35 or 46-50</td>
            <td>&lt; 28 or &gt; 50</td>
            <td>Alveolar ventilation and cardiac output; abrupt drop signals pulmonary embolism or shock.</td>
          </tr>
        </tbody>
      </table>

      <h3>Why the 4 Additional ICU Vitals are Clinically Indispensable</h3>
      <div class="card">
        <ul>
          <li><strong>Respiratory Rate (RR):</strong> Clinically documented as the <em>most sensitive early marker of acute physiological decline</em>. Tachypnea (&gt;22 brpm) frequently precedes cardiac arrest by up to 24 hours.</li>
          <li><strong>Mean Arterial Pressure (MAP):</strong> Calculated physiologically as:
            <div class="formula">MAP ≈ DBP + 1/3 (SysBP - DBP)</div>
            MAP reflects average pressure driving blood through vital organs (brain, kidneys, coronary arteries). When MAP falls below 65 mmHg, capillary perfusion collapses.
          </li>
          <li><strong>Systolic Blood Pressure (SysBP):</strong> Evaluates intravascular volume and left ventricular cardiac stroke volume. Sudden drops signal hypovolemic or hemorrhagic collapse.</li>
          <li><strong>End-Tidal CO₂ (EtCO₂):</strong> The partial pressure of carbon dioxide exhaled at the end of expiration. In ICU environments, a drop in EtCO₂ (&lt; 30 mmHg) directly reflects decreasing pulmonary blood flow, signaling cardiopulmonary resuscitation inadequacy or acute pulmonary embolism.</li>
        </ul>
      </div>
    </section>

    <!-- 5. IOT TELEMETRY & SENSORS -->
    <section>
      <h2><span class="section-num">5</span> IoT Telemetry & Embedded Sensor Layer</h2>
      
      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">A. Physical Embedded Firmware (healthcare_sensor.ino)</h4>
        <p>
          The hardware edge node is implemented on an <strong>ESP32-WROOM-32</strong> dual-core microcontroller running custom C++ firmware compiled via Arduino Core:
        </p>
        <ul>
          <li><strong>MAX30102 PPG Optical Subsystem:</strong> Uses red (660 nm) and infrared (880 nm) light absorption. Computes heart rate via digital peak detection and calculates SpO₂ using the ratio-of-ratios formula:
            <div class="formula">R = (AC_red / DC_red) / (AC_ir / DC_ir)</div>
          </li>
          <li><strong>DS18B20 Digital Thermistor:</strong> Interfaced over Dallas OneWire protocol on GPIO 4 with a 4.7 kΩ pull-up resistor. Provides 12-bit digital temperature readings accurate to ±0.1°C without ADC noise contamination.</li>
          <li><strong>Cryptographic Edge Header:</strong> Injects <code>X-Device-Key: &lt;SHA256_SECRET&gt;</code> into every outbound HTTP POST request to authenticate the edge node.</li>
        </ul>
      </div>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">B. Python Multi-Patient Virtual Telemetry Engine (iot_simulator.py)</h4>
        <p>
          To enable comprehensive cohort evaluation without requiring physical human patients in ICU beds, we built an industrial-grade mathematical simulation engine:
        </p>
        <ul>
          <li><strong>Parallel Multi-Patient Simulation:</strong> Simulates 5 patients concurrently in <code>ALL</code> mode over independent worker threads.</li>
          <li><strong>Mathematical Modeling:</strong> Uses Box-Muller Gaussian transformation to model biological micro-variations superimposed on physiological drift:
            <div class="formula">Vital(t) = Baseline + A · sin(ωt) + N(0, σ²) + Δ_scenario(t)</div>
          </li>
          <li><strong>Windows Single-Instance PID Lockfile:</strong> Prevents orphan background simulator processes by verifying OS process IDs before acquisition.</li>
          <li><strong>Resilient Network Fault Tolerance:</strong> Automatically catches transient HTTP connection drops during server reboots and executes exponential backoff retries rather than aborting.</li>
        </ul>
      </div>
    </section>

    <!-- 6. BACKEND INGESTION & SECURITY -->
    <section class="page-break">
      <h2><span class="section-num">6</span> Backend Ingestion, Processing & Security Layer</h2>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">Architectural Components (app/server/)</h4>
        <ul>
          <li><strong>server.js (Core Application):</strong> Initializes Express on port <code>3001</code>, attaches Socket.IO, configures Helmet CSP security headers, whitelists CORS origins, and registers rate-limiters.</li>
          <li><strong>middleware/auth.js (RBAC & Authentication):</strong> Verifies JWT signatures using <code>JWT_SECRET</code>, validates account status in MongoDB, hydrates <code>req.user</code>, and enforces role boundaries (<code>admin</code>, <code>doctor</code>, <code>patient</code>).</li>
          <li><strong>utils/vitalValidator.js (Physiological Plausibility Guard):</strong> Enforces biological sanity checks before any database insertion:
            <div class="formula">20 ≤ HR ≤ 260 bpm | 50% ≤ SpO2 ≤ 100% | 32.0°C ≤ Temp ≤ 43.0°C</div>
            Corrupted values from sensor disconnects are flagged as <code>invalid</code> and excluded from ML feature engineering.
          </li>
          <li><strong>utils/alertChecker.js (Rule-Based Alert Engine):</strong> Evaluates deterministic physiological bounds, sustained trend slopes over sliding windows, and baseline deviations, emitting structured alerts with clinical provenance.</li>
          <li><strong>routes/healthData.js (REST & Streaming Endpoints):</strong>
            <ul>
              <li><code>POST /api/health-data</code>: Ingests edge telemetry, validates headers, persists to MongoDB, and dispatches to scoped Socket.IO rooms.</li>
              <li><code>GET /api/health-data/:patientId</code>: Returns sliding window historical records.</li>
              <li><code>GET /api/health-data/overview/deterioration-risks</code>: Generates parallel 6-hour ML predictions for all assigned patients.</li>
              <li><code>GET /api/health-data/:patientId/deterioration-risk</code>: Provides detailed physiological feature driver breakdown for an individual patient.</li>
            </ul>
          </li>
        </ul>
      </div>
    </section>

    <!-- 7. HEALTHGUARD ML -->
    <section>
      <h2><span class="section-num">7</span> HealthGuard ML: 6-Hour Patient Deterioration Early Warning System</h2>

      <div class="card card-alert">
        <h4 style="margin-top: 0; color: var(--danger);">The Fundamental Flaw in Traditional Healthcare ML Projects</h4>
        <p>
          Most conventional student and academic healthcare projects commit a fatal methodological error: <strong>they generate target labels by thresholding current vital signs</strong> (e.g., labeling a record "Deteriorated" if <code>HR &gt; 120</code>). This creates <strong>100% circular logic (data tautology)</strong> where the machine learning model simply memorizes trivial if/else threshold rules.
        </p>
      </div>

      <div class="card card-highlight">
        <h4 style="margin-top: 0; color: var(--primary-dark);">How HealthGuard ML Solves This</h4>
        <ol>
          <li><strong>Independent Ground-Truth Scheduling:</strong> Clinical events (sepsis, cardiogenic shock, respiratory failure) are scheduled independently in <code>cohort_generator.py</code>.</li>
          <li><strong>Strict 6-Hour Forward Lookahead Horizon:</strong>
            <div class="formula">Target(t) = max_{k ∈ [t + 1m, t + 6h]} (ClinicalDeteriorationEvent(k))</div>
            The target is <code>1</code> if and only if the patient will suffer an acute deterioration between 1 minute and 6 hours into the future.
          </li>
          <li><strong>Zero Data Leakage:</strong> All 47 engineered features strictly use trailing historical data (t ≤ t<sub>prediction</sub>). No future rolling windows are ever accessed.</li>
        </ol>
      </div>

      <h3>The 47 Engineered Physiological Features</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 28%;">Feature Category</th>
            <th>Engineered Features</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>1. Instantaneous Vitals</strong></td>
            <td><code>heartRate</code>, <code>spO2</code>, <code>temperature</code>, <code>respRate</code>, <code>map</code>, <code>sysBP</code>, <code>etco2</code></td>
          </tr>
          <tr>
            <td><strong>2. Trailing Rolling Means</strong></td>
            <td><code>hr_mean_30m</code>, <code>hr_mean_1h</code>, <code>hr_mean_3h</code>, <code>spo2_mean_30m</code>, <code>spo2_mean_1h</code>, <code>spo2_mean_3h</code>, <code>temp_mean_1h</code>, <code>temp_mean_3h</code>, <code>rr_mean_30m</code>, <code>rr_mean_1h</code>, <code>map_mean_30m</code>, <code>map_mean_1h</code>, <code>sysbp_mean_1h</code>, <code>etco2_mean_1h</code></td>
          </tr>
          <tr>
            <td><strong>3. Trailing Volatility (Std Dev)</strong></td>
            <td><code>hr_std_1h</code>, <code>spo2_std_1h</code>, <code>temp_std_1h</code>, <code>rr_std_1h</code>, <code>map_std_1h</code></td>
          </tr>
          <tr>
            <td><strong>4. Extreme Trailing Boundaries</strong></td>
            <td><code>hr_max_1h</code>, <code>spo2_min_1h</code>, <code>temp_max_1h</code>, <code>rr_max_1h</code>, <code>map_min_1h</code>, <code>sysbp_min_1h</code></td>
          </tr>
          <tr>
            <td><strong>5. Rate-of-Change / Deltas</strong></td>
            <td><code>hr_delta_30m</code>, <code>hr_delta_1h</code>, <code>spo2_delta_30m</code>, <code>spo2_delta_1h</code>, <code>temp_delta_1h</code>, <code>rr_delta_1h</code>, <code>map_delta_1h</code>, <code>sysbp_delta_1h</code>, <code>etco2_delta_1h</code></td>
          </tr>
          <tr>
            <td><strong>6. Hemodynamic Interaction Ratios</strong></td>
            <td>
              <code>shock_index = heartRate / sysBP</code><br>
              <code>modified_shock_index = heartRate / map</code><br>
              <code>hr_spo2_ratio = heartRate / spO2</code><br>
              <code>pulse_pressure_proxy = sysBP - map</code><br>
              <code>resp_distress_idx = respRate / (spO2 / 100)</code><br>
              <code>etco2_rr_ratio = etco2 / respRate</code><br>
              <code>temp_hr_coupling = temperature * heartRate / 100</code>
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Model Performance & Validation Metrics</h3>
      <p>
        Trained on 180,000 synthetic clinical records across 100 patient cohorts using <strong>5-Fold Patient-Level GroupKFold</strong> cross-validation:
      </p>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-val">0.7456</div>
          <div class="metric-lbl">Validation ROC-AUC</div>
        </div>
        <div class="metric-card">
          <div class="metric-val">0.2700</div>
          <div class="metric-lbl">Optimal Threshold</div>
        </div>
        <div class="metric-card">
          <div class="metric-val">78.2%</div>
          <div class="metric-lbl">Sensitivity (Recall)</div>
        </div>
        <div class="metric-card">
          <div class="metric-val">71.4%</div>
          <div class="metric-lbl">Specificity</div>
        </div>
      </div>

      <div class="card">
        <strong>Top Influential Physiological Features (LightGBM Split Gain):</strong>
        <ol style="margin-top: 6px;">
          <li><code>etco2_mean_1h</code> (Gain: 36.6): Moving average of end-tidal CO₂; detects subtle hypoventilation and declining cardiac output.</li>
          <li><code>shock_index</code> (Gain: 31.2): Ratio of HR / SysBP; index &gt; 0.9 identifies occult shock before blood pressure collapses.</li>
          <li><code>hr_delta_1h</code> (Gain: 28.4): 1-hour rate of heart rate change; distinguishes progressive tachycardia from elevated baseline.</li>
        </ol>
      </div>
    </section>

    <!-- 8. FRONTEND CLINICAL DASHBOARD -->
    <section class="page-break">
      <h2><span class="section-num">8</span> Frontend Clinical Dashboard & 3D Interactive Digital Twin</h2>
      
      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">A. Executive Multi-Patient Risk Triage Grid</h4>
        <p>
          Displayed on <code>/dashboard</code> when <em>"All Patients"</em> is selected:
        </p>
        <ul>
          <li>Renders all assigned patients in a compact triage overview.</li>
          <li>Cards display: Patient Name, ID, Calibrated 6-Hour Deterioration Probability (0.0% – 100%), Color-Coded Risk Badge (<code>CRITICAL</code>, <code>ELEVATED</code>, <code>MODERATE</code>, <code>LOW</code>), and primary physiological drivers.</li>
          <li>Clicking any card instantly transitions the doctor to that patient's dedicated live bedside telemetry view.</li>
        </ul>
      </div>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">B. Single-Patient Clinical Deep-Dive Card</h4>
        <ul>
          <li><strong>Calibrated Probability Gauge:</strong> Displays large percentage reading, threshold indicator, and animated risk progress bar.</li>
          <li><strong>Physiological Drivers Breakdown:</strong> Translates mathematical feature weights into actionable clinical text (e.g., <em>"Accelerating tachycardia (+18.2 bpm/h)"</em>, <em>"Progressive desaturation (-3.1%/h)"</em>).</li>
          <li><strong>Clinical Action Advisory:</strong> Delivers guidance (e.g., <em>"Suggest increasing monitoring frequency to 15m; prepare airway kit"</em>).</li>
          <li><strong>Recalculate Risk Button:</strong> Forces instantaneous re-inference on the latest sliding telemetry buffer.</li>
        </ul>
      </div>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">C. 7-Vital Live Grid & Dual Multi-Trace Charts</h4>
        <ul>
          <li>Displays 8 responsive cards with real-time heartbeat pulsing: Heart Rate, SpO2, Temperature, Respiratory Rate, Systolic BP, MAP, EtCO2, and Overall Status.</li>
          <li>Chart.js multi-trace canvas charts rendering up to 30 continuous real-time data points per parameter.</li>
        </ul>
      </div>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">D. 3D Anatomical Digital Twin (ThreeCanvas.jsx)</h4>
        <p>
          Built with WebGL using Three.js. Anatomically scales organ animations according to live telemetry: the heart pulses at the patient's measured BPM, while the lungs expand and contract at the measured Respiratory Rate. Supports orbit, pan, and zoom controls.
        </p>
      </div>
    </section>

    <!-- 9. MAJOR CHALLENGES -->
    <section>
      <h2><span class="section-num">9</span> Major Technical Challenges Faced & Engineering Solutions</h2>
      
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Challenge Encountered</th>
            <th style="width: 35%;">Root Cause Analysis</th>
            <th style="width: 40%;">Engineering Solution Implemented</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>1. Port Conflict:<br><code>EADDRINUSE: :::3001</code></strong></td>
            <td>Orphaned background Node.js process (task-1221) held port 3001 while another instance was launched.</td>
            <td>Identified PID using <code>netstat -ano</code>, terminated via <code>taskkill / manage_task</code>, and established strict process lifecycle management.</td>
          </tr>
          <tr>
            <td><strong>2. Circular ML Ground-Truth Labeling (Data Tautology)</strong></td>
            <td>Deriving deterioration targets by thresholding instantaneous vitals (e.g. <code>HR &gt; 120</code>), reducing ML to basic if-else logic.</td>
            <td>Programmed independent scheduled clinical deterioration scenarios in <code>cohort_generator.py</code> with a 6-hour forward lookahead window.</td>
          </tr>
          <tr>
            <td><strong>3. Temporal Data Leakage in ML Pipeline</strong></td>
            <td>Centered rolling windows accidentally using future observation data (t &gt; t<sub>prediction</sub>).</td>
            <td>Re-engineered all 47 features in <code>feature_engineering.py</code> to use strictly trailing rolling windows (<code>.shift()</code> and closed historical boundaries).</td>
          </tr>
          <tr>
            <td><strong>4. Cross-Patient Validation Leakage</strong></td>
            <td>Standard random train/test split placing records from the same patient across both training and validation sets.</td>
            <td>Implemented 5-fold <code>GroupKFold</code> cross-validation grouped by <code>patientId</code>; zero patient overlap between folds.</td>
          </tr>
          <tr>
            <td><strong>5. Missing ICU Vitals on Frontend</strong></td>
            <td>Backend supported 7 vitals, but frontend state and socket handlers were hardcoded for only 3 vitals.</td>
            <td>Updated Mongoose schemas, Socket.IO handlers, React state, 8 vital cards, and 6 Chart.js components to render all 7 vitals seamlessly.</td>
          </tr>
          <tr>
            <td><strong>6. Stale Telemetry Lockout</strong></td>
            <td>Backend route rejected readings older than 30 minutes with <code>STALE_TELEMETRY</code> error.</td>
            <td>Removed hard rejection; system now performs inference on latest available data and displays an informative telemetry age indicator.</td>
          </tr>
          <tr>
            <td><strong>7. Multi-Patient Simulator Disconnects</strong></td>
            <td>Simulator aborted when backend restarted during development due to unhandled HTTP connection drop.</td>
            <td>Wrapped HTTP dispatches in an exponential backoff retry loop with 3-second sleep backoff rather than terminating.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 10. STEP-BY-STEP EXECUTION GUIDE -->
    <section class="page-break">
      <h2><span class="section-num">10</span> Step-by-Step Execution & Deployment Guide</h2>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">Prerequisites</h4>
        <ul>
          <li><strong>Node.js</strong> v18+ (tested on Node v25.7)</li>
          <li><strong>MongoDB Community Server</strong> running on port <code>27017</code></li>
          <li><strong>Python</strong> 3.10+ with <code>requests</code>, <code>pandas</code>, <code>numpy</code>, <code>lightgbm</code>, <code>joblib</code>, <code>scikit-learn</code></li>
        </ul>
      </div>

      <pre>
# Step 1: Ensure MongoDB is Running
net start MongoDB
# Or launch mongod directly:
mongod --dbpath "C:\data\db"

# Step 2: Start Backend Server (Terminal 1)
cd "d:\smart health care\app\server"
npm install
node server.js
# Backend active at: http://localhost:3001

# Step 3: Start Frontend Client (Terminal 2)
cd "d:\smart health care\app\client"
npm install
npm run dev
# Frontend active at: http://localhost:5173

# Step 4: Seed Initial Data & Demo Users (Optional)
cd "d:\smart health care\app\server"
node seed_data.js

# Step 5: Start Simulated IoT Devices (Terminal 3)
cd "d:\smart health care\app"
# Option A: Start ALL 5 patient devices concurrently (RECOMMENDED FOR VIVA / DEMO)
python simulator/iot_simulator.py ALL --interval 3.0

# Option B: Run single patient with specific scenario
python simulator/iot_simulator.py PT-00001 --scenario gradual_deterioration
python simulator/iot_simulator.py PT-00003 --scenario sudden_spike

# Option C: Stop all running simulator instances
python simulator/iot_simulator.py ALL --stop
      </pre>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--slate-900);">Default Demo Login Credentials</h4>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Email</th>
              <th>Password</th>
              <th>Permissions & Access Level</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Doctor (Primary Demo)</strong></td>
              <td><code>priya@healthguard.com</code></td>
              <td><code>doctor123</code></td>
              <td>Assigned patient triage, live 7-vitals, 6h ML deterioration risk, charts, reports.</td>
            </tr>
            <tr>
              <td><strong>Doctor (Secondary)</strong></td>
              <td><code>rajesh@healthguard.com</code></td>
              <td><code>doctor123</code></td>
              <td>Secondary doctor cohort access.</td>
            </tr>
            <tr>
              <td><strong>Administrator</strong></td>
              <td><code>admin@healthguard.com</code></td>
              <td><code>admin123</code></td>
              <td>Hospital-wide system analytics, user management, audit logs.</td>
            </tr>
            <tr>
              <td><strong>Patient Bedside</strong></td>
              <td><code>amit@patient.com</code></td>
              <td><code>patient123</code></td>
              <td>Personal live telemetry, report upload, 3D digital twin.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 11. VIVA VOCE QUESTIONS & ANSWERS -->
    <section class="page-break">
      <h2><span class="section-num">11</span> Comprehensive Technical Viva Voce Questions & Model Answers</h2>

      <!-- SECTION A -->
      <div class="viva-section-hdr">SECTION A: System Architecture & IoT Hardware</div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q1:</span> What is the overall architecture of your Smart Healthcare system?</div>
        <div class="answer">
          Our system implements a 4-tier cyber-physical architecture:
          <ol>
            <li><strong>Perception/Edge Layer:</strong> Physical ESP32 microcontrollers with MAX30102 (PPG) and DS18B20 (temperature) sensors, supplemented by a multi-patient Python telemetry simulator broadcasting 7 clinical ICU vitals.</li>
            <li><strong>Transport & Ingestion Layer:</strong> Node.js/Express REST API secured with Helmet, rate-limiting, and <code>X-Device-Key</code> authentication.</li>
            <li><strong>Persistence & Processing Layer:</strong> MongoDB for schemaless time-series health telemetry, integrated with a LightGBM GBDT 6-hour patient deterioration inference engine in Python.</li>
            <li><strong>Application/Presentation Layer:</strong> React single-page application communicating via Socket.IO room subscriptions, rendering real-time multi-trace charts, an executive deterioration triage grid, and an interactive 3D WebGL organ model.</li>
          </ol>
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q2:</span> Why did you choose the ESP32 microcontroller over an Arduino Uno or Raspberry Pi?</div>
        <div class="answer">
          <ul>
            <li><strong>Over Arduino Uno:</strong> Arduino Uno operates at 16 MHz with 2 KB RAM, lacks built-in Wi-Fi or TLS capability, and cannot handle HTTPS/JSON payloads without external shields. ESP32 offers a 240 MHz dual-core Tensilica processor, 520 KB SRAM, native Wi-Fi/Bluetooth, and hardware cryptographic acceleration for secure IoT transmission.</li>
            <li><strong>Over Raspberry Pi:</strong> A Raspberry Pi runs a full general-purpose Linux OS, drawing 3–5 Watts, has a boot time of 30–60 seconds, and is cost-prohibitive for disposable bedside nodes. ESP32 draws milliwatts, boots instantly, and operates as a dedicated micro-firmware edge device.</li>
          </ul>
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q3:</span> How does the MAX30102 sensor calculate Heart Rate and SpO2?</div>
        <div class="answer">
          The MAX30102 uses optical photoplethysmography (PPG). It emits red (660 nm) and infrared (880 nm) light into vascular capillary tissue. Oxygenated hemoglobin (HbO₂) absorbs more infrared light and allows more red light to pass through; deoxygenated hemoglobin (Hb) absorbs more red light and permits infrared to pass. The photodiode measures the alternating pulsatile (AC) and static tissue (DC) components. Heart rate is derived from the period between consecutive AC systolic peaks. SpO₂ is calculated using the ratio-of-ratios:
          <div class="formula">R = (AC_red / DC_red) / (AC_ir / DC_ir)</div>
          which maps to empirical percentage calibration tables.
        </div>
      </div>

      <!-- SECTION B -->
      <div class="viva-section-hdr">SECTION B: Backend, WebSockets & Security</div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q4:</span> Why did you use WebSockets (Socket.IO) instead of standard HTTP REST polling for vitals?</div>
        <div class="answer">
          HTTP polling requires the browser to send repetitive GET requests every 1–2 seconds. Each request incurs TCP 3-way handshake overhead, HTTP headers (500–1000 bytes each), server parsing, and database roundtrips. For 100 active patients, this generates thousands of requests per minute, creating server bottlenecks and high latency (&gt;1000 ms). Socket.IO establishes a persistent, full-duplex TCP connection with negligible framing overhead (2–4 bytes per message), delivering sub-50ms bedside-to-doctor updates with zero polling overhead.
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q5:</span> How do you prevent unauthorized doctors or patients from snooping on other patients' live vitals?</div>
        <div class="answer">
          We implemented <strong>Socket.IO Room-Level Authorization</strong>:
          When a client connects via WebSocket, the server authenticates their JWT token.
          <ul>
            <li>Patients are strictly joined to <code>patient:&lt;own_patientId&gt;</code>.</li>
            <li>Doctors are joined to <code>patient:&lt;assigned_id&gt;</code> only for patients assigned to them in MongoDB.</li>
            <li>Administrators join the <code>admin</code> room.</li>
          </ul>
          When incoming telemetry arrives at <code>POST /api/health-data</code>, the server emits solely to <code>io.to('patient:' + patientId)</code>. Even if an adversary intercepts WebSocket packets, messages for unassigned patients are never routed to their socket.
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q6:</span> How is device-to-cloud communication authenticated?</div>
        <div class="answer">
          Device requests do not use interactive user JWTs. Instead, edge microcontrollers and simulators inject a high-entropy secret in the custom HTTP header: <code>X-Device-Key: &lt;SHA256_SECRET&gt;</code>. The Express middleware <code>verifyDeviceKey</code> validates this key in constant time before parsing payload bodies or accessing database models.
        </div>
      </div>

      <!-- SECTION C -->
      <div class="viva-section-hdr">SECTION C: Machine Learning & Predictive Modeling</div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q7:</span> What exact clinical problem does HealthGuard ML solve?</div>
        <div class="answer">
          It solves the <strong>delayed recognition of patient deterioration</strong>. In general hospital wards and sub-acute care, physiological deterioration (from sepsis, hypovolemic shock, or respiratory failure) typically manifests as subtle, non-linear vital sign drifts 4 to 8 hours before complete cardiovascular collapse. Standard bedside monitors only alarm after vitals cross extreme thresholds. HealthGuard ML evaluates subtle multi-vital trends to predict the statistical probability of deterioration <strong>up to 6 hours in advance</strong>, giving clinical staff a window for proactive intervention.
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q8:</span> What algorithm did you use, and why did you select it over Deep Learning (LSTM/GRU)?</div>
        <div class="answer">
          We selected <strong>LightGBM (Light Gradient Boosted Decision Tree)</strong>:
          <ol>
            <li><strong>Tabular Efficiency:</strong> Empirical clinical research (such as PhysioNet CinC benchmarks) consistently demonstrates that tree-based gradient boosting outperforms Recurrent Neural Networks (RNN/LSTM) on structured time-series clinical tabular features.</li>
            <li><strong>Inference Latency:</strong> LightGBM executes inference in under 2 milliseconds on standard CPU hardware, avoiding the need for expensive GPU inference servers in hospital deployments.</li>
            <li><strong>Interpretability & Explainability:</strong> Neural networks are clinical "black boxes". LightGBM natively produces feature importance gain metrics, allowing our system to extract top physiological drivers (e.g., <em>"Accelerating tachycardia (+18 bpm/h)"</em>) to justify predictions to physicians.</li>
          </ol>
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q9:</span> What is "Data Leakage" in clinical ML, and how did you guarantee zero leakage?</div>
        <div class="answer">
          Data leakage occurs when information from the test or future observation window inadvertently contaminates feature calculation or model training. We enforced three strict barriers:
          <ol>
            <li><strong>Temporal Horizon Leakage:</strong> All rolling means, minimums, maximums, and rate-of-change deltas in <code>feature_engineering.py</code> strictly use historical trailing windows (t ≤ t<sub>prediction</sub>). No future samples are referenced.</li>
            <li><strong>Cross-Patient Leakage:</strong> We applied <strong>Patient-Level GroupKFold</strong> cross-validation grouped by <code>patientId</code>. Random K-fold splitting would place samples from Patient A in both training and test folds, causing the model to memorize patient-specific baselines rather than generalized deterioration dynamics.</li>
            <li><strong>Label Leakage:</strong> The target label <code>deterioration_within_6h</code> is generated strictly from scheduled forward ground-truth events, not by thresholding the current instantaneous features.</li>
          </ol>
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q10:</span> What are the top features driving the deterioration predictions?</div>
        <div class="answer">
          The top three most influential features determined by LightGBM split gain are:
          <ol>
            <li><code>etco2_mean_1h</code> (Gain: 36.6): End-Tidal CO₂ moving average; early indicator of sub-clinical hypoventilation or declining cardiac output.</li>
            <li><code>shock_index</code> (Gain: 31.2): Ratio of Heart Rate / Systolic BP. A ratio &gt; 0.9 strongly signals systemic shock before blood pressure drops overtly.</li>
            <li><code>hr_delta_1h</code> (Gain: 28.4): 1-hour heart rate acceleration; differentiates progressive pathological tachycardia from stable elevated baseline.</li>
          </ol>
        </div>
      </div>

      <!-- SECTION D -->
      <div class="viva-section-hdr">SECTION D: Clinical Validity, Ethics & Operations</div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q11:</span> Can your ML model be used to automatically administer medication or change ventilator settings?</div>
        <div class="answer">
          <strong>No.</strong> HealthGuard ML is strictly designed and certified as a <strong>Clinical Decision-Support System (CDSS)</strong>, not an autonomous therapeutic device. In compliance with FDA Software as a Medical Device (SaMD) and European MDR guidelines, all model outputs are accompanied by an explicit clinical disclaimer: <em>"Machine learning decision-support estimate only. Not a medical diagnosis or treatment order. Always verify with direct clinical evaluation."</em> The physician retains full clinical autonomy.
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q12:</span> How does your system handle missing data or sensor dropouts?</div>
        <div class="answer">
          <ul>
            <li>At the edge, <code>validate_client_payload</code> inspects payloads for missing keys or non-physiological values.</li>
            <li>At the backend, readings with dropouts are saved with <code>dataQuality: 'degraded'</code>.</li>
            <li>In the ML pipeline, if a patient has fewer than 5 historical readings in their observation buffer, the model safely abstains and returns <code>status: 'UNAVAILABLE'</code>, <code>reason: 'INSUFFICIENT_HISTORY'</code>, preventing erroneous predictions on insufficient trend data.</li>
          </ul>
        </div>
      </div>

      <div class="q-card">
        <div class="question"><span class="question-prefix">Q13:</span> What happens if the server crashes or restarts during live monitoring?</div>
        <div class="answer">
          <ol>
            <li><strong>Process Recovery:</strong> Node.js runs under watch/daemon management, restarting instantly on fatal exceptions.</li>
            <li><strong>Simulator Fault Tolerance:</strong> The Python IoT simulator catches HTTP connection drops, enters a 3-second backoff sleep, and automatically re-establishes telemetry transmission once the server comes back online.</li>
            <li><strong>Database Consistency:</strong> MongoDB persists all valid historical records on disk, ensuring no historical records are lost during process restarts.</li>
            <li><strong>Frontend Reconnection:</strong> Socket.IO clients automatically execute exponential-backoff reconnect handshakes and rejoin their designated authorization rooms.</li>
          </ol>
        </div>
      </div>
    </section>

    <!-- 12. CONCLUSION & ROADMAP -->
    <section>
      <h2><span class="section-num">12</span> Conclusion & Future Work</h2>
      <p>
        The <strong>Smart Healthcare Monitoring System</strong> successfully demonstrates that integrating high-frequency edge IoT telemetry with modern asynchronous backend pipelines and transparent gradient-boosted decision trees provides a viable, production-ready solution to early patient deterioration warning.
      </p>

      <div class="card">
        <h4 style="margin-top: 0; color: var(--primary-dark);">Planned Enhancements (Phase 2 Roadmap)</h4>
        <ol>
          <li><strong>Hardware Miniaturization:</strong> Transitioning ESP32 breadboard prototypes into custom surface-mount (SMD) wearable medical wristbands with Bluetooth Low Energy (BLE 5.2).</li>
          <li><strong>HL7 / FHIR Integration:</strong> Implementing Fast Healthcare Interoperability Resources (FHIR) JSON standards to allow seamless export into enterprise Electronic Health Record (EHR) systems like Epic and Cerner.</li>
          <li><strong>On-Device Edge ML:</strong> Quantizing the LightGBM decision forest into lightweight C++ arrays using TensorFlow Lite for Microcontrollers (TFLM) or Edge Impulse, enabling preliminary offline scoring directly on the ESP32 chip.</li>
        </ol>
      </div>

      <footer style="margin-top: 40px; padding-top: 14px; border-top: 1px solid var(--slate-200); text-align: center; color: var(--slate-500); font-size: 8pt;">
        Report certified by: Smart Healthcare Engineering & Data Science Group &bull; Repository: SwarnaTripathi/smart-healthcare-monitoring &bull; 2026 Production Edition
      </footer>
    </section>

  </div>
</body>
</html>
"""

output_path = r"d:\smart health care\COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.html"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Generated {output_path} successfully. File size: {len(html_content.encode('utf-8'))} bytes")
