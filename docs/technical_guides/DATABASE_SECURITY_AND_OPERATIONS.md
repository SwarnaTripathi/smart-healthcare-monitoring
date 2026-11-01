# Database Security, Privacy & Operational Runbook

**Smart Healthcare Monitoring System**  
**Document Version:** 1.0.0  
**Target Environment:** Node.js / Express / Mongoose / MongoDB (WiredTiger)

---

## 1. Architecture & Threat Model

The Smart Healthcare Monitoring System manages sensitive Protected Health Information (PHI) and high-frequency physiological telemetry (heart rate, SpO2, body temperature, lab diagnostics, clinical alerts).

### Architectural Boundary Rules
1. **Backend Exclusivity:** The client application (Vite / React SPA) has **no direct database access** and contains zero database drivers, credentials, or connection strings. All database operations are mediated through authenticated, role-authorized REST and WebSocket APIs on the Express server.
2. **Least-Privilege Connection:** The backend communicates with MongoDB over private networks using a dedicated, non-administrative service account constrained strictly to the `smart_healthcare` database.
3. **Defense in Depth:** Security is enforced across multiple tiers:
   - Network level (private VPC, internal binding, TLS encryption).
   - Application level (JWT authentication, role-based access control, patient ownership scoping, query parameter sanitization).
   - Database level (schema validation, field length constraints, compound indexing, append-only audit enforcement).
   - Storage level (WiredTiger encryption at rest, volume-level encryption).

---

## 2. Least-Privilege Database Access Control

### 2.1 MongoDB Role-Based Access Control (RBAC)
The application must **never** connect as the `root` user or with `dbAdminAnyDatabase` / `userAdminAnyDatabase` privileges.

#### Step 1: Initialize Database Administrator (One-Time Setup)
```javascript
// Connect to the 'admin' database as root/admin
use admin;
db.createUser({
  user: "adminUser",
  pwd: "GENERATE_STRONG_RANDOM_PASSWORD_FOR_ADMIN",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
});
```

#### Step 2: Create Dedicated Application Service User
Create a user restricted solely to `readWrite` operations on `smart_healthcare`:
```javascript
use smart_healthcare;
db.createUser({
  user: "smart_healthcare_app",
  pwd: "GENERATE_STRONG_RANDOM_PASSWORD_FOR_APP",
  roles: [
    { role: "readWrite", db: "smart_healthcare" }
  ]
});
```

#### Step 3: Enforce Authentication in `mongod.conf`
```yaml
# /etc/mongod.conf
net:
  port: 27017
  bindIp: 127.0.0.1  # In production, bind only to localhost or internal VPC private IP
security:
  authorization: enabled
```

---

## 3. Encryption in Transit (TLS / SSL)

All data moving between the Express application server and the MongoDB cluster, as well as between external clients and the Express server, must be encrypted in transit.

### 3.1 MongoDB Network Encryption Configuration
In production `mongod.conf`:
```yaml
net:
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongodb.pem
    CAFile: /etc/ssl/ca.pem
    disabledProtocols: "TLS1_0,TLS1_1"  # Enforce TLS 1.2 or TLS 1.3 only
```

### 3.2 Application Connection String Specification
In `app/server/.env`:
```env
# Production TLS connection string with authentication and replica set support
MONGODB_URI=mongodb://smart_healthcare_app:<PASSWORD>@db1.internal:27017,db2.internal:27017/smart_healthcare?replicaSet=rs0&ssl=true&tlsCAFile=/path/to/ca.pem&authSource=smart_healthcare&retryWrites=true&w=majority
```

