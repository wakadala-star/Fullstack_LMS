const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getLogFileName = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `${date}.log`);
};

const formatLogEntry = (message, level = 'INFO') => {
  return `[${new Date().toISOString()}] [${level}] ${message}\n`;
};

const writeToFile = (logEntry) => {
  const logFile = getLogFileName();
  fs.appendFileSync(logFile, logEntry, 'utf8');
};

const logAuthEvent = (event, email, success = true) => {
  const status = success ? 'SUCCESS' : 'FAILED';
  const message = `Auth ${event} - Email: ${email} - Status: ${status}`;
  const logEntry = formatLogEntry(message, 'AUTH');
  writeToFile(logEntry);
  console.log(logEntry.trim());
};

const requestLogger = (req, res, next) => {
  const message = `${req.method} ${req.originalUrl} - ${req.ip}`;
  const logEntry = formatLogEntry(message, 'REQUEST');
  writeToFile(logEntry);
  next();
};

module.exports = {
  logAuthEvent,
  requestLogger,
  formatLogEntry,
  writeToFile,
};
