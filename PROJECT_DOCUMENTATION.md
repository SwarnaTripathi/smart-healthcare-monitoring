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
│   │   ├── Patient.js               # Patient profiles (linked to User)
│   │   ├── HealthData.js            # IoT sensor readings
│   │   ├── Alert.js                 # Health alerts
│   │   ├── Report.js                # Medical report uploads
│   │   └── AuditLog.js              # System audit trail
│   ├── routes/
│   │   ├── auth.js                  # Register (patient-only), Login
│   │   ├── patients.js              # Patient CRUD + role-based filtering
│   │   ├── healthData.js            # IoT data ingestion + history
│   │   ├── alerts.js                # Alert management (role-filtered)
│   │   ├── reports.js               # File upload/download
│   │   ├── admin.js                 # Admin management APIs
│   │   └── chatbot.js               # AI health chatbot
│   ├── middleware/auth.js           # JWT verification + RBAC
│   ├── utils/alertChecker.js        # Threshold-based alerting
│   ├── seed_data.js                 # Synthetic data seeder script
│   ├── server.js                    # Main entry point
│   └── .env                         # Environment variables
├── client/                          # REACT FRONTEND
│   ├── src/
│   │   ├── context/AuthContext.jsx   # Global auth state
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Sidebar + role-based nav
│   │   │   └── ChatBot.jsx          # AI chatbot widget
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Auth page (patient-only register)
│   │   │   ├── Dashboard.jsx        # Doctor dashboard
│   │   │   ├── PatientDashboard.jsx # Patient dashboard (own data only)
│   │   │   ├── AdminDashboard.jsx   # Admin system overview
│   │   │   ├── Patients.jsx         # Patient management (2-step add)
│   │   │   ├── History.jsx          # Health data history (role-scoped)
│   │   │   ├── Alerts.jsx           # Alert management (role-filtered)
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
**What it does:** Stores patient medical profiles with auto-generated IDs and user account linking.
- **Auto-ID:** Uses a `pre-validate` hook that counts existing documents and generates `PT-00001`, `PT-00002`, etc.
- **User Link:** `user` field (ObjectId ref to User) links a Patient record to a login account — enables data isolation so patients see only their own data
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

### 3.13 ROLE-BASED DATA ISOLATION (routes/patients.js + alerts.js)
**What it does:** Ensures each role only sees the data they are authorized to view.

**Backend Filtering Logic:**
```
Patient → Only their own record (matched by Patient.user field → User._id)
Doctor  → Only patients assigned to them (Patient.assignedDoctor → User._id)
Admin   → All patients, full system oversight
```

**Key Implementation Details:**
- `_getPatientFilter(user)` helper function: First checks explicit `Patient.user` link. If not found, falls back to case-insensitive name matching and auto-links for future queries.
- `GET /api/patients` applies role-based query filters before returning results
- `GET /api/patients/:id` returns 403 Forbidden if a patient tries to view another patient's record
- `GET /api/alerts` filters alerts by the patient's own `patientId` when role is patient
- Stats endpoints (`/stats/summary`) are also scoped per role

**Patient ↔ User Linking Strategy:**
1. **Explicit link** — Admin/doctor sets `linkedUserId` when creating a patient record via the Add Patient form
2. **Auto-link by name** — If no explicit link exists, the system matches `User.name` ↔ `Patient.name` (case-insensitive) and auto-saves the link
3. **No match** — Patient sees "No Patient Profile Found" message until a doctor adds them

### 3.14 PATIENT REGISTRATION & ASSIGNMENT WORKFLOW
**What it does:** Implements a secure workflow where patients self-register and doctors add them to their patient list.

**Flow:**
```
1. Patient registers on website (patient-role only, no role selector)
        ↓
2. User account created — appears in "unlinked users" pool
        ↓
3. Doctor/Admin clicks "Add Patient" → sees newly registered patients as cards
        ↓
4. Doctor selects a patient → fills in medical details (age, blood group, etc.)
        ↓
5. Patient record created, linked to user account, assigned to doctor
        ↓
6. Patient can now see their own data when they log in
```

**Key Implementation Details:**
- `GET /api/patients/unlinked-users` — Returns patient-role users who don't yet have a Patient record
- `POST /api/auth/register` — Restricted to patient role only (doctor/admin accounts created by admin)
- Frontend 2-step modal: Step 1 shows selectable user cards, Step 2 collects medical details
- `Login.jsx` — Removed role selector; registration is patient-only with success message directing them to wait for doctor assignment

### 3.15 AI REPORT ANALYZER (utils/reportAnalyzer.js + MyReports.jsx)
**What it does:** Analyzes uploaded lab report values against medical reference ranges and provides AI-powered health insights.

**How it works:**
```
1. Patient uploads a lab report file + enters lab values (hemoglobin, glucose, etc.)
        ↓
2. Backend parses values and runs analyzeReport() against 30+ medical reference ranges
        ↓
3. Each value is classified: Normal / Borderline / Abnormal / Critical
        ↓
4. AI generates: Findings, Recommendations, Overall Assessment, Wellness Tips
        ↓
5. Analysis stored in MongoDB alongside the report for future reference
```

