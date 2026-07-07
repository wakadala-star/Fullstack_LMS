const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./backend/routes/auth');
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
    : ['http://localhost:5000', 'http://127.0.0.1:5000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(hppConfig);
app.use(globalLimiter);
app.use(securityHeaders);
app.use(express.json({ limit: '10kb' }));
app.use(sanitizeInput);
app.use(memoryMonitor);
app.use(requestLogger);

app.use('/api/auth', authRoutes);

app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/api/protected', (req, res) => {
  res.json({ message: 'You have accessed a protected route!' });
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

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
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

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Features enabled: Security, Memory Management, Caching`);
    console.log(`Monitor at: http://localhost:${PORT}/api/stats`);
  });
};

startServer();
