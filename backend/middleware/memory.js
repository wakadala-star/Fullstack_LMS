const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

const getCacheStats = () => {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    ksize: cache.getStats().ksize,
    vsize: cache.getStats().vsize,
  };
};

const cacheMiddleware = (ttl = 300) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `__cache__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    res.json = (body) => {
      cache.set(key, body, ttl);
      res.originalJson(body);
    };

    next();
  };
};

const invalidateCache = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter((key) => key.includes(pattern));
  matchingKeys.forEach((key) => cache.del(key));
};

const getMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  return {
    rss: formatBytes(memUsage.rss),
    heapTotal: formatBytes(memUsage.heapTotal),
    heapUsed: formatBytes(memUsage.heapUsed),
    external: formatBytes(memUsage.external),
    arrayBuffers: formatBytes(memUsage.arrayBuffers),
    uptime: formatUptime(process.uptime()),
  };
};

const formatBytes = (bytes) => {
  const mb = (bytes / 1024 / 1024).toFixed(2);
  return `${mb} MB`;
};

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

const memoryMonitor = (req, res, next) => {
  next();
};

const cleanupOnExit = () => {
  cache.flushAll();
  console.log('Cache cleared on shutdown');
};

process.on('SIGINT', cleanupOnExit);
process.on('SIGTERM', cleanupOnExit);

module.exports = {
  cache,
  cacheMiddleware,
  invalidateCache,
  getCacheStats,
  getMemoryUsage,
  memoryMonitor,
  cleanupOnExit,
};
