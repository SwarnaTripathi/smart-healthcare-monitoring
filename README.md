<div align="center">

# 🏥 Smart Healthcare Monitoring System

### IoT-Driven Patient Monitoring with Real-Time Dashboard, RBAC & AI Chatbot

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white)](https://mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 📋 Overview

A **secure, real-time healthcare monitoring system** that simulates IoT sensor data collection (heart rate, SpO2, temperature), displays live patient vitals on a premium dark-themed dashboard, enforces role-based access control (Patient/Doctor/Admin), and provides an AI-powered health chatbot assistant.

> **Phase 1** of a 3-phase project integrating IoT, Blockchain Security, and AI-Driven Analytics.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Real-Time Dashboard** | Live vital signs with Chart.js graphs & Socket.IO streaming |
| 🔐 **Role-Based Access** | Separate portals for Patients, Doctors, and Admins |
| 🤖 **AI Health Chatbot** | 30+ intents — vitals query, health tips, emergency guidance, first aid |
| 📱 **IoT Data Pipeline** | Python simulator + ESP32 Arduino code for real hardware |
| 📁 **Report Uploads** | Patients upload lab reports, prescriptions, imaging files |
| 👥 **User Management** | Admin panel with role switching, account control, audit logs |
| 📡 **Device Monitoring** | Track IoT devices, online/offline status, average metrics |
| 🚨 **Smart Alerts** | Auto-generated health alerts with threshold-based detection |
| 🌙 **Premium Dark UI** | Glassmorphism design with micro-animations |

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
| **Frontend** | React 19, Vite, Chart.js, Socket.IO Client |
| **Backend** | Node.js, Express.js, Mongoose, Socket.IO |
| **Database** | MongoDB |
| **Auth** | JWT + bcryptjs |
| **IoT** | Python (simulator), ESP32 + MAX30102 + DS18B20 (hardware) |
| **File Upload** | Multer |

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB running locally
- Python 3.x (for IoT simulator)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/smart-healthcare-monitoring.git
cd smart-healthcare-monitoring

# Install backend dependencies
cd app/server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Configuration

Create `app/server/.env`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/smart_healthcare
JWT_SECRET=smart_healthcare_jwt_secret_2026
```

### Running

```bash
# Terminal 1: Backend
cd app/server
npm run dev

# Terminal 2: Frontend
cd app/client
npm run dev

# Terminal 3: IoT Simulator
pip install requests
python app/simulator/iot_simulator.py PT-00001
```

### Access

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Web Application |
| http://localhost:3000/api/health | API Health Check |

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| 🩺 Doctor | sarah@hospital.com | doctor123 |
| 🧑 Patient | rahul@patient.com | patient123 |
| 🔑 Admin | admin@hospital.com | admin123 |

---

## 📁 Project Structure

```
├── app/
│   ├── server/                  # Express.js Backend
│   │   ├── config/db.js         # MongoDB connection
│   │   ├── models/              # Mongoose schemas (User, Patient, HealthData, Alert, Report, AuditLog)
│   │   ├── routes/              # API routes (auth, patients, healthData, alerts, reports, admin, chatbot)
│   │   ├── middleware/auth.js   # JWT + RBAC middleware
│   │   ├── utils/alertChecker.js# Threshold-based alert engine
│   │   └── server.js            # Entry point
│   ├── client/                  # React Frontend
│   │   └── src/
│   │       ├── pages/           # 12 role-specific pages
│   │       ├── components/      # Layout, ChatBot
│   │       ├── context/         # Auth state management
│   │       └── utils/           # API client, Socket config
│   ├── simulator/               # Python IoT simulator
│   └── hardware/                # ESP32 Arduino sketch
├── PROJECT_DOCUMENTATION.md     # Complete code & interview guide
├── HARDWARE_GUIDE.md            # Hardware wiring & setup guide
└── README.md
```

---

## 🔮 Roadmap

- [x] **Phase 1** — IoT Simulator + Real-Time Dashboard + RBAC + AI Chatbot
- [ ] **Phase 2** — Hyperledger Fabric Blockchain + Searchable Encryption + ABAC
- [ ] **Phase 3** — CNN-LSTM Intrusion Detection + Advanced Health Analytics

---

## 📄 Documentation

- [Project Documentation](PROJECT_DOCUMENTATION.md) — Full code explanations, design decisions, problems solved, 15 interview Q&As
- [Hardware Guide](HARDWARE_GUIDE.md) — ESP32 wiring, Arduino code, troubleshooting

---

## 📝 License

This project is part of a Final Year academic project.

---

<div align="center">
  <strong>Built with ❤️ for smarter healthcare</strong>
</div>
