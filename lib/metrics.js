/**
 * Metrics Collection Module
 *
 * Collects and tracks performance metrics for monitoring.
 */

class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byStatus: new Map(),
        averageResponseTime: 0,
        totalResponseTime: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0
      },
      api: {
        upstreamRequests: 0,
        upstreamFailures: 0,
        upstreamResponseTime: 0
      },
      errors: {
        total: 0,
        byType: new Map()
      }
    };
    
    this.responseTimes = [];
    this.maxResponseTimes = 1000; // Keep last 1000 response times
  }

  // Request metrics
  recordRequest(req, res, duration) {
    this.metrics.requests.total++;
    this.metrics.requests.totalResponseTime += duration;
    
    // Update average response time
    this.metrics.requests.averageResponseTime = 
      this.metrics.requests.totalResponseTime / this.metrics.requests.total;
    
    // Track response times for percentile calculations
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }
    
    // Track by endpoint
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const endpointCount = this.metrics.requests.byEndpoint.get(endpoint) || 0;
    this.metrics.requests.byEndpoint.set(endpoint, endpointCount + 1);
    
    // Track by status code
    const statusCount = this.metrics.requests.byStatus.get(res.statusCode) || 0;
    this.metrics.requests.byStatus.set(res.statusCode, statusCount + 1);
  }

  // Cache metrics
  recordCacheHit(key) {
    this.metrics.cache.hits++;
    this.updateCacheHitRate();
  }

  recordCacheMiss(key) {
    this.metrics.cache.misses++;
    this.updateCacheHitRate();
  }

  recordCacheEviction(key) {
    this.metrics.cache.evictions++;
  }

  updateCacheSize(size) {
    this.metrics.cache.size = size;
    this.updateCacheHitRate();
  }

  updateCacheHitRate() {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
  }

  // API metrics
  recordUpstreamRequest(duration) {
    this.metrics.api.upstreamRequests++;
    this.metrics.api.upstreamResponseTime += duration;
  }

  recordUpstreamFailure(error) {
    this.metrics.api.upstreamFailures++;
    const errorType = error.name || 'Unknown';
    const errorCount = this.metrics.errors.byType.get(errorType) || 0;
    this.metrics.errors.byType.set(errorType, errorCount + 1);
  }

  recordError(error, req) {
    this.metrics.errors.total++;
    const errorType = error.name || 'Unknown';
    const errorCount = this.metrics.errors.byType.get(errorType) || 0;
    this.metrics.errors.byType.set(errorType, errorCount + 1);
  }

  // Get metrics summary
  getMetrics() {
    return {
      ...this.metrics,
      responseTimePercentiles: this.getResponseTimePercentiles(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  getResponseTimePercentiles() {
    if (this.responseTimes.length === 0) return {};
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    return {
      p50: this.getPercentile(sorted, 50),
      p90: this.getPercentile(sorted, 90),
      p95: this.getPercentile(sorted, 95),
      p99: this.getPercentile(sorted, 99)
    };
  }

  getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  // Reset metrics
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byStatus: new Map(),
        averageResponseTime: 0,
        totalResponseTime: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: this.metrics.cache.size,
        hitRate: 0
      },
      api: {
        upstreamRequests: 0,
        upstreamFailures: 0,
        upstreamResponseTime: 0
      },
      errors: {
        total: 0,
        byType: new Map()
      }
    };
    this.responseTimes = [];
  }

  // Middleware for automatic request tracking
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.recordRequest(req, res, duration);
      });
      
      next();
    };
  }
}

// Create global metrics instance
const metrics = new MetricsCollector();

module.exports = {
  MetricsCollector,
  metrics
};
