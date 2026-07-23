const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./backend/routes/auth');
const courseRoutes = require('./backend/routes/courses');
const enrollmentRoutes = require('./backend/routes/enrollments');
const quizRoutes = require('./backend/routes/quizzes');
const gradeRoutes = require('./backend/routes/grades');
const feeRoutes = require('./backend/routes/fees');
const categoryRoutes = require('./backend/routes/categories');
const clockRoutes = require('./backend/routes/clock');
const taskRoutes = require('./backend/routes/tasks');
const classroomRoutes = require('./backend/routes/classrooms');
const agoraRoutes = require('./backend/routes/agora');
const messageRoutes = require('./backend/routes/messages');
const parentStudentRoutes = require('./backend/routes/parent-student');
const { requestLogger } = require('./backend/middleware/logger');
const { testConnection, initDatabase, getPoolStats, getUserCount } = require('./backend/config/db');
const {
  helmetConfig,
  globalLimiter,
  sanitizeInput,
  securityHeaders,
  hppConfig,
} = require('./backend/middleware/security');
const {
  cacheMiddleware,
  getCacheStats,
  getMemoryUsage,
  memoryMonitor,
} = require('./backend/middleware/memory');

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com']
    : ['http://localhost:5000', 'http://localhost:4200', 'http://127.0.0.1:5000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(hppConfig);
app.use(globalLimiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(sanitizeInput);
app.use(memoryMonitor);
app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/clock', clockRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/parent-student', parentStudentRoutes);

// Serve uploaded files with explicit cross-origin headers and no caching
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
}, express.static(uploadsPath, {
  etag: false,
  lastModified: false,
}));

app.use(securityHeaders);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/stats', cacheMiddleware(60), async (req, res) => {
  try {
    const memUsage = getMemoryUsage();
    const poolStats = getPoolStats();
    const cacheStats = getCacheStats();
    const userCount = await getUserCount();

    res.json({
      memory: memUsage,
      database: {
        pool: poolStats,
        userCount: userCount,
      },
      cache: cacheStats,
      server: {
        uptime: memUsage.uptime,
        environment: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

const angularDistPath = path.join(__dirname, 'frontend', 'dist', 'learning-management-system', 'browser');
app.use(express.static(angularDistPath));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const startServer = async () => {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to PostgreSQL. Exiting...');
    process.exit(1);
  }

  await initDatabase();

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`Features: Security, Memory Management, Caching`);
  });

  server.maxConnections = 1000;
  server.timeout = 120000;
};

startServer();
