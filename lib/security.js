/**
 * Security Middleware
 *
 * Provides security headers, input validation, and sanitization.
 */

const helmet = require('helmet');

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.brawlify.com", "https://api.brawlapi.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input validation utilities
class InputValidator {
  static sanitizeId(id) {
    if (typeof id !== 'string') return null;
    
    // Remove any non-numeric characters for ID validation
    const numericId = id.replace(/[^0-9]/g, '');
    return numericId === id ? numericId : null;
  }

  static sanitizeSearchQuery(query) {
    if (typeof query !== 'string') return '';
    
    // Remove HTML tags and special characters
    return query
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/['"\\]/g, '') // Remove quotes and backslashes
      .trim()
      .substring(0, 100); // Limit length
  }

  static validateLimit(limit, max = 50) {
    const num = parseInt(limit, 10);
    return (num > 0 && num <= max) ? num : Math.min(max, 20);
  }

  static isValidId(id) {
    return /^\d+$/.test(id);
  }
}

// Validation middleware
const validateSearchQuery = (req, res, next) => {
  const query = req.query.q;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid search query',
      detail: 'Query parameter "q" is required and must be a string'
    });
  }

  const sanitized = InputValidator.sanitizeSearchQuery(query);
  if (!sanitized) {
    return res.status(400).json({
      error: 'Invalid search query',
      detail: 'Search query contains invalid characters'
    });
  }

  req.query.q = sanitized;
  next();
};

const validateMapId = (req, res, next) => {
  const id = req.params.id;
  const sanitized = InputValidator.sanitizeId(id);
  
  if (!sanitized || !InputValidator.isValidId(sanitized)) {
    return res.status(404).json({
      error: 'Invalid map ID',
      detail: 'Map ID must be a numeric string',
      suggestions: []
    });
  }

  req.params.id = sanitized;
  next();
};

const validateBrawlerId = (req, res, next) => {
  const id = req.params.id;
  const sanitized = InputValidator.sanitizeId(id);
  
  if (!sanitized || !InputValidator.isValidId(sanitized)) {
    return res.status(404).json({
      error: 'Invalid brawler ID',
      detail: 'Brawler ID must be a numeric string',
      suggestions: []
    });
  }

  req.params.id = sanitized;
  next();
};

const validateLimit = (req, res, next) => {
  const limit = req.query.limit;
  if (limit !== undefined) {
    const validated = InputValidator.validateLimit(limit);
    req.query.limit = validated;
  } else {
    req.query.limit = 20; // Default limit
  }
  next();
};

// Error handling for invalid requests
const handleValidationError = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      detail: err.message
    });
  }
  next(err);
};

// Request size limiting
const requestSizeLimit = (req, res, next) => {
  const contentLength = req.get('Content-Length');
  const maxSize = 1024 * 1024; // 1MB
  
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return res.status(413).json({
      error: 'Request too large',
      detail: `Maximum request size is ${maxSize} bytes`
    });
  }
  
  next();
};

module.exports = {
  securityHeaders,
  InputValidator,
  validateSearchQuery,
  validateMapId,
  validateBrawlerId,
  validateLimit,
  handleValidationError,
  requestSizeLimit
};
