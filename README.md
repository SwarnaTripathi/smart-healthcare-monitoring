<div align="center">

# 🏥 Smart Healthcare Monitoring System

### IoT-Driven Patient Monitoring with Real-Time Dashboard, RBAC & AI Analytics

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white)](https://mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 📋 Overview

A **secure, real-time healthcare monitoring system** that collects patient vitals (heart rate, SpO2, temperature) from IoT sensors, displays live data on a premium dark-themed dashboard, enforces role-based access control (Patient/Doctor/Admin), provides AI-powered lab report analysis, and includes an intelligent health chatbot assistant.

> **Phase 1** of a 3-phase project integrating IoT, Blockchain Security, and AI-Driven Analytics.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Real-Time Dashboard** | Live vital signs with Chart.js graphs & Socket.IO streaming — role-specific views for Patient, Doctor, and Admin |
| 🔐 **Role-Based Access Control** | Separate portals with data isolation — patients see only their data, doctors see assigned patients, admins see everything |
| 🧬 **AI Lab Report Analyzer** | 30+ lab tests analyzed with gender-aware reference ranges, severity classification, and personalized recommendations |
| 🤖 **AI Health Chatbot** | 30+ intents — vitals query, health tips, emergency guidance, first aid, personalized with real patient data |
| 📱 **IoT Data Pipeline** | Python simulator + ESP32 Arduino code for real hardware (MAX30102 + DS18B20) |
| 📁 **Medical Report Management** | Upload lab reports, prescriptions, imaging files with AI-powered analysis |
| 👥 **User & Patient Management** | Admin panel with account creation, role switching, 2-step patient onboarding workflow |
| 📡 **Device Monitoring** | Track IoT devices, online/offline status, average health metrics |
| 🚨 **Smart Alerts** | Auto-generated health alerts with threshold-based detection, role-filtered views, bulk acknowledgement |
| 📝 **Audit Logging** | Complete system activity trail for accountability and compliance |
| 🌙 **Premium Dark UI** | Glassmorphism design with micro-animations and responsive layout |

---

## 🏗️ Architecture

```
┌─────────────────┐     HTTP POST      ┌──────────────────┐
│  IoT Simulator   │ ──────────────── │   Express.js     │
│  (Python/ESP32)  │  /api/health-data │   Backend :3000  │
└─────────────────┘                    │                  │     ┌──────────┐
┌─────────────────┐  REST + WebSocket  │   Socket.IO      │ ──► │ MongoDB  │
│  React Frontend  │ ◄───────────────► │   Real-time      │     │ Database │
│  (Vite :5173)    │   JWT Auth        │                  │     └──────────┘
└─────────────────┘                    └──────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, Chart.js, react-chartjs-2, Socket.IO Client, React Router, React Icons |
| **Backend** | Node.js, Express.js, Mongoose, Socket.IO, Multer |
| **Database** | MongoDB |
| **Auth** | JWT + bcryptjs |
| **IoT** | Python (simulator), ESP32 + MAX30102 + DS18B20 (hardware) |
| **AI/Analytics** | Custom NLP chatbot (30+ intents), Lab report analyzer (30+ tests) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB running locally on port 27017
- Python 3.x (for IoT simulator)

### Installation

```bash
# Clone the repository
git clone https://github.com/SwarnaTripathi/smart-healthcare-monitoring.git
cd smart-healthcare-monitoring

# Install backend dependencies
cd app/server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Configuration

Create a `.env` file inside `app/server/` with the following variables:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT token signing |

> **⚠️ Security Note:** Never commit your `.env` file. It is already included in `.gitignore`.

### Running

```bash
# Terminal 1: Start Backend
cd app/server
npm run dev

# Terminal 2: Start Frontend
cd app/client
npm run dev

# (Optional) Seed demo data with synthetic patients & health readings
cd app/server
node seed_data.js

# Terminal 3: Start IoT Simulator
pip install requests
python app/simulator/iot_simulator.py PT-00001
```

### Access

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Web Application |
| http://localhost:3000/api/health | API Health Check |

### Demo Credentials (after running `seed_data.js`)

| Role | Email | Password |
|------|-------|----------|
| 🔑 Admin | admin@healthguard.com | admin123 |
| 🩺 Doctor | priya@healthguard.com | doctor123 |
| 🩺 Doctor | rahul@healthguard.com | doctor123 |
| 🧑 Patient | amit@patient.com | patient123 |
| 🧑 Patient | sneha@patient.com | patient123 |
| 🧑 Patient | ravi@patient.com | patient123 |
| 🆕 Unlinked | neha@patient.com | patient123 |
| 🆕 Unlinked | arjun@patient.com | patient123 |

> **Note:** "Unlinked" patients have registered accounts but no Patient record yet. Log in as a doctor and click "Add Patient" to assign them.

---

## 📁 Project Structure

```
├── app/
│   ├── server/                      # Express.js Backend
│   │   ├── config/db.js             # MongoDB connection
│   │   ├── models/                  # Mongoose schemas
│   │   │   ├── User.js              # User auth & roles
│   │   │   ├── Patient.js           # Patient profiles (auto-ID, doctor link)
│   │   │   ├── HealthData.js        # IoT sensor readings
│   │   │   ├── Alert.js             # Health alerts
│   │   │   ├── Report.js            # Medical report uploads + AI analysis
│   │   │   └── AuditLog.js          # System audit trail
│   │   ├── routes/                  # API routes
│   │   │   ├── auth.js              # Register (patient-only), Login
│   │   │   ├── patients.js          # Patient CRUD + role-based filtering
│   │   │   ├── healthData.js        # IoT data ingestion + history
│   │   │   ├── alerts.js            # Alert management (role-filtered)
│   │   │   ├── reports.js           # File upload/download + AI analysis
│   │   │   ├── admin.js             # Admin management APIs + audit logs
│   │   │   └── chatbot.js           # AI health chatbot (30+ intents)
│   │   ├── middleware/auth.js       # JWT verification + RBAC
│   │   ├── utils/
│   │   │   ├── alertChecker.js      # Threshold-based alert engine
│   │   │   └── reportAnalyzer.js    # AI lab report analysis (30+ tests)
│   │   ├── seed_data.js             # Synthetic data seeder
│   │   └── server.js                # Entry point + Socket.IO
│   ├── client/                      # React Frontend
│   │   └── src/
│   │       ├── pages/               # 12 role-specific pages
│   │       │   ├── Login.jsx        # Auth page (patient-only register)
│   │       │   ├── Dashboard.jsx    # Doctor dashboard (live vitals)
│   │       │   ├── PatientDashboard.jsx  # Patient view (own data)
│   │       │   ├── AdminDashboard.jsx    # System overview
│   │       │   ├── Patients.jsx     # Patient management (2-step add)
│   │       │   ├── History.jsx      # Health data history
│   │       │   ├── Alerts.jsx       # Alert management
│   │       │   ├── MyReports.jsx    # Report upload + AI analysis UI
│   │       │   ├── MyProfile.jsx    # Patient profile
│   │       │   ├── UserManagement.jsx    # Admin user control
│   │       │   ├── DeviceManagement.jsx  # IoT device monitoring
│   │       │   └── AuditLogs.jsx    # System activity logs
│   │       ├── components/
│   │       │   ├── Layout.jsx       # Sidebar + role-based navigation
│   │       │   └── ChatBot.jsx      # AI chatbot floating widget
│   │       ├── context/AuthContext.jsx   # Global auth state
│   │       ├── utils/
│   │       │   ├── api.js           # Axios with JWT interceptor
│   │       │   └── socket.js        # Socket.IO client config
│   │       ├── App.jsx              # Route definitions + role-based routing
│   │       └── index.css            # Complete design system
│   ├── simulator/                   # Python IoT simulator
│   │   ├── iot_simulator.py
│   │   └── requirements.txt
│   └── hardware/                    # ESP32 Arduino sketch
│       └── healthcare_sensor/
├── PROJECT_DOCUMENTATION.md         # Complete code explanations & interview guide
├── HARDWARE_GUIDE.md                # Hardware wiring & setup guide
└── README.md
```

---

## 🔒 Role-Based Data Access

| Data | Patient | Doctor | Admin |
|------|---------|--------|-------|
| Patient records | ✅ Own only | ✅ Assigned only | ✅ All |
| Health data & vitals | ✅ Own only | ✅ Assigned patients | ✅ All |
| Alerts | ✅ Own only | ✅ Assigned (can ack) | ✅ All (full control) |
| Reports + AI Analysis | ✅ Own upload/view | ✅ Assigned patients | ✅ All |
| User management | ❌ | ❌ | ✅ Full CRUD |
| Device monitoring | ❌ | ❌ | ✅ View all |
| Audit logs | ❌ | ❌ | ✅ View all |
| Add patient | ❌ | ✅ From unlinked pool | ✅ From unlinked pool |
| Create doctor/admin | ❌ | ❌ | ✅ Any role |
| Self-register | ✅ Patient only | ❌ Created by admin | ❌ Created by admin |
| Chatbot | ✅ | ✅ | ✅ |

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create patient account |
| POST | `/api/auth/login` | No | Login + get JWT |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/patients` | Yes | List patients (role-filtered) |
| GET | `/api/patients/:id` | Yes | Get single patient |
| GET | `/api/patients/unlinked-users` | Doctor/Admin | Unassigned patients |
| GET | `/api/patients/stats/summary` | Yes | Patient stats (role-scoped) |
| POST | `/api/patients` | Doctor/Admin | Add patient |
| PUT | `/api/patients/:id` | Doctor/Admin | Update patient |
| DELETE | `/api/patients/:id` | Admin | Delete patient |
| POST | `/api/health-data` | No | Store IoT reading |
| GET | `/api/health-data/:patientId` | Yes | Get health history |
| GET | `/api/alerts` | Yes | List alerts (role-filtered) |
| GET | `/api/alerts/stats/summary` | Yes | Alert stats |
| GET | `/api/alerts/my-patient-ids` | Yes | Accessible patient IDs |
| PUT | `/api/alerts/:id/acknowledge` | Doctor/Admin | Acknowledge alert |
| PUT | `/api/alerts/acknowledge-all` | Doctor/Admin | Bulk acknowledge |
| POST | `/api/reports` | Yes | Upload report + AI analysis |
| POST | `/api/reports/:id/analyze` | Yes | Re-analyze with lab values |
| GET | `/api/reports/:patientId` | Yes | Get patient reports |
| GET | `/api/admin/stats` | Admin | System statistics |
| POST | `/api/admin/users` | Admin | Create accounts |
| GET | `/api/admin/users` | Admin | All users |
| PUT | `/api/admin/users/:id` | Admin | Update user role |
| POST | `/api/chatbot` | Yes | Chat message |

---

## 🔮 Roadmap

- [x] **Phase 1** — IoT Simulator + Real-Time Dashboard + RBAC + AI Chatbot + Lab Report Analyzer
- [ ] **Phase 2** — Hyperledger Fabric Blockchain + Searchable Encryption + ABAC
- [ ] **Phase 3** — CNN-LSTM Intrusion Detection + Advanced Health Analytics

---

## 📄 Documentation

- [Project Documentation](PROJECT_DOCUMENTATION.md) — Full code explanations, architecture details, 16+ interview Q&As
- [Hardware Guide](HARDWARE_GUIDE.md) — ESP32 wiring, Arduino code, sensor setup, troubleshooting

---

## 📝 License

This project is part of a Final Year academic project at Sagar Institute of Science & Technology, Bhopal.

---

<div align="center">
  <strong>Built with ❤️ for smarter healthcare</strong>
</div>