**Key Features:**
- **30+ lab tests supported:** CBC (hemoglobin, WBC, RBC, platelets), metabolic panel (glucose, HbA1c, creatinine), lipid profile, liver function, thyroid, vitamins, electrolytes, inflammation markers
- **Gender-aware analysis:** Reference ranges adjust for male/female patients (e.g., hemoglobin: male 13.5-17.5, female 12.0-15.5)
- **Severity classification:** Uses percentage deviation from normal to classify borderline (<15%), abnormal (15-30%), and critical (>30%)
- **Personalized recommendations:** Each abnormal finding triggers specific medical advice from a curated database
- **Re-analysis endpoint:** `POST /api/reports/:id/analyze` allows adding lab values to existing reports
- **Frontend display:** Expandable analysis panel with color-coded results table, findings, recommendations, and wellness tips

### 3.16 ADMIN USER MANAGEMENT (routes/admin.js + UserManagement.jsx)
**What it does:** Allows administrators to create doctor and admin accounts.
- **Backend:** `POST /api/admin/users` creates new user accounts with any role
- **Frontend:** "Add Doctor/Admin" button in User Management page with form modal
- **Specialization field:** Shown conditionally when creating doctor accounts
- **Audit logging:** Every account creation is logged for accountability
- **Security:** Only admins can access this endpoint (enforced by `authorize('admin')` middleware)

### 3.17 AI CHATBOT (routes/chatbot.js + ChatBot.jsx)
**What it does:** Healthcare assistant with intent detection.
- **Backend:** Regex-based NLP to detect 30+ intents (greetings, vitals query, emergency, first aid, navigation help, health topics)
- **Knowledge Base:** Structured health data for HR, SpO2, temperature, BP, diabetes, mental health, etc.
- **Personalized:** Queries actual patient data from MongoDB for "my vitals" requests
- **Frontend:** Floating widget with message bubbles, typing animation, quick action buttons

### 3.18 IoT SIMULATOR (simulator/iot_simulator.py)
**What it does:** Simulates ESP32 + MAX30102 + DS18B20 sensor readings.
- Generates realistic data using sinusoidal variation + Gaussian noise
- 8% chance of anomaly per reading (simulates real-world spikes)
- Sends HTTP POST to `/api/health-data` every 3 seconds
- Accepts patient ID as command-line argument

### 3.19 SYNTHETIC DATA SEEDER (seed_data.js)
**What it does:** Generates a complete demo dataset for testing and demonstration.
- **10 Users:** 1 admin, 2 doctors, 5 linked patients, 2 unlinked patients (for Add Patient demo)
- **5 Patient Records:** Linked to user accounts, round-robin assigned to doctors
- **2,520 Health Readings:** 7 days × 72 readings/day × 5 patients with realistic sinusoidal variation + anomalies
- **~170 Alerts:** Auto-generated from abnormal readings, 60% pre-acknowledged by doctors
- **Per-patient health profiles:** Each patient has unique base vitals and anomaly rates reflecting their medical history
- **Usage:** `node seed_data.js` — clears and regenerates all data

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
| Patient-only registration | Prevents privilege escalation; doctor/admin accounts require admin creation |
| 2-step Add Patient flow | Separates account creation from medical profile; doctors fill clinical details |
| Auto-linking by name | Fallback for patients created before explicit linking was implemented |

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
**Solution:** bcrypt with salt rounds of 12 (adaptive hashing). Password field excluded from queries using `select('-password')`.

### Problem 9: Patient Data Isolation
**Issue:** Patient users could see all other patients' data because the `GET /api/patients` endpoint had no role-based filtering.
**Solution:** Added role-based query filtering in the backend. Patient users get `{ user: userId }` filter, doctors get `{ assignedDoctor: userId }` filter, admins get no filter. Same pattern applied to alerts and stats endpoints.

### Problem 10: Patient-User Account Linking
**Issue:** The Patient model had a `user` field but it was never populated, so there was no way to match a login account to a patient record.
**Solution:** Implemented a 3-tier linking strategy: (1) Explicit linking via `linkedUserId` when doctor creates patient, (2) Auto-linking by name match as fallback, (3) Empty state with helpful message if no match found. The auto-link saves itself for future queries.

### Problem 11: Privilege Escalation via Self-Registration
**Issue:** The registration form allowed users to self-assign any role including `doctor` and `admin`.
**Solution:** Restricted `POST /api/auth/register` to `patient` role only. Doctor and admin accounts must be created by an existing admin through the User Management panel.

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

Beyond route-level access, we also implement **data-level isolation**: patients can only query their own records, doctors only see their assigned patients, and admins have full access. This is enforced in the backend query layer using role-based filters, not just frontend visibility.

