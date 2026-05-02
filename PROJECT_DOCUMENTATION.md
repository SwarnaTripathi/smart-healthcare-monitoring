# Smart Healthcare Monitoring System — Complete Project Documentation
## Phase 1: IoT Data Simulation + Real-Time Dashboard + Authentication

---

## 1. PROJECT OVERVIEW

### 1.1 What is this project?
A **secure, intelligent, IoT-based healthcare monitoring system** that collects patient vitals (heart rate, SpO2, temperature) from IoT sensors, displays them on a real-time dashboard, provides role-based access for Patients/Doctors/Admins, and includes an AI health chatbot.

### 1.2 Tech Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + Vite | Single Page Application |
| Backend | Node.js + Express.js | REST API Server |
| Database | MongoDB + Mongoose | NoSQL Data Storage |
| Real-time | Socket.IO | WebSocket Communication |
| Auth | JWT + bcryptjs | Token-based Authentication |
| Charts | Chart.js + react-chartjs-2 | Data Visualization |
| IoT Sim | Python (requests) | Sensor Data Simulation |
| File Upload | Multer | Medical Report Uploads |

### 1.3 Architecture Diagram
```
┌─────────────────┐     HTTP POST      ┌──────────────────┐
│  IoT Simulator   │ ───────────────── │                  │
│  (Python/ESP32)  │    /api/health-data│   Express.js     │
└─────────────────┘                    │   Backend        │
                                       │   (Port 3000)    │
┌─────────────────┐   REST + WebSocket │                  │     ┌──────────┐
│  React Frontend  │ ◄───────────────► │   Socket.IO      │ ──► │ MongoDB  │
│  (Vite, Port     │   JWT Auth        │   Real-time      │     │ Database │
│   5173)          │                   │                  │     └──────────┘
└─────────────────┘                    └──────────────────┘
```

---

## 2. PROJECT STRUCTURE

```
d:\smart health care\app\
├── server/                          # EXPRESS BACKEND
│   ├── config/db.js                 # MongoDB connection
│   ├── models/
│   │   ├── User.js                  # User schema (auth + roles)
│   │   ├── Patient.js               # Patient profiles
│   │   ├── HealthData.js            # IoT sensor readings
│   │   ├── Alert.js                 # Health alerts
│   │   ├── Report.js                # Medical report uploads
│   │   └── AuditLog.js              # System audit trail
│   ├── routes/
│   │   ├── auth.js                  # Register, Login, Profile
│   │   ├── patients.js              # Patient CRUD
│   │   ├── healthData.js            # IoT data ingestion + history
│   │   ├── alerts.js                # Alert management
│   │   ├── reports.js               # File upload/download
│   │   ├── admin.js                 # Admin management APIs
│   │   └── chatbot.js               # AI health chatbot
│   ├── middleware/auth.js           # JWT verification + RBAC
│   ├── utils/alertChecker.js        # Threshold-based alerting
│   ├── server.js                    # Main entry point
│   └── .env                         # Environment variables
├── client/                          # REACT FRONTEND
│   ├── src/
│   │   ├── context/AuthContext.jsx   # Global auth state
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Sidebar + role-based nav
│   │   │   └── ChatBot.jsx          # AI chatbot widget
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Auth page
│   │   │   ├── Dashboard.jsx        # Doctor dashboard
│   │   │   ├── PatientDashboard.jsx # Patient dashboard
│   │   │   ├── AdminDashboard.jsx   # Admin system overview
│   │   │   ├── Patients.jsx         # Patient management
│   │   │   ├── History.jsx          # Health data history
│   │   │   ├── Alerts.jsx           # Alert management
│   │   │   ├── MyReports.jsx        # Patient report uploads
│   │   │   ├── MyProfile.jsx        # Patient profile
│   │   │   ├── UserManagement.jsx   # Admin user control
│   │   │   ├── DeviceManagement.jsx # IoT device monitoring
│   │   │   └── AuditLogs.jsx        # System activity logs
│   │   ├── utils/
│   │   │   ├── api.js               # Axios with JWT interceptor
│   │   │   └── socket.js            # Socket.IO client
│   │   ├── App.jsx                  # Route definitions
│   │   ├── main.jsx                 # React entry point
│   │   └── index.css                # Complete design system
│   └── vite.config.js               # Vite proxy config
└── simulator/
    ├── iot_simulator.py             # Python sensor simulator
    └── requirements.txt
```

