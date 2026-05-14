const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function makeKeyGenerator() {
  return function keyGen(req) {
    if (req.userId) return String(req.userId);
    return ipKeyGenerator(req);
  };
}

// 20 AI calls per hour per user
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: makeKeyGenerator(),
  message: {
    error: 'Too many AI requests. Limit is 20 per hour. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter — 200 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: makeKeyGenerator(),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter, generalLimiter };
