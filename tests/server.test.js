/**
 * Integration Tests for Server.js
 *
 * Tests API endpoints, caching, error handling, and middleware.
 */

const request = require('supertest');

// Mock the dependencies to avoid external API calls
jest.mock('../lib/statistics');
jest.mock('../lib/rankingEngine', () => {
  const actual = jest.requireActual('../lib/rankingEngine');
  return {
    ...actual,
    computeCPS: jest.fn().mockReturnValue(0.85),
    rankBrawlers: jest.fn().mockImplementation((brawlers) => {
      return brawlers.map(b => ({ ...b, cps: 0.85, tier: 'S' }));
    }),
    assignTiers: jest.fn().mockImplementation((brawlers) => {
      return brawlers.map(b => ({ ...b, tier: 'S' }));
    })
  };
});

// Mock brawlApi to avoid real network calls
jest.mock('../lib/brawlApi', () => ({
  fetchMaps: jest.fn().mockResolvedValue([
    { id: 123, name: 'Test Map', mode: 'gemGrab', _norm: 'testmap' }
  ]),
  fetchBrawlers: jest.fn().mockResolvedValue([
    { id: 1, name: 'Shelly', _norm: 'shelly' }
  ]),
  fetchActiveMapIds: jest.fn().mockResolvedValue(new Set([123])),
  fetchMap: jest.fn().mockImplementation((id) => {
    if (id === '999999') {
      return Promise.reject(new Error('Map not found'));
    }
    return Promise.resolve({
      id: 123,
      name: 'Test Map',
      mode: 'gemGrab',
      stats: [{ brawler: { id: 1, name: 'Shelly' }, winRate: 55, count: 100 }]
    });
  }),
  fetchBrawler: jest.fn().mockResolvedValue({
    id: 1,
    name: 'Shelly',
    stats: { bestMaps: [{ name: 'Test Map', winRate: 55 }] }
  })
}));

// Mock logger to avoid console output in tests
jest.mock('../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    requestLogger: () => (req, res, next) => next(),
    errorLogger: () => (err, req, res, next) => next(err)
  }
}));

// Mock rate limiter to avoid setInterval issues
jest.mock('../lib/rateLimiter', () => ({
  createApiLimiter: () => ({
    middleware: () => (req, res, next) => next()
  }),
  createSearchLimiter: () => ({
    middleware: () => (req, res, next) => next()
  })
}));

// Mock metrics to avoid tracking in tests
jest.mock('../lib/metrics', () => ({
  metrics: {
    middleware: () => (req, res, next) => next(),
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
    recordCacheEviction: jest.fn(),
    updateCacheSize: jest.fn(),
    getMetrics: () => ({
      uptime: 3600,
      requests: { total: 100, averageResponseTime: 50 },
      cache: { hitRate: 75 },
      api: { upstreamFailures: 0 }
    })
  }
}));

const app = require('../server');

describe('Server Integration Tests', () => {
  afterEach(() => {
    // Clean up any open handles
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up intervals
    if (app.cleanup) {
      app.cleanup();
    }
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('catalog');
    });
  });

  describe('Search API', () => {
    it('should handle search requests', async () => {
      const response = await request(app)
        .get('/api/search?q=test')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should validate search query parameter', async () => {
      const response = await request(app)
        .get('/api/search')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should limit search results', async () => {
      const response = await request(app)
        .get('/api/search?q=test&limit=5')
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Map API', () => {
    it('should handle map requests', async () => {
      const response = await request(app)
        .get('/api/map/123')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for invalid map ID', async () => {
      const response = await request(app)
        .get('/api/map/invalid')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle raw map data requests', async () => {
      const response = await request(app)
        .get('/api/map/123?raw=true')
        .expect(200);
    });
  });

  describe('Brawler API', () => {
    it('should handle brawler requests', async () => {
      const response = await request(app)
        .get('/api/brawler/123')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for invalid brawler ID', async () => {
      const response = await request(app)
        .get('/api/brawler/invalid')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle raw brawler data requests', async () => {
      const response = await request(app)
        .get('/api/brawler/123?raw=true')
        .expect(200);
    });
  });

  describe('CORS Middleware', () => {
    it('should handle CORS when enabled', async () => {
      // Set CORS_ORIGIN environment variable
      process.env.CORS_ORIGIN = '*';
      
      const response = await request(app)
        .options('/api/search?q=test')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBe('GET,OPTIONS');
    });

    it('should not set CORS headers when disabled', async () => {
      delete process.env.CORS_ORIGIN;
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/search')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should handle upstream API failures gracefully', async () => {
      // Mock a failed API call
      const response = await request(app)
        .get('/api/map/999999')
        .expect(502);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('suggestions');
    });
  });

  describe('Static Files', () => {
    it('should serve frontend', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('<!doctype html>');
    });

    it('should serve favicon', async () => {
      const response = await request(app)
        .get('/favicon.svg')
        .expect(200);

      expect(response.headers['content-type']).toContain('image/svg+xml');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal request rates', async () => {
      const promises = Array(10).fill().map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Input Validation', () => {
    it('should sanitize search queries', async () => {
      const response = await request(app)
        .get('/api/search?q=<script>alert(1)</script>')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should validate ID parameters', async () => {
      const response = await request(app)
        .get('/api/map/abc123')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
