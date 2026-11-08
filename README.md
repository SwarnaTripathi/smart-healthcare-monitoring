<div align="center">

# 🏥 Smart Healthcare Monitoring & Patient Deterioration Prediction System

### IoT-Driven Telemetry with 7 ICU Vitals, Real-Time WebSockets, 3D WebGL Digital Twin & LightGBM 6-Hour Early Warning AI

[![Node.js](https://img.shields.io/badge/Node.js-v25.7+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white)](https://mongodb.com/)
[![LightGBM](https://img.shields.io/badge/LightGBM-4.3+-ff69b4?logo=python&logoColor=white)](https://lightgbm.readthedocs.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7+-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Three.js](https://img.shields.io/badge/Three.js-0.162+-black?logo=three.js&logoColor=white)](https://threejs.org/)

[📖 View 20-Page Complete Master Report & Viva Voce Guide (PDF)](COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.pdf)

</div>

---

## 📋 System Overview

The **Smart Healthcare Monitoring System** is an end-to-end medical cyber-physical system designed to bridge continuous physiological sensor monitoring with real-time distributed web communication and predictive machine learning.

Traditional clinical monitoring in general wards and ICUs relies predominantly on intermittent nurse spot-checks or hard-threshold alarms. These existing mechanisms suffer from two fatal shortcomings:
1. **Alarm Fatigue:** Frequent false alarms caused by motion artifacts or single-tick threshold spikes desensitize clinical staff.
2. **Lagging Indicators:** Conventional monitors only sound alarms *after* physiological collapse has already begun.

### 4-Tier Medical Architecture Delivered
- **Continuous Edge Telemetry:** Collects and transmits **7 mission-critical ICU vital parameters** (HR, SpO2, Core Temp, Resp Rate, SysBP, MAP, EtCO2) in real time via ESP32 microcontrollers or synthetic multi-patient virtual patient telemetry engines.
- **Secure High-Throughput Ingestion:** Node.js/Express server backed by MongoDB, featuring strict device authentication (`X-Device-Key`), role-based access control (RBAC), and localized Socket.IO room-level broadcast.
- **Predictive Deterioration Engine (HealthGuard ML):** A forward-looking 6-hour patient deterioration prediction engine powered by LightGBM GBDT trained on 47 dynamic physiological indicators (ROC-AUC: **0.7456**, Optimal Threshold: **0.2700**, Sensitivity: **78.2%**).
- **Clinical Web Application:** React + Vite single-page dashboard featuring a 3D Three.js interactive organ canvas, real-time multi-trace charts, an executive multi-patient risk triage table, and an automated medical report lab-analyzer.

---

## 🗂️ Project Directory Structure

The project repository is structured cleanly into logical directories:

```
smart-healthcare-monitoring/
│
├── COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.pdf  # 📄 20-Page Printable Master Engineering Report & Viva Guide
│
├── app/                                        # 💻 Core Software Application
│   ├── client/                                 # React 18 + Vite Frontend Dashboard & 3D Three.js Organ Canvas
│   ├── server/                                 # Node.js/Express Backend, WebSockets, Security & REST APIs
│   ├── ml/                                     # HealthGuard ML: LightGBM 6h Model, Features & Cohort Datasets
│   ├── simulator/                              # Python IoT Multi-Patient Telemetry Engine (ALL mode)
│   └── hardware/                               # ESP32 C++ Arduino Firmware (MAX30102 PPG & DS18B20 1-Wire)
│
├── docs/                                       # 📚 Project Documentation & Academic Assets
│   ├── reports/                                # Master Production Reports & Audit Logs
│   │   ├── COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.pdf
│   │   ├── COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.html
│   │   ├── COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.md
│   │   ├── COMPREHENSIVE_AUDIT_AND_CHANGES_REPORT.html
│   │   ├── COMPREHENSIVE_AUDIT_AND_CHANGES_REPORT.md
│   │   ├── PROJECT_DOCUMENTATION.html
│   │   └── PROJECT_DOCUMENTATION.md
│   ├── technical_guides/                       # In-Depth Engineering & Security Manuals
│   │   ├── DATABASE_SECURITY_AND_OPERATIONS.md
│   │   ├── HARDWARE_GUIDE.md
│   │   ├── SIMULATOR_AND_EVALUATION.md
│   │   └── gap_report.md
│   ├── thesis_chapters_docx/                   # Academic Thesis Chapters (Word .docx format)
│   │   ├── Chapter1_Chapter2_Expanded.docx ... Chapter11_Results_and_Performance_Analysis.docx
│   │   ├── PROJECT REPORT TEMPLATE.docx
│   │   └── Smart_Healthcare_Final_Year_Project_Report.docx
│   └── research_papers/                        # Reference Medical Literature & Published Papers
│       ├── sensors-22-00572-v3.pdf
│       └── Smart_Healthcare_Diagrams_Pack.pdf
│
├── report/                                     # 🎓 LaTeX Source for Academic Project Report
│   ├── chapters/                               # LaTeX Chapter Files (ch01 to ch11)
│   ├── main.tex                                # Master LaTeX Document
│   └── Smart_Healthcare_Report.tex
│
├── tools/                                      # ⚙️ Utility Scripts & Text Extraction Tools
│   ├── gen_report.py
│   ├── generate_doc.py
│   ├── read_docs.py
│   └── all_docs_output.txt
│
└── scratch/                                    # 🛠️ Build & PDF Generation Scripts
```

---

## 🏥 The 7 Monitored Clinical ICU Vitals

| Vital Sign | Unit | Normal Range | Warning Range | Critical Range | Clinical Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Heart Rate (HR)** | bpm | 60 – 100 | 50-60 or 100-120 | < 50 or > 120 | Cardiac chronotropic drive |
| **Blood Oxygen (SpO2)** | % | 95 – 100 | 90 – 94 | < 90 | Arterial oxyhemoglobin saturation |
| **Core Temperature** | °C | 36.1 – 37.5 | 35.0-36.1, 37.5-38.5 | < 35.0 or > 38.5 | Thermoregulatory & systemic inflammation |
| **Respiratory Rate (RR)** | brpm | 12 – 20 | 10-12 or 21-28 | < 10 or > 28 | **Most sensitive early sign of deterioration** |
| **Systolic Blood Pressure** | mmHg | 90 – 120 | 85-90 or 121-140 | < 85 or > 140 | Left ventricular stroke volume output |
| **Mean Arterial Press. (MAP)**| mmHg | 70 – 105 | 60-70 or 106-115 | < 60 or > 115 | **Vital organ perfusion (MAP < 65 = Shock)** |
| **End-Tidal CO2 (EtCO2)** | mmHg | 35 – 45 | 28-35 or 46-50 | < 28 or > 50 | Alveolar ventilation & pulmonary blood flow |

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Node.js** v18+ (tested on v25.7)
2. **MongoDB** running locally on port `27017`
3. **Python** 3.10+ with `requests`, `pandas`, `numpy`, `lightgbm`, `joblib`, `scikit-learn`

---

### Step 1: Start MongoDB
```powershell
net start MongoDB
# Or run mongod directly:
mongod --dbpath "C:\data\db"
```

### Step 2: Start Backend Server (Terminal 1)
```powershell
cd "app/server"
npm install
node server.js
# Backend active at: http://localhost:3001
```

### Step 3: Start Frontend Client (Terminal 2)
```powershell
cd "app/client"
npm install
npm run dev
# Frontend active at: http://localhost:5173
```

### Step 4: Seed Demo Data & Users (Optional / Initial Setup)
```powershell
cd "app/server"
node seed_data.js
```

### Step 5: Start Simulated IoT Devices (Terminal 3)
```powershell
cd "app"

# Option A: Start ALL 5 patient devices concurrently (RECOMMENDED FOR DEMO)
python simulator/iot_simulator.py ALL --interval 3.0

# Option B: Run a single patient with specific scenario
python simulator/iot_simulator.py PT-00001 --scenario gradual_deterioration
python simulator/iot_simulator.py PT-00003 --scenario sudden_spike

# Option C: Stop all running simulator instances
python simulator/iot_simulator.py ALL --stop
```

---

## 👥 Demo Login Credentials

| Role | Email | Password | Permissions & Portal |
| :--- | :--- | :--- | :--- |
| **Doctor (Primary)** | `priya@healthguard.com` | `doctor123` | Patient triage, 7-vitals grid, 6h ML risk scores, multi-trace charts, clinical action advice |
| **Doctor (Secondary)** | `rajesh@healthguard.com` | `doctor123` | Secondary doctor cohort access |
| **Administrator** | `admin@healthguard.com` | `admin123` | Hospital analytics, user management, audit logs |
| **Patient** | `amit@patient.com` | `patient123` | Bedside digital twin, 3D WebGL organ canvas, report upload |

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create patient account |
| POST | `/api/auth/login` | No | Login + get JWT |
| GET | `/api/auth/me` | Yes | Get current user profile |
| GET | `/api/patients` | Yes | List patients (role-filtered) |
| GET | `/api/patients/:id` | Yes | Get single patient record |
| GET | `/api/patients/unlinked-users` | Doctor/Admin | Unassigned patients |
| GET | `/api/patients/stats/summary` | Yes | Patient stats (role-scoped) |
| POST | `/api/patients` | Doctor/Admin | Add new patient record |
| PUT | `/api/patients/:id` | Doctor/Admin | Update patient details |
| DELETE | `/api/patients/:id` | Admin | Delete patient record |
| POST | `/api/health-data` | Device Key / JWT | Ingest 7 ICU telemetry vitals & trigger ML alert engine |
| GET | `/api/health-data/:patientId` | Yes | Get historical vital series |
| GET | `/api/alerts` | Yes | List alerts (role & patient filtered) |
| GET | `/api/alerts/stats/summary` | Yes | Alert statistics & triage counts |
| GET | `/api/alerts/my-patient-ids` | Yes | Accessible patient IDs list |
| PUT | `/api/alerts/:id/acknowledge` | Doctor/Admin | Acknowledge active alert |
| PUT | `/api/alerts/acknowledge-all` | Doctor/Admin | Bulk acknowledge alerts |
| POST | `/api/reports` | Yes | Upload clinical report + AI extraction |
| POST | `/api/reports/:id/analyze` | Yes | Re-analyze report lab values |
| GET | `/api/reports/:patientId` | Yes | Retrieve patient clinical reports |
| GET | `/api/admin/stats` | Admin | System statistics & hospital metrics |
| POST | `/api/admin/users` | Admin | Provision staff/patient accounts |
| GET | `/api/admin/users` | Admin | List all registered users |
| PUT | `/api/admin/users/:id` | Admin | Modify user roles & permissions |
| POST | `/api/chatbot` | Yes | AI Medical assistant consultation |

---

## 📄 Key Documentation & Research Links

- [Complete Master Report & Viva Voce Guide (PDF)](COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.pdf)
- [Complete Master Report & Viva Voce Guide (HTML)](docs/reports/COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.html)
- [Complete Master Report & Viva Voce Guide (Markdown)](docs/reports/COMPLETE_PROJECT_REPORT_AND_VIVA_GUIDE.md)
- [Comprehensive Audit & Changes Report](docs/reports/COMPREHENSIVE_AUDIT_AND_CHANGES_REPORT.md)
- [Phase 3A Machine Learning Audit Report](docs/ML_PHASE3A_AUDIT_REPORT.md)
- [MIMIC-IV Real-World Cohort Integration Guide](app/ml/MIMIC_IV_INTEGRATION_GUIDE.md)
- [ML Deterioration Accuracy & Honest Baseline Analysis](ml_accuracy_honest_analysis.md)
- [Gap Analysis & Architectural Remediation Report](docs/technical_guides/gap_report.md)
- [Project Documentation & Architecture](docs/reports/PROJECT_DOCUMENTATION.md)
- [Database Security and Operations Manual](docs/technical_guides/DATABASE_SECURITY_AND_OPERATIONS.md)
- [Hardware & Sensor Wiring Guide](docs/technical_guides/HARDWARE_GUIDE.md)
- [Simulator and Evaluation Guide](docs/technical_guides/SIMULATOR_AND_EVALUATION.md)
- [Academic LaTeX Master Thesis Report Source](report/main.tex)

---

## 📝 License & Affiliation

This project is part of a Final Year academic project at **Heritage Institute of Technology, Kolkata**.

---

<div align="center">
  <strong>Built with ❤️ for smarter healthcare</strong>
</div>
