# Smart Healthcare Monitoring System — Gap Report

> **Inspection date:** 2026-10-30  
> **Scope:** server + client + simulator — read-only audit, no changes made.  
> **Status:** Awaiting approval before any implementation.

---

## 1. What Already Works (Preserve These)

| Feature | Files |
|---|---|
| JWT auth + bcrypt password hashing (salt=12) | `middleware/auth.js`, `models/User.js`, `routes/auth.js` |
| Role-based access control (patient / doctor / admin) | `middleware/auth.js` → `authorize()` |
| Self-registration restricted to `patient` role | `routes/auth.js:21` |
| MongoDB with Mongoose + compound indexes on hot paths | `models/HealthData.js`, `models/Alert.js` |
| IoT health-data ingestion endpoint (unauthenticated, deliberate) | `routes/healthData.js:30` |
| Real-time Socket.IO broadcast (`health-data`, `new-alert`) | `server.js`, `utils/alertChecker.js` |
| Role-filtered alert & patient queries | `routes/alerts.js`, `routes/patients.js` |
| Rule-based threshold alert creation (HR / SpO2 / Temp) | `utils/alertChecker.js` |
| Rule-based lab-report analysis (30+ biomarkers) | `utils/reportAnalyzer.js` |
| File upload (multer, 10 MB, type-filtered) | `routes/reports.js` |
| Audit log model + admin write events | `models/AuditLog.js`, `routes/admin.js` |
| Patient auto-link by name fallback | `routes/patients.js`, `routes/alerts.js` |
| SPA fallback (serves `public/index.html`) | `server.js:62` |
| Python IoT simulator with sinusoidal variation + anomaly injection | `simulator/iot_simulator.py` |
| Chatbot rule-engine (intents → canned responses) | `routes/chatbot.js` |
| Front-end role dashboard routing | `client/src/App.jsx` |
| Axios interceptor attaches JWT + handles 401 globally | `client/src/utils/api.js` |

---

## 2. Gap Inventory

### 🔴 CRITICAL

