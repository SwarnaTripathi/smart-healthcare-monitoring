require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const healthDataRoutes = require('./routes/healthData');
const alertRoutes = require('./routes/alerts');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const chatbotRoutes = require('./routes/chatbot');

const app = express();
const server = http.createServer(app);

// ── Allowed origin (C-5) ──────────────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] }   // C-5: locked origin
});

// Make io accessible to routes
app.set('io', io);

// ── Security headers (C-4) ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // needed for Vite dev chunks
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
    }
  },
  crossOriginEmbedderPolicy: false  // keep off — allows PDF preview in iframe
}));

// ── CORS (C-5) ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));

// ── Rate limiting (C-3) ───────────────────────────────────────────────────────
// Strict limit on auth routes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again in 15 minutes.' }
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Request rate limit exceeded. Please slow down.' }
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/health-data', healthDataRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Health check (uploads are served exclusively through authenticated /api/reports/download/:filename)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Socket.IO connection handling ─────────────────────────────────────────────
// G8: require JWT verification before joining any room.
const jwt     = require('jsonwebtoken');
const User    = require('./models/User');
const Patient = require('./models/Patient');

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Clients emit join-rooms with their Bearer token immediately after connecting.
  // The server validates the token server-side, then joins the socket to the
  // rooms that correspond to the user's actual role and assigned patients.
  socket.on('join-rooms', async ({ token } = {}) => {
    try {
      if (!token) { socket.disconnect(true); return; }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.userId).select('role isActive');
      if (!user || !user.isActive) { socket.disconnect(true); return; }

      if (user.role === 'admin') {
        socket.join('admin');
      } else if (user.role === 'doctor') {
        // Join only rooms for patients actually assigned to this doctor
        const assigned = await Patient.find({ assignedDoctor: user._id }).select('patientId');
        assigned.forEach(p => socket.join(`patient:${p.patientId}`));
        socket.join('admin');   // doctors also receive admin-room broadcasts
      } else {
        // patient role: join only their own room
        const linked = await Patient.findOne({ user: user._id }).select('patientId');
        if (linked) socket.join(`patient:${linked.patientId}`);
      }
    } catch {
      // Invalid / expired token — disconnect immediately, no error detail exposed
      socket.disconnect(true);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});


// SPA fallback: serve index.html for non-API routes, or 404 for unmatched API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║   🏥 Smart Healthcare Monitoring System             ║
║   ─────────────────────────────────────────────      ║
║   🌐 Server:    http://localhost:${PORT}               ║
║   📡 Socket.IO: Active                              ║
║   🗄️  Database:  MongoDB Connected                   ║
║   🔒 Security:  Helmet + Rate-limit + CORS locked    ║
╚══════════════════════════════════════════════════════╝
    `);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
