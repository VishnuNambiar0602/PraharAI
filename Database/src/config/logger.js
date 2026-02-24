const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const LOG_COLORS = {
  ERROR: '\x1b[31m',     // Red
  WARN: '\x1b[33m',      // Yellow
  INFO: '\x1b[36m',      // Cyan
  DEBUG: '\x1b[90m',     // Gray
  RESET: '\x1b[0m',      // Reset
};

const getCurrentLogLevel = () => {
  const level = process.env.LOG_LEVEL || 'info';
  return level.toUpperCase();
};

const shouldLog = (messageLevel, currentLevel) => {
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
  return levels.indexOf(messageLevel) <= levels.indexOf(currentLevel);
};

const formatMessage = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level] || '';
  const reset = LOG_COLORS.RESET;
  
  let output = `${color}[${timestamp}] [${level}]${reset} ${message}`;
  if (data) {
    output += `\n${JSON.stringify(data, null, 2)}`;
  }
  return output;
};

const logger = {
  error: (message, data = null) => {
    if (shouldLog('ERROR', getCurrentLogLevel())) {
      console.error(formatMessage('ERROR', message, data));
    }
  },
  warn: (message, data = null) => {
    if (shouldLog('WARN', getCurrentLogLevel())) {
      console.warn(formatMessage('WARN', message, data));
    }
  },
  info: (message, data = null) => {
    if (shouldLog('INFO', getCurrentLogLevel())) {
      console.log(formatMessage('INFO', message, data));
    }
  },
  debug: (message, data = null) => {
    if (shouldLog('DEBUG', getCurrentLogLevel())) {
      console.log(formatMessage('DEBUG', message, data));
    }
  },
};

export default logger;