#### C-1 — Hardcoded, weak JWT secret in committed `.env`
- **File:** [`app/server/.env:1`](file:///d:/smart%20health%20care/app/server/.env)
- **Issue:** `JWT_SECRET=smart_healthcare_jwt_secret_2026` is committed to git in plain text. Any token can be forged by anyone with repo access.
- **Fix:** Replace with a 64-character random string generated at deploy time. Remove `.env` from git history; ensure `.gitignore` covers it. *(`.gitignore` at root appears to exist — verify it lists `.env`.)*

#### C-2 — IoT ingest endpoint is completely unauthenticated and unvalidated
- **File:** [`app/server/routes/healthData.js:30`](file:///d:/smart%20health%20care/app/server/routes/healthData.js)
- **Issue:** `POST /api/health-data` requires no token. Any actor can POST arbitrary `patientId`, `heartRate`, `spO2`, `temperature` values, flooding the DB or triggering false alerts.  
  - `heartRate` accepted `min:0` — a value of `0` would not be rejected by Mongoose but would trip a critical alert.
- **Fix:** Add a shared device API key check (`X-Device-Key` header) *or* a signed HMAC on the payload; validate numeric ranges before DB write.

#### C-3 — No rate limiting on auth or any API endpoint
- **File:** [`app/server/server.js`](file:///d:/smart%20health%20care/app/server/server.js)
- **Issue:** No `express-rate-limit` or similar. Login endpoint (`POST /api/auth/login`) is brute-forceable with no lockout or back-off.
- **Fix:** Add `express-rate-limit` — strict limit on `/api/auth/login` (e.g. 10 req/15 min per IP), lighter limit on all other API routes.

#### C-4 — No HTTP security headers (Helmet absent)
- **File:** [`app/server/server.js`](file:///d:/smart%20health%20care/app/server/server.js)
- **Issue:** No `helmet` middleware. Missing `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`, etc. Browser-exploitable.
- **Fix:** `app.use(require('helmet')())` before route declarations.

#### C-5 — CORS is fully open (`origin: '*'`) on both HTTP and Socket.IO
- **File:** [`app/server/server.js:21,28`](file:///d:/smart%20health%20care/app/server/server.js)
- **Issue:** `cors()` with no origin constraint + Socket.IO `origin: '*'` allows cross-origin requests from any domain. PHI data is exposed.
- **Fix:** Lock to `process.env.ALLOWED_ORIGIN` (e.g. `http://localhost:5173` for dev, production domain for prod).

---

### 🟠 HIGH

#### H-1 — Alert storm: no duplicate-alert suppression
- **File:** [`app/server/utils/alertChecker.js:106`](file:///d:/smart%20health%20care/app/server/utils/alertChecker.js)
- **Issue:** Every IoT reading that crosses a threshold creates a new DB alert row, with no deduplication window. At 3-second intervals, a patient with sustained tachycardia generates 1,200 alerts/hour, flooding the UI and the `alerts` collection.
- **Fix:** Before inserting, check if an unacknowledged alert of the same `{patientId, metric, type}` was created within the last N minutes (e.g. 10). Only create if absent.

#### H-2 — No trend / deterioration detection
- **Files:** [`utils/alertChecker.js`](file:///d:/smart%20health%20care/app/server/utils/alertChecker.js), [`routes/healthData.js`](file:///d:/smart%20health%20care/app/server/routes/healthData.js)
- **Issue:** Alerts fire only on instantaneous threshold crossings. There is zero detection of gradual deterioration (e.g. SpO2 dropping 1% per reading over 10 readings) or sustained abnormal trend. This is a key stated goal.
- **Fix:** After saving a reading, fetch the last N readings for that patient and compute a simple linear slope or rolling mean. If the trend is negative beyond a threshold, emit a `trend-alert`.

#### H-3 — Report file download has no ownership check (IDOR)
- **File:** [`app/server/routes/reports.js:127`](file:///d:/smart%20health%20care/app/server/routes/reports.js)
- **Issue:** `GET /api/reports/download/:filename` returns any file in the uploads directory to any authenticated user — no check that the requesting user owns or has access to the report. A patient can download another patient's report by guessing the filename (timestamp-based, predictable).
- **Fix:** Look up the `Report` by filename first, verify the requesting user's role/patientId, then serve.

#### H-4 — Report routes have no role-based access filter (IDOR in listing too)
- **File:** [`app/server/routes/reports.js:115`](file:///d:/smart%20health%20care/app/server/routes/reports.js)
- **Issue:** `GET /api/reports/:patientId` returns all reports for any `patientId` to any authenticated user. A patient user can substitute another patient's ID in the URL.
- **Fix:** Apply the same `_buildFilter(req.user)` pattern used in `alerts.js` — patients see only their own, doctors see only assigned patients.

#### H-5 — `PUT /api/patients/:id` accepts `$set: req.body` (mass-assignment)
- **File:** [`app/server/routes/patients.js:139`](file:///d:/smart%20health%20care/app/server/routes/patients.js)
- **Issue:** The entire request body is passed to `$set` without field whitelisting. An attacker can overwrite `user`, `assignedDoctor`, or `patientId` fields directly.
- **Fix:** Destructure and whitelist only the allowed update fields before passing to `$set`.

#### H-6 — Path traversal risk in file download
- **File:** [`app/server/routes/reports.js:129`](file:///d:/smart%20health%20care/app/server/routes/reports.js)
- **Issue:** `req.params.filename` is joined directly to `uploadDir` with no sanitization. A crafted request like `GET /api/reports/download/../../server.js` could serve arbitrary server files.
- **Fix:** Use `path.basename(req.params.filename)` and verify the resolved path starts with `uploadDir`.

#### H-7 — Chatbot `getPatientVitals` ignores the requesting user's identity
- **File:** [`app/server/routes/chatbot.js:209`](file:///d:/smart%20health%20care/app/server/routes/chatbot.js)
- **Issue:** `getPatientVitals` falls back to `Patient.findOne()` (first patient in DB) when no assigned patient is found. A doctor or patient user could see another patient's vitals in the chatbot.
- **Fix:** Use the same role-filter helpers from `alerts.js`/`patients.js` to scope the query.

---

### 🟡 MEDIUM

#### M-1 — No input validation / sanitization middleware
- **File:** [`app/server/server.js`](file:///d:/smart%20health%20care/app/server/server.js)
- **Issue:** No `express-validator` or equivalent. String fields like `name`, `message`, `description` are stored raw. `chatbot.js` processes user-supplied strings with regex but does not strip HTML.
- **Fix:** Add `express-validator` checks on critical routes (auth, patients, chatbot) and strip/escape free-text fields.

#### M-2 — Password strength not enforced
- **File:** [`app/server/models/User.js:23`](file:///d:/smart%20health%20care/app/server/models/User.js)
- **Issue:** Only `minlength: 6` is required. No complexity rule (uppercase, number, symbol). 6-character passwords are trivially brute-forced.
- **Fix:** Raise to minimum 8 characters and add a regex or zxcvbn check at the route level.

#### M-3 — JWT stored in `localStorage` (XSS risk)
- **File:** [`app/client/src/context/AuthContext.jsx:23`](file:///d:/smart%20health%20care/app/client/src/context/AuthContext.jsx)
- **Issue:** Token in `localStorage` is accessible to any JavaScript on the page. Combined with M-1 (no CSP from C-4), a successful XSS attack exfiltrates the token.
- **Fix (minimal):** Add `Content-Security-Policy` via Helmet (C-4 fix). Full fix: move token to `HttpOnly` cookie.

#### M-4 — Token not invalidated on logout / no refresh token
- **File:** [`app/client/src/context/AuthContext.jsx:37`](file:///d:/smart%20health%20care/app/client/src/context/AuthContext.jsx)
- **Issue:** Logout only removes the token from `localStorage`. The JWT itself remains valid for up to 24 hours. There is no server-side denylist.
- **Fix (minimal):** Reduce token TTL from 24h to 1–2h. Full fix: implement a token denylist with Redis or a `revokedAt` field on User.

#### M-5 — Audit log has gaps (most mutations go unlogged)
- **Files:** [`routes/patients.js`](file:///d:/smart%20health%20care/app/server/routes/patients.js), [`routes/alerts.js`](file:///d:/smart%20health%20care/app/server/routes/alerts.js), [`routes/reports.js`](file:///d:/smart%20health%20care/app/server/routes/reports.js), [`routes/auth.js`](file:///d:/smart%20health%20care/app/server/routes/auth.js)
- **Issue:** `AuditLog` is written only in `admin.js` (create/update/delete user). Patient CRUD, alert acknowledgments, report uploads/deletes, and login/logout events are not logged.
- **Fix:** Add `AuditLog.create(...)` to: login (success + failure), patient create/update/delete, alert acknowledge, report upload/delete.

#### M-6 — Alert message is a generic static string (no clinical context)
- **File:** [`app/server/utils/alertChecker.js:38,49`](file:///d:/smart%20health%20care/app/server/utils/alertChecker.js)
- **Issue:** Messages like `"CRITICAL: Heart rate is 155 bpm (Normal: 60-100 bpm)"` include the value but not the trend, patient age/condition context, or suggested action. Clinicians cannot triage quickly.
- **Fix:** Extend the alert message to include: deviation magnitude, how many consecutive readings were abnormal, and a brief action hint (e.g. "Consider requesting ECG").

#### M-7 — Simulator does not exit after `consecutive_errors >= 5`
- **File:** [`app/simulator/iot_simulator.py:114`](file:///d:/smart%20health%20care/app/simulator/iot_simulator.py)
- **Issue:** The simulator prints a fatal message after 5 consecutive connection errors but does **not** call `sys.exit()`. It silently continues indefinitely, printing errors every 3 seconds.
- **Fix:** Add `sys.exit(1)` after the fatal message.

#### M-8 — Patient ID generation race condition
- **File:** [`app/server/models/Patient.js:72`](file:///d:/smart%20health%20care/app/server/models/Patient.js)
- **Issue:** `countDocuments()` + manual string construction is not atomic. Concurrent patient creation will produce duplicate `patientId` values (only partially protected by the `unique` index, which causes an unhandled error).
- **Fix:** Use a MongoDB `findOneAndUpdate` auto-increment counter document or `nanoid` to generate collision-safe IDs.

#### M-9 — `multer` file filter is bypassable
- **File:** [`app/server/routes/reports.js:28`](file:///d:/smart%20health%20care/app/server/routes/reports.js)
- **Issue:** The filter checks `path.extname` OR `file.mimetype`. A file named `malware.php.pdf` passes the extension check. The `cb(null, ext || mime)` call passes `false` silently instead of calling `cb(new Error(...))`, allowing rejected files to be uploaded anyway (multer `cb(null, false)` = accept in some versions).
- **Fix:** Change `cb(null, ext || mime)` to `if (ext && mime) { cb(null, true) } else { cb(new Error('Invalid file type')) }`.

---

### 🟢 LOW

#### L-1 — No tests exist (zero coverage)
- **Issue:** No test files found anywhere in the repository. No unit tests for `alertChecker`, `reportAnalyzer`, or auth logic. No integration tests for API routes.
- **Fix:** Add Jest + Supertest for the server; Vitest for the client. Start with `alertChecker.js` threshold logic (pure function, easy to test) and auth routes.

#### L-2 — `node --watch` used in production-adjacent `dev` script
- **File:** [`app/server/package.json:8`](file:///d:/smart%20health%20care/app/server/package.json)
- **Issue:** `node --watch` is a Node 18 experimental feature. Not suitable for production. No `nodemon` or `pm2` configured for production stability.
- **Fix:** Add `nodemon` as a dev dependency and use `pm2` or systemd for production deployment.

#### L-3 — `AuthContext` does not revalidate token on mount
- **File:** [`app/client/src/context/AuthContext.jsx:13`](file:///d:/smart%20health%20care/app/client/src/context/AuthContext.jsx)
- **Issue:** On page reload, the stored `user` object from `localStorage` is used directly without hitting `GET /api/auth/me`. If the user's account was deactivated server-side, the client remains "logged in" until the next 401.
- **Fix:** Call `/api/auth/me` on mount and update the user state from the server response.

#### L-4 — `reportAnalyzer` severity thresholds are percentage-based, not clinical
- **File:** [`app/server/utils/reportAnalyzer.js:64`](file:///d:/smart%20health%20care/app/server/utils/reportAnalyzer.js)
- **Issue:** `classifySeverity` labels a value `critical` if it is >30% below normal range — purely mathematical. Clinical criticality has different cutoffs (e.g. hemoglobin <7 g/dL is critical regardless of percentage). False severity assignments mislead clinicians.
- **Fix:** Add per-metric absolute critical thresholds to `REFERENCE_RANGES` and check them first before falling back to percentage logic.

#### L-5 — Socket.IO broadcast leaks PHI across all sessions
- **File:** [`app/server/utils/alertChecker.js:110`](file:///d:/smart%20health%20care/app/server/utils/alertChecker.js)
- **Issue:** `io.emit('new-alert', alert)` broadcasts to **all** connected clients. Patient-role users receive alerts for other patients. The client-side filters it by `patientId` (see `Dashboard.jsx:57`), but PHI has already been transmitted over the wire.
- **Fix:** Use Socket.IO rooms — join each authenticated socket to rooms based on their role/patientIds. Emit only to the relevant room.

#### L-6 — History page has no pagination (unbounded query)
- **File:** [`app/server/routes/healthData.js:83`](file:///d:/smart%20health%20care/app/server/routes/healthData.js)
- **Issue:** Default `limit=100` in the query, but the client can request `limit=100000`. For a patient with months of data at 3-second intervals, this could return millions of rows.
- **Fix:** Cap `limit` server-side (e.g. max 500) and add cursor-based or offset pagination.

---

## 3. Ranked Gap Summary

| # | ID | Priority | Area | Effort |
|---|---|---|---|---|
| 1 | C-1 | 🔴 Critical | Secrets / Security | XS |
| 2 | C-2 | 🔴 Critical | API Security | S |
| 3 | C-3 | 🔴 Critical | Brute-force protection | XS |
| 4 | C-4 | 🔴 Critical | HTTP headers | XS |
| 5 | C-5 | 🔴 Critical | CORS policy | XS |
| 6 | H-1 | 🟠 High | Alert storm / dedup | S |
| 7 | H-2 | 🟠 High | Trend detection (key feature) | M |
| 8 | H-3 | 🟠 High | File download IDOR | XS |
| 9 | H-4 | 🟠 High | Report listing IDOR | S |
| 10 | H-5 | 🟠 High | Mass assignment | XS |
| 11 | H-6 | 🟠 High | Path traversal | XS |
| 12 | H-7 | 🟠 High | Chatbot data leak | S |
| 13 | M-1 | 🟡 Medium | Input validation | S |
| 14 | M-2 | 🟡 Medium | Password policy | XS |
| 15 | M-3 | 🟡 Medium | Token storage XSS | M |
| 16 | M-4 | 🟡 Medium | Token invalidation | S |
| 17 | M-5 | 🟡 Medium | Audit log gaps | S |
| 18 | M-6 | 🟡 Medium | Alert message quality | S |
| 19 | M-7 | 🟡 Medium | Simulator exit bug | XS |
| 20 | M-8 | 🟡 Medium | Patient ID race condition | XS |
| 21 | M-9 | 🟡 Medium | Multer filter bypass | XS |
| 22 | L-1 | 🟢 Low | Zero test coverage | L |
| 23 | L-2 | 🟢 Low | Dev server stability | XS |
| 24 | L-3 | 🟢 Low | Token revalidation on mount | XS |
| 25 | L-4 | 🟢 Low | Clinical severity thresholds | S |
| 26 | L-5 | 🟢 Low | Socket PHI broadcast | M |
| 27 | L-6 | 🟢 Low | Unbounded history query | XS |

---

## 4. Proposed Implementation Order

### Phase 1 — Security Hardening (all Critical + Critical-adjacent High, ~1 day)
1. **C-1** Rotate JWT secret, remove from git, add to `.gitignore`
2. **C-3** Add `express-rate-limit` to `server.js`
3. **C-4** Add `helmet` to `server.js`
4. **C-5** Restrict CORS origin via env variable
5. **H-6** Fix path traversal in download route (`path.basename`)
6. **H-5** Whitelist fields in `PUT /api/patients/:id`
7. **M-9** Fix multer filter to reject with error
8. **M-7** Add `sys.exit(1)` in simulator
9. **M-2** Raise password minlength + add complexity regex

### Phase 2 — Authorization Fixes (High IDOR gaps, ~0.5 day)
10. **H-3** Add ownership check to report download
11. **H-4** Add role filter to report listing
12. **H-7** Scope chatbot vitals query to requesting user
13. **C-2** Add device API key check to IoT ingest endpoint

### Phase 3 — Functional Improvements (key product feature, ~1 day)
14. **H-1** Add duplicate-alert deduplication window in `alertChecker.js`
15. **H-2** Implement trend detection (rolling slope on last N readings) and trend-alert creation
16. **M-6** Improve alert message with deviation magnitude + consecutive-count context

### Phase 4 — Audit, Validation, Quality (~0.5 day)
17. **M-5** Add audit log entries to login, patient CRUD, alert acknowledge, report upload/delete
18. **M-1** Add `express-validator` to auth + patient routes
19. **M-4** Reduce JWT TTL; add token denylist (or at minimum log logout events)
20. **M-8** Fix patient ID generation (counter document or nanoid)
21. **L-4** Add per-metric absolute critical thresholds to `reportAnalyzer`
22. **L-6** Cap `limit` parameter server-side in health-data route

### Phase 5 — Low Priority / Polish (as time permits)
23. **L-3** Revalidate token on `AuthContext` mount
24. **M-3** Move toward `HttpOnly` cookie for token (requires server-side cookie support)
25. **L-5** Implement Socket.IO rooms for PHI scoping
26. **L-1** Add Jest + Supertest test suite starting with `alertChecker.js`
27. **L-2** Add `nodemon` for dev; document `pm2` for production

---

> **Awaiting your approval.** No code has been changed. Please confirm which phases to proceed with, or adjust scope/priority before implementation begins.