---

## 3. CODE EXPLANATIONS (Module by Module)

### 3.1 DATABASE CONNECTION (config/db.js)
**What it does:** Connects to MongoDB using Mongoose ODM.
```javascript
const mongoose = require('mongoose');
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};
```
**Key concept:** We use `async/await` because database connections are asynchronous. Mongoose provides schema validation on top of MongoDB's flexibility.

### 3.2 USER MODEL (models/User.js)
**What it does:** Defines user schema with password hashing and role-based access.
- **Pre-save hook:** Automatically hashes passwords using bcrypt before saving
- **Instance method:** `comparePassword()` verifies login passwords against hashed values
- **Roles:** `patient`, `doctor`, `admin` — stored as enum
- **Why bcrypt?** It uses salted hashing (cost factor 10), making rainbow table attacks impossible

### 3.3 PATIENT MODEL (models/Patient.js)
**What it does:** Stores patient medical profiles with auto-generated IDs.
- **Auto-ID:** Uses a `pre-save` hook that counts existing documents and generates `PT-00001`, `PT-00002`, etc.
- **References:** `assignedDoctor` uses `mongoose.Schema.Types.ObjectId` referencing the User model (relational linking in NoSQL)

### 3.4 HEALTH DATA MODEL (models/HealthData.js)
**What it does:** Stores each IoT sensor reading.
- **Fields:** patientId, deviceId, heartRate, spO2, temperature, status, timestamp
- **Status classification:** Automatically set to `normal`, `warning`, or `critical` via the alertChecker utility
- **Indexes:** Compound index on `(patientId, timestamp)` for fast time-series queries

### 3.5 JWT AUTHENTICATION (middleware/auth.js)
**What it does:** Protects API routes with token verification.
```
Flow: Login → Server creates JWT → Client stores in localStorage
      → Every request includes "Authorization: Bearer <token>"
      → Middleware verifies token → Extracts user ID → Attaches to req.user
```
- **`auth` middleware:** Verifies JWT signature using the secret key
- **`authorize(...roles)` middleware:** Checks if `req.user.role` is in the allowed roles array
- **Why JWT?** Stateless authentication — server doesn't need to store sessions

### 3.6 ALERT CHECKER (utils/alertChecker.js)
**What it does:** Evaluates incoming vital signs against medical thresholds.
```
Heart Rate:  < 50 or > 120 → CRITICAL | < 60 or > 100 → WARNING
SpO2:        < 90 → CRITICAL | < 95 → WARNING
Temperature: < 35 or > 39.5 → CRITICAL | < 36.1 or > 37.5 → WARNING
```
- When thresholds are breached, it creates an Alert document in MongoDB
- Emits `new-alert` via Socket.IO for real-time notifications on the dashboard