### Q5b: How does the patient registration and assignment workflow work?
**A:** Patients self-register via the login page (restricted to patient role only). This creates a User account but NOT a Patient medical record. The patient then appears in an "unlinked users" pool visible to doctors and admins. When a doctor clicks "Add Patient", they see all newly registered patients as selectable cards. They select a patient, fill in clinical details (age, blood group, medical history), and submit. This creates a Patient record linked to the user account and assigned to that doctor. The patient can then log in and see their own health data, reports, and alerts.

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
**A:** (1) Manual API testing with direct HTTP requests, (2) Browser-based UI testing with automated agent verification, (3) End-to-end flow testing (register → login → add patient → run simulator → verify dashboard), (4) Role-based access verification for all three user types, (5) Data isolation testing — logging in as different patients and verifying each sees only their own data.

### Q15: How do you handle data isolation for multi-doctor scenarios?
**A:** Each Patient record has an `assignedDoctor` field referencing a User. When a doctor queries `/api/patients`, the backend automatically filters with `{ assignedDoctor: req.user._id }`. This means Doctor A never sees Doctor B's patients. Admins bypass all filters and see the entire system. The same isolation applies to alerts — each patient's alerts are filtered by their `patientId`, and each doctor only sees alerts for their assigned patients.

### Q16: What would you improve if you had more time?
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

# (Optional) Seed demo data with synthetic patients & health readings
cd "d:\smart health care\app\server"
node seed_data.js

# Terminal 3: Start IoT Simulator
cd "d:\smart health care\app"
pip install requests
python simulator/iot_simulator.py PT-00001
```

### Login Credentials (after running seed_data.js)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@healthguard.com | admin123 |
| Doctor | priya@healthguard.com | doctor123 |
| Doctor | rahul@healthguard.com | doctor123 |
| Patient | amit@patient.com | patient123 |
| Patient | sneha@patient.com | patient123 |
| Patient | ravi@patient.com | patient123 |
| Patient | anjali@patient.com | patient123 |
| Patient | vikram@patient.com | patient123 |
| 🆕 Unlinked | neha@patient.com | patient123 |
| 🆕 Unlinked | arjun@patient.com | patient123 |

> **Note:** "Unlinked" patients have registered accounts but no Patient record yet. Log in as a doctor and click "Add Patient" to assign them.

### URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Health Check: http://localhost:3000/api/health

---

## 9. API ENDPOINTS REFERENCE

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Create patient account (patient role only) |
| POST | /api/auth/login | No | Login + get JWT |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/patients/unlinked-users | Doctor/Admin | List newly registered patients not yet assigned |
| GET | /api/patients/stats/summary | Yes | Patient stats (role-scoped) |
| GET | /api/patients | Yes | List patients (role-filtered: own/assigned/all) |
| GET | /api/patients/:id | Yes | Get single patient (role-restricted) |
| POST | /api/patients | Doctor/Admin | Add patient (with linkedUserId) |
| PUT | /api/patients/:id | Doctor/Admin | Update patient |
| DELETE | /api/patients/:id | Admin | Delete patient |
| POST | /api/health-data | No | Store IoT reading |
| GET | /api/health-data/:patientId | Yes | Get history |
| GET | /api/alerts/stats/summary | Yes | Alert stats (role-scoped) |
| GET | /api/alerts | Yes | List alerts (role-filtered) |
| PUT | /api/alerts/:id/acknowledge | Doctor/Admin | Ack alert |
| POST | /api/reports | Yes | Upload report + lab values + AI analysis |
| POST | /api/reports/:id/analyze | Yes | Re-analyze existing report with new lab values |
| GET | /api/reports/:patientId | Yes | Get reports with AI analysis |
| GET | /api/admin/stats | Admin | System stats |
| POST | /api/admin/users | Admin | Create doctor/admin accounts |
| GET | /api/admin/users | Admin | All users |
| PUT | /api/admin/users/:id | Admin | Update user role |
| POST | /api/chatbot | Yes | Chat message |

---

## 10. ROLE-BASED DATA ACCESS MATRIX

| Data | Patient | Doctor | Admin |
|------|---------|--------|-------|
| Own patient record | ✅ Own only | ✅ Assigned only | ✅ All |
| Health data history | ✅ Own only | ✅ Assigned patients | ✅ All |
| Alerts | ✅ Own only | ✅ All (can acknowledge) | ✅ All (can acknowledge + delete) |
| Reports + AI Analysis | ✅ Own upload/view | ✅ Upload for assigned | ✅ All |
| User management | ❌ | ❌ | ✅ Full CRUD + create accounts |
| Device management | ❌ | ❌ | ✅ View all |
| Audit logs | ❌ | ❌ | ✅ View all |
| Add patient | ❌ | ✅ From unlinked pool | ✅ From unlinked pool |
| Add doctor/admin | ❌ | ❌ | ✅ Create any role |
| Self-register | ✅ Patient role only | ❌ Created by admin | ❌ Created by admin |
| Chatbot | ✅ | ✅ | ✅ |

---

*Document prepared for Final Year Project Viva — Phase 1*
*Smart Healthcare Monitoring System using IoT, Blockchain, and AI*
*Last Updated: May 2026*
