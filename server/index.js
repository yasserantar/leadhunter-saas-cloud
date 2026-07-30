const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/database');
const authRoutes = require('./routes/auth');
const superadminRoutes = require('./routes/superadmin');
const searchRoutes = require('./routes/search');
const leadsRoutes = require('./routes/leads');
const campaignsRoutes = require('./routes/campaigns');
const whatsappRoutes = require('./routes/whatsapp');
const dashboardRoutes = require('./routes/dashboard');
const templatesRoutes = require('./routes/templates');
const { createServer } = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

// خدمات السحابة الإضافية (Cloud Services)
require('./services/backup.js');

const app = express();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

const aiRoutes = require('./routes/ai');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/ai', aiRoutes);

// Socket.io Real-time Updates
io.on('connection', (socket) => {
  console.log('🔗 Client connected:', socket.id);
  socket.on('disconnect', () => console.log('❌ Client disconnected:', socket.id));
});

async function startServer() {
  await initDb();
  const PORT = process.env.PORT || 3000;
  const server = httpServer.listen(PORT, () => {
    console.log('==================================================');
    console.log('🤖 LeadHunter Pro V4.0 AI - FULL SYSTEM STARTED');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('📋 APIs: /auth /search /leads /campaigns /whatsapp');
    console.log('==================================================');
  });
  server.setTimeout(600000); // 10 minutes timeout
}
startServer();

// Pass IO + WhatsApp to global namespace
global.io = io;
global.whatsappReady = false;
global.whatsappClient = null;

// Self-Ping to prevent Render from sleeping (Free Tier bypass)
const axios = require('axios');
setInterval(() => {
  axios.get('https://leadhunter-pro-saas.onrender.com').catch(() => {});
  console.log('⚡ Sent keep-awake ping to server');
}, 10 * 60 * 1000); // Every 10 minutes