### 3.3 HTTP & WebSocket Security in Transit
- The Express application enforces HSTS (`Strict-Transport-Security: max-age=15552000; includeSubDomains`) via `helmet`.
- Production deployments must terminate TLS at an Nginx/Caddy reverse proxy or cloud load balancer using valid certificates (e.g. Let's Encrypt / AWS ACM) enforcing TLS 1.3 / 1.2 with secure cipher suites.

---

## 4. Encryption at Rest

To protect patient records against unauthorized access via lost disks, physical server theft, or raw block storage inspection, encryption at rest must be enabled.

### 4.1 WiredTiger Storage Engine Encryption (Native)
MongoDB Enterprise supports native encryption at rest using AES-256-CBC or AES-256-GCM.
```yaml
# /etc/mongod.conf
security:
  enableEncryption: true
  encryptionCipherMode: AES256-GCM
  encryptionKeyFile: /var/lib/mongodb/mongodb-keyfile  # Perms: chmod 600, chown mongodb:mongodb
```
*Note: For enterprise clusters, configure KMIP (Key Management Interoperability Protocol) with HashiCorp Vault or AWS KMS.*

### 4.2 Operating System & Storage Volume Encryption
For MongoDB Community installations where native engine encryption is unavailable:
1. **Linux (LUKS):** Mount the MongoDB data directory (`/var/lib/mongodb`) on a `dm-crypt` LUKS-encrypted volume.
2. **Windows Server:** Enable BitLocker on the volume housing the MongoDB data directory.
3. **Cloud Infrastructure (AWS/GCP/Azure):** Enforce default storage encryption:
   - AWS EBS: KMS CMK encryption with AES-256.
   - GCP: Customer-managed or Google-managed encryption keys for Persistent Disks.
   - Azure: Azure Storage Service Encryption (SSE).

---

## 5. Schema Validation, Constraints & Data Minimization

To uphold the principle of **data minimization** (GDPR Art. 5, HIPAA minimum necessary standard) and prevent payload injection:

### 5.1 Elimination of Unnecessary Information
- The system **does not** collect national identifiers (SSN, Aadhaar), financial details, credit card numbers, or full passport details.
- Optional fields (`address`, `emergencyContact`, `medicalHistory`) are defaulted to empty strings and constrained with strict character length limits to prevent denial-of-service via massive payload ingestion:
  - `phone`: Max 20 chars
  - `address`: Max 500 chars
  - `medicalHistory`: Max 5000 chars
  - `emergencyContact`: Structured `{ name: 100, phone: 20, relation: 50 }`
  - `deviceId`: Max 50 chars
  - `report.title`: Max 200 chars
  - `report.description`: Max 2000 chars
  - `alert.message`: Max 1000 chars

### 5.2 Atomic Migration-Safe Patient ID Generation
- `Patient.js` uses an atomic `Counter` collection via `findOneAndUpdate` with `$inc: { seq: 1 }`.
- **Migration Safety:** The pre-validation hook checks if `Counter` exists. If initializing on an existing database, it seeds the counter with the highest numerical suffix among existing `PT-xxxxx` records (`$setOnInsert: { seq: currentMax }`), preventing duplicate key errors during migrations.

### 5.3 Database Indexing Architecture
| Collection | Indexes | Query Purpose |
|---|---|---|
| `users` | `{ email: 1 }` (unique)<br>`{ role: 1 }`<br>`{ isActive: 1 }` | Fast authentication lookup; role filtering in admin panels; active status checks |
| `patients` | `{ patientId: 1 }` (unique)<br>`{ user: 1 }`<br>`{ assignedDoctor: 1 }`<br>`{ status: 1 }` | O(1) patient resolution; patient-level ownership checks; doctor assignment listing |
| `healthdata` | `{ patientId: 1, timestamp: -1 }`<br>`{ timestamp: 1 }` | Time-series query optimization; latest reading resolution; range queries |
| `alerts` | `{ createdAt: -1 }`<br>`{ patientId: 1, acknowledged: 1 }`<br>`{ patientId: 1, metric: 1, acknowledged: 1, createdAt: -1 }` | Chronological alert feed; unacknowledged alert counters; alert storm deduplication window |
| `reports` | `{ patientId: 1, createdAt: -1 }`<br>`{ fileName: 1 }`<br>`{ uploadedBy: 1 }` | Patient report listing; secure download ownership checks; doctor upload tracking |
| `auditlogs` | `{ createdAt: -1 }`<br>`{ category: 1, createdAt: -1 }`<br>`{ userId: 1, createdAt: -1 }` | Admin audit log pagination; category filtering; user-specific forensics |

---

## 6. Access Control, Mass-Assignment & Query Protections

### 6.1 Patient Ownership & Assignment Enforcements
1. **Patient Users:** Can read and modify only their own record. `GET /api/patients` and `GET /api/reports/:patientId` scope queries using `_getPatientFilter` (`{ user: req.user._id }`).
2. **Doctor Users:** Can read and update only patients explicitly assigned to them (`{ assignedDoctor: req.user._id }`). Direct updates (`PUT /api/patients/:id`) verify that `targetPatient.assignedDoctor == req.user._id` before applying changes.
3. **Admin Users:** Retain system oversight with full audit trail logging.

### 6.2 Mass-Assignment Prevention
`PUT /api/patients/:id` uses a strict whitelist of editable attributes (`name`, `age`, `gender`, `bloodGroup`, `phone`, `address`, `emergencyContact`, `medicalHistory`, `assignedDoctor`, `status`, `deviceId`). Tampering with system-managed fields (`_id`, `patientId`, `user`) is completely rejected.

### 6.3 NoSQL Injection Defense & Bulk Query Protection
- Query parameters (such as `category` on `/api/admin/audit-logs`) are validated against whitelists before constructing Mongoose queries, preventing operator injection attacks (`$ne`, `$where`, `$gt`).
- All unbounded queries have hard server-side pagination ceilings:
  - Health data history: Capped at max 500 records.
  - Alerts: Capped at max 500 records.
  - Audit logs: Capped at max 200 records per page.
  - Device aggregation: Aggregation pipeline bounded by `$limit: 100`.

---

## 7. Audit Log Tamper-Resistance & Logging Security

### 7.1 Schema-Enforced Immutability
In [`app/server/models/AuditLog.js`](file:///d:/smart%20health%20care/app/server/models/AuditLog.js), Mongoose pre-hooks actively intercept and block all mutation and deletion operations:
```javascript
auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function (next) {
  next(new Error('Security Violation: Audit logs are immutable and cannot be deleted.'));
});
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
  next(new Error('Security Violation: Audit logs are immutable and cannot be modified.'));
});
```

### 7.2 Strict Log Sanitization Policy
The audit logging subsystem adheres strictly to privacy standards:
- **No Credentials:** Plaintext passwords, password hashes, JWT tokens, and device API keys are strictly excluded from audit payloads.
- **Minimal Metadata:** Update actions record **field names modified** (e.g. `fields: name, age`) rather than logging sensitive diagnostic content or full previous/new states.
- **Access Restriction:** Audit logs are accessible exclusively to verified administrators via `authorize('admin')`.

---

## 8. Backup, Restoration & Disaster Recovery Procedures

### 8.1 Automated Backup Script (`backup-mongodb.sh`)
Create `/opt/scripts/backup-mongodb.sh` with execution permissions (`chmod 700`):
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/mongodb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEST_FILE="${BACKUP_DIR}/smart_healthcare_${TIMESTAMP}.archive.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting MongoDB backup..."
mongodump \
  --uri="${MONGODB_URI}" \
  --db=smart_healthcare \
  --gzip \
  --archive="${DEST_FILE}"

echo "[$(date)] Backup completed: ${DEST_FILE}"

# Enforce retention policy: delete backups older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "smart_healthcare_*.archive.gz" -type f -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days."
```

### 8.2 Backup Verification Procedure
Always verify backup integrity before relying on it:
```bash
# Test archive readability without restoring
mongorestore --gzip --archive=/var/backups/mongodb/smart_healthcare_<TIMESTAMP>.archive.gz --dryRun
```

### 8.3 Restoration Procedure (Disaster Recovery)
To restore a backup into a target or staging database:
```bash
# 1. Stop application traffic (prevent concurrent writes during restore)
systemctl stop smart-healthcare-server

# 2. Perform restoration
mongorestore \
  --uri="mongodb://smart_healthcare_app:<PASSWORD>@localhost:27017/smart_healthcare?authSource=smart_healthcare" \
  --db=smart_healthcare \
  --gzip \
  --drop \
  --archive=/var/backups/mongodb/smart_healthcare_<TIMESTAMP>.archive.gz

# 3. Restart application
systemctl start smart-healthcare-server
```

---

## 9. Data Retention & Right-to-be-Forgotten (Cascading Deletion)

### 9.1 High-Frequency Telemetry Data Retention
IoT devices generate readings every 3 seconds (~28,800 records/day per active patient).
- **Active Window:** The operational database keeps granular sensor readings.
- **Optional Automated TTL Index:** To automatically expire raw telemetry older than 90 days, apply:
  ```javascript
  db.healthdatas.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 7776000 }); // 90 days
  ```
  *(Clinical summary reports and alerts are retained independently and not subject to raw telemetry expiry).*

### 9.2 Right-to-be-Forgotten & Patient Purge (Implemented)
When an administrator deletes a patient via `DELETE /api/patients/:id`:
1. The `Patient` record is removed.
2. All associated `HealthData` records for that `patientId` are purged (`deleteMany`).
3. All associated `Alert` records for that `patientId` are purged (`deleteMany`).
4. All associated `Report` records are deleted, and physical report files (PDFs, images) are permanently unlinked and wiped from disk (`fs.unlinkSync`).
5. A high-severity audit event is recorded documenting the purge.

---

## 10. Implementation Verification Matrix

| Requirement | Control Description | Status | Evidence / Location |
|---|---|---|---|
| **R-1** Backend-Only DB Access | No DB drivers/credentials in frontend | **Implemented** | Zero MongoDB dependencies in `app/client`; API-only communication |
| **R-2** Least-Privilege & Safe Queries | Parameterized Mongoose queries; NoSQL injection guards | **Implemented** | Strict Mongoose models; query category whitelisting; non-admin user docs |
| **R-3** Secrets Outside Source Control | Secrets in `.env` only; `.env.example` provided | **Implemented** | `.gitignore` covers `.env`; `.env.example` has placeholder URIs |
| **R-4** Schema Constraints & Indexes | Maxlength limits; role/user/doctor indexes; auto-seed counter | **Implemented** | [`models/Patient.js`](file:///d:/smart%20health%20care/app/server/models/Patient.js), [`models/Report.js`](file:///d:/smart%20health%20care/app/server/models/Report.js), [`models/User.js`](file:///d:/smart%20health%20care/app/server/models/User.js), [`models/Alert.js`](file:///d:/smart%20health%20care/app/server/models/Alert.js) |
| **R-5** Bulk Access & IDOR Protection | Patient ownership; doctor assignment checks on update; query caps | **Implemented** | [`routes/patients.js`](file:///d:/smart%20health%20care/app/server/routes/patients.js) doctor check; 500-record caps in healthData & alerts |
| **R-6** Audit Log Storage & Protection | Append-only schema hooks; admin-only endpoint; pagination | **Implemented** | [`models/AuditLog.js`](file:///d:/smart%20health%20care/app/server/models/AuditLog.js) immutability pre-hooks; [`routes/admin.js`](file:///d:/smart%20health%20care/app/server/routes/admin.js) pagination |
| **R-7** Encryption in Transit & Rest | TLS 1.3 configuration, WiredTiger / LUKS / KMS specifications | **Documented** | Section 3 & 4 of this runbook with configuration scripts |
| **R-8** Backup, Restore & Retention | `mongodump`/`mongorestore` workflows; 30-day retention; purge | **Implemented & Documented** | Cascading delete in [`routes/patients.js`](file:///d:/smart%20health%20care/app/server/routes/patients.js); Section 8 & 9 runbook |
| **R-9** Data Minimization | Avoided SSN/banking data; capped optional patient fields | **Implemented** | [`models/Patient.js`](file:///d:/smart%20health%20care/app/server/models/Patient.js) string length bounds & minimal schema |
| **R-10** Sanitized Logging | Prohibit passwords, keys, and raw clinical data in logs | **Implemented** | Verified audit logs record metadata/field names only, no secrets |
