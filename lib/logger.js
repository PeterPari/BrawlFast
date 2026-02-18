/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging with different levels.
 * Includes request tracing and performance metrics.
 */

const levels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(options = {}) {
    this.level = this.getLevel(options.level || 'info');
    this.pretty = options.pretty || false;
  }

  getLevel(levelName) {
    return levels[levelName.toUpperCase()] || levels.INFO;
  }

  shouldLog(level) {
    return level <= this.level;
  }

  formatMessage(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: Object.keys(levels)[level],
      message,
      ...meta
    };

    if (this.pretty) {
      return `${logEntry.timestamp} [${logEntry.level}] ${message} ${JSON.stringify(meta)}`;
    }

    return JSON.stringify(logEntry);
  }

  error(message, meta = {}) {
    if (this.shouldLog(levels.ERROR)) {
      console.error(this.formatMessage(levels.ERROR, message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog(levels.WARN)) {
      console.warn(this.formatMessage(levels.WARN, message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog(levels.INFO)) {
      console.log(this.formatMessage(levels.INFO, message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog(levels.DEBUG)) {
      console.log(this.formatMessage(levels.DEBUG, message, meta));
    }
  }

  // Request logging middleware
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      const requestId = this.generateRequestId();
      
      // Add request ID to request object
      req.requestId = requestId;
      
      // Log request start
      this.info('Request started', {
        requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        this.info('Request completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('Content-Length')
        });
      });

      next();
    };
  }

  // Error logging middleware
  errorLogger() {
    return (err, req, res, next) => {
      this.error('Request error', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        error: err.message,
        stack: err.stack,
        ip: req.ip
      });

      next(err);
    };
  }

  generateRequestId() {
    return Math.random().toString(36).substr(2, 9);
  }

  // Performance logging
  logPerformance(operation, duration, meta = {}) {
    this.info('Performance metric', {
      operation,
      duration,
      ...meta
    });
  }

  // Cache logging
  logCache(operation, key, hit, meta = {}) {
    this.debug('Cache operation', {
      operation,
      key,
      hit,
      ...meta
    });
  }

  // API logging
  logApiCall(endpoint, method, duration, statusCode, meta = {}) {
    this.info('API call', {
      endpoint,
      method,
      duration,
      statusCode,
      ...meta
    });
  }
}

// Create default logger instance
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.NODE_ENV !== 'production'
});

module.exports = {
  Logger,
  logger
};
