/**
 * Rate Limiting Middleware
 *
 * Simple in-memory rate limiter to prevent abuse.
 * Uses sliding window algorithm with configurable limits.
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100; // requests per window
    this.clients = new Map();
    
    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.windowMs);
  }

  middleware() {
    return (req, res, next) => {
      const clientId = this.getClientId(req);
      const now = Date.now();
      
      // Get or create client record
      let client = this.clients.get(clientId);
      if (!client) {
        client = {
          requests: [],
          resetTime: now + this.windowMs
        };
        this.clients.set(clientId, client);
      }

      // Remove old requests outside the window
      client.requests = client.requests.filter(timestamp => 
        now - timestamp < this.windowMs
      );

      // Check if limit exceeded
      if (client.requests.length >= this.maxRequests) {
        const resetTime = Math.ceil((client.resetTime - now) / 1000);
        
        return res.status(429).json({
          error: 'Too many requests',
          detail: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
          limit: this.maxRequests,
          windowMs: this.windowMs,
          retryAfter: resetTime
        });
      }

      // Add current request
      client.requests.push(now);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests,
        'X-RateLimit-Remaining': Math.max(0, this.maxRequests - client.requests.length),
        'X-RateLimit-Reset': new Date(client.resetTime).toISOString()
      });

      next();
    };
  }

  getClientId(req) {
    // Use IP address as client identifier
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
  }

  cleanup() {
    const now = Date.now();
    
    for (const [clientId, client] of this.clients.entries()) {
      // Remove clients whose reset time has passed
      if (now > client.resetTime) {
        this.clients.delete(clientId);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Create different limiters for different endpoints
const createApiLimiter = () => new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100 // 100 requests per 15 minutes
});

const createSearchLimiter = () => new RateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 30 // 30 searches per minute
});

module.exports = {
  RateLimiter,
  createApiLimiter,
  createSearchLimiter
};