### 3.7 HEALTH DATA ROUTE (routes/healthData.js)
**What it does:** The core IoT data ingestion endpoint.
- `POST /api/health-data` — Receives sensor data (NO auth required, since IoT devices don't have JWT)
- Runs `checkThresholds()` to detect anomalies
- Saves to MongoDB
- Broadcasts via `io.emit('health-data', ...)` to all connected WebSocket clients
- This is how the dashboard updates in REAL-TIME without page refresh

### 3.8 SOCKET.IO INTEGRATION (server.js)
**What it does:** Enables bidirectional real-time communication.
```javascript
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);  // Makes io accessible in route handlers
io.on('connection', (socket) => { /* track connections */ });
```
- Server emits events: `health-data`, `new-alert`, `alert-acknowledged`
- Client listens: `socket.on('health-data', (data) => { /* update UI */ })`

### 3.9 REACT AUTH CONTEXT (context/AuthContext.jsx)
**What it does:** Global state management for authentication using React Context API.
- Stores user object + JWT token in both state and localStorage
- On app load, checks localStorage for existing token (persistent login)
- Provides `login()`, `register()`, `logout()` functions to all components
- `useAuth()` custom hook gives any component access to auth state

### 3.10 AXIOS INTERCEPTOR (utils/api.js)
**What it does:** Automatically attaches JWT to every API request.
```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```
- Also handles 401 responses by clearing token and redirecting to login

### 3.11 REAL-TIME DASHBOARD (pages/Dashboard.jsx)
**What it does:** Displays live patient vitals with Chart.js.
- Uses `useState` for stat cards, latest vitals, and chart data arrays
- `useEffect` with Socket.IO listener for real-time updates
- Maintains a sliding window of 30 data points for charts
- Chart.js `Line` component with gradient fills and smooth animations
- Color-coded vital cards (green/yellow/red based on thresholds)

### 3.12 ROLE-BASED ROUTING (App.jsx)
**What it does:** Serves different dashboards based on user role.
```jsx
function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'patient') return <PatientDashboard />;
  return <Dashboard />;  // Doctor
}
```
- `ProtectedRoute` component checks auth AND role permissions
- Routes like `/user-management` are restricted to admin only

### 3.13 AI CHATBOT (routes/chatbot.js + ChatBot.jsx)
**What it does:** Healthcare assistant with intent detection.
- **Backend:** Regex-based NLP to detect 30+ intents (greetings, vitals query, emergency, first aid, navigation help, health topics)
- **Knowledge Base:** Structured health data for HR, SpO2, temperature, BP, diabetes, mental health, etc.
- **Personalized:** Queries actual patient data from MongoDB for "my vitals" requests
- **Frontend:** Floating widget with message bubbles, typing animation, quick action buttons

### 3.14 IoT SIMULATOR (simulator/iot_simulator.py)
**What it does:** Simulates ESP32 + MAX30102 + DS18B20 sensor readings.
- Generates realistic data using sinusoidal variation + Gaussian noise
- 8% chance of anomaly per reading (simulates real-world spikes)
- Sends HTTP POST to `/api/health-data` every 3 seconds
- Accepts patient ID as command-line argument

---

## 4. DESIGN DECISIONS & WHY

| Decision | Why |
|----------|-----|
| MongoDB over SQL | Schema flexibility for varying patient data; JSON-native for IoT payloads |
| JWT over Sessions | Stateless auth; scales horizontally; works with mobile clients |
| Socket.IO over polling | True real-time updates; bi-directional; auto-reconnection |
| React Context over Redux | Simpler for auth state; avoids boilerplate; sufficient for this scale |
| Vite over CRA | 10x faster HMR; native ESM; smaller bundle |
| Multer for uploads | Battle-tested; middleware pattern fits Express; disk storage for simplicity |
| Regex NLP over API | No API key needed; works offline; demonstrates custom NLP for project |
| Dark theme | Medical dashboards traditionally use dark themes (reduced eye strain during monitoring) |

---

## 5. PROBLEMS FACED & SOLUTIONS

### Problem 1: Express Route Parameter Collision
**Issue:** `GET /api/patients/stats/summary` was being caught by `GET /api/patients/:id` (Express treated "stats" as an ID parameter).
**Solution:** Moved static routes (`/stats/summary`) BEFORE parameterized routes (`/:id`). Express matches routes top-down.

### Problem 2: Windows Unicode Encoding in Python
**Issue:** Python IoT simulator crashed with `UnicodeEncodeError` when printing emoji/box-drawing characters on Windows cmd (uses cp1252 encoding).
**Solution:** Added `sys.stdout.reconfigure(encoding='utf-8')` and replaced Unicode characters with ASCII-safe alternatives.

### Problem 3: Vite Proxy for API Calls
**Issue:** React runs on port 5173, Express on 3000. CORS would block API calls.
**Solution:** Configured Vite's proxy in `vite.config.js` to forward `/api` and `/socket.io` requests to the backend transparently.

### Problem 4: Socket.IO CORS
**Issue:** Socket.IO connections failed due to cross-origin restrictions.
**Solution:** Configured `cors: { origin: '*' }` on the Socket.IO server. In production, this should be restricted to specific origins.

### Problem 5: JWT Expiration Handling
**Issue:** Expired tokens caused silent failures — users saw broken pages instead of login redirect.
**Solution:** Added Axios response interceptor that catches 401 errors, clears localStorage, and redirects to login.

### Problem 6: Real-time Chart Memory
**Issue:** Unlimited data points in Chart.js caused memory leaks and performance degradation.
**Solution:** Implemented a sliding window (max 30 points) using `.slice(-MAX_POINTS)` on every new data push.

### Problem 7: File Upload Security
**Issue:** Unrestricted file uploads could allow malicious files.
**Solution:** Multer file filter restricts to PDF/JPG/PNG/DOC only. 10MB size limit. Files stored with randomized names to prevent path traversal.

### Problem 8: Password Security
**Issue:** Storing plain-text passwords is a critical vulnerability.
**Solution:** bcrypt with salt rounds of 10 (adaptive hashing). Password field excluded from queries using `select('-password')`.

---

## 6. INTERVIEW QUESTIONS & ANSWERS

### Q1: What is the purpose of this project?
**A:** To build a secure healthcare monitoring system that simulates IoT sensors collecting patient vitals, displays them on a real-time dashboard, provides role-based access control, and lays the foundation for blockchain security (Phase 2) and AI intrusion detection (Phase 3).

### Q2: Why did you choose MERN stack?
**A:** MongoDB handles unstructured IoT data efficiently. Express.js + Node.js provide event-driven, non-blocking I/O perfect for real-time data streams. React enables component-based UI with efficient re-rendering for live updates.

### Q3: How does real-time data work?
**A:** The IoT simulator sends HTTP POST requests to the backend every 3 seconds. The backend stores the data in MongoDB, then broadcasts it via Socket.IO (WebSockets) to all connected browser clients. React components listen for these events and update the UI without page refresh.

### Q4: Explain JWT authentication.
**A:** On login, the server creates a JSON Web Token containing the user's ID, signed with a secret key. The client stores it in localStorage and sends it with every request in the Authorization header. The server middleware verifies the signature and extracts the user identity. Tokens expire after 7 days. Benefits: stateless, scalable, no server-side session storage needed.

### Q5: How does role-based access control (RBAC) work?
**A:** Each user has a `role` field (patient/doctor/admin). The `authorize()` middleware checks if the requesting user's role is in the allowed list. The frontend also conditionally renders UI elements based on role — different sidebar menus, different dashboards, and feature visibility controlled per role.

### Q6: How are health alerts generated?
**A:** The `alertChecker.js` utility evaluates each incoming reading against medical thresholds. For example, heart rate > 120 bpm triggers a CRITICAL alert. The alert is saved to MongoDB and broadcast via Socket.IO. Doctors/admins can acknowledge alerts through the dashboard.

### Q7: How would you scale this for real IoT devices?
**A:** Replace the Python simulator with actual ESP32 microcontrollers running MAX30102 (heart rate/SpO2) and DS18B20 (temperature) sensors. The HTTP POST endpoint remains the same. For production scale: add MQTT broker (Mosquitto), use Redis for caching, deploy with Docker, and implement rate limiting.

### Q8: What security measures are implemented?
**A:** (1) Password hashing with bcrypt, (2) JWT token authentication, (3) Role-based access control, (4) File upload validation (type + size limits), (5) Input validation on all endpoints, (6) Audit logging for admin actions. Phase 2 will add blockchain encryption and secure searchable encryption.

### Q9: Explain the AI chatbot implementation.
**A:** The chatbot uses a rule-based NLP approach with regex pattern matching to detect user intent (30+ intents). It has a structured health knowledge base covering vitals, emergency procedures, first aid, and wellness tips. It also queries the actual MongoDB database to fetch personalized patient data. The frontend uses a floating widget with message bubbles and typing animations.

### Q10: What is the difference between REST API and WebSocket?
**A:** REST (HTTP) is request-response — client asks, server responds. WebSocket is persistent bidirectional — both sides can send data anytime. We use REST for CRUD operations (login, add patient) and WebSocket (Socket.IO) for real-time streaming (live vitals, instant alerts).

### Q11: Why MongoDB over MySQL for this project?
**A:** (1) IoT data is semi-structured — different devices may send different fields. MongoDB's schema flexibility handles this natively. (2) JSON format matches JavaScript objects directly. (3) Horizontal scaling with sharding suits growing IoT data volumes. (4) Time-series data benefits from MongoDB's indexing capabilities.

### Q12: How would you add blockchain in Phase 2?
**A:** Use Hyperledger Fabric (permissioned blockchain) to create an immutable ledger of health records. Each health data entry gets hashed and stored on-chain, while the actual data stays in MongoDB. Implement Attribute-Based Access Control (ABAC) where access policies are defined as smart contracts. Add AES-256 encryption for data at rest and implement Secure Searchable Encryption (SSE) to allow queries on encrypted data.

### Q13: Explain the CNN-LSTM model planned for Phase 3.
**A:** A hybrid deep learning model where CNN extracts spatial features from network traffic patterns and LSTM captures temporal sequences. The combined model detects intrusion attempts on the healthcare IoT network. Training data would include normal traffic and simulated attack patterns (DDoS, MITM, injection). This provides real-time anomaly detection for system security.

### Q14: What testing strategies did you use?
**A:** (1) Manual API testing with direct HTTP requests, (2) Browser-based UI testing with automated agent verification, (3) End-to-end flow testing (register → login → add patient → run simulator → verify dashboard), (4) Role-based access verification for all three user types.

### Q15: What would you improve if you had more time?
**A:** (1) Add WebSocket authentication (currently open), (2) Implement pagination for large datasets, (3) Add data export (CSV/PDF reports), (4) Email/SMS notifications for critical alerts, (5) Progressive Web App (PWA) for mobile, (6) Automated testing with Jest/Cypress, (7) Docker containerization, (8) HTTPS with SSL certificates.

---

## 7. KEY CONCEPTS FOR VIVA

### 7.1 Middleware Pattern (Express)
Middleware functions have access to `req`, `res`, and `next`. They execute in order and can modify request/response or terminate the chain. Example: `auth` middleware runs before route handlers to verify JWT.

### 7.2 React Hooks Used
- `useState` — Component state management
- `useEffect` — Side effects (API calls, Socket.IO listeners)
- `useRef` — DOM references (chat scroll, input focus)
- `useContext` — Access global auth state
- `useNavigate` — Programmatic navigation

### 7.3 Mongoose Population
`populate('assignedDoctor', 'name email')` replaces ObjectId references with actual document data from the referenced collection — similar to SQL JOIN.

### 7.4 Event-Driven Architecture
Node.js uses an event loop for non-blocking I/O. Socket.IO extends this with custom events (`health-data`, `new-alert`). This pattern allows handling thousands of concurrent connections efficiently.

### 7.5 Component Lifecycle (React)
Mount → `useEffect(() => { /* setup */ }, [])` runs once
Update → `useEffect(() => { /* run on deps change */ }, [dep])` runs on dependency change
Unmount → `useEffect(() => { return () => { /* cleanup */ } }, [])` cleanup function

---

## 8. HOW TO RUN THE PROJECT

### Prerequisites
- Node.js v18+ installed
- MongoDB running locally on port 27017
- Python 3.x with `requests` package

### Steps
```bash
# Terminal 1: Start Backend
cd "d:\smart health care\app\server"
npm install
npm run dev

# Terminal 2: Start Frontend
cd "d:\smart health care\app\client"
npm install
npm run dev

# Terminal 3: Start IoT Simulator
cd "d:\smart health care\app"
pip install requests
python simulator/iot_simulator.py PT-00001
```

### Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Doctor | sarah@hospital.com | doctor123 |
| Patient | rahul@patient.com | patient123 |
| Admin | admin@hospital.com | admin123 |

### URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Health Check: http://localhost:3000/api/health

---

## 9. API ENDPOINTS REFERENCE

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Login + get JWT |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/patients | Yes | List patients |
| POST | /api/patients | Doctor/Admin | Add patient |
| PUT | /api/patients/:id | Doctor/Admin | Update patient |
| DELETE | /api/patients/:id | Admin | Delete patient |
| POST | /api/health-data | No | Store IoT reading |
| GET | /api/health-data/:patientId | Yes | Get history |
| GET | /api/alerts | Yes | List alerts |
| PUT | /api/alerts/:id/acknowledge | Doctor/Admin | Ack alert |
| POST | /api/reports | Yes | Upload report |
| GET | /api/reports/:patientId | Yes | Get reports |
| GET | /api/admin/stats | Admin | System stats |
| GET | /api/admin/users | Admin | All users |
| PUT | /api/admin/users/:id | Admin | Update user role |
| POST | /api/chatbot | Yes | Chat message |

---

*Document prepared for Final Year Project Viva — Phase 1*
*Smart Healthcare Monitoring System using IoT, Blockchain, and AI*
