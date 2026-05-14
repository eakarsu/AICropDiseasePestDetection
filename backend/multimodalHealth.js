/**
 * Custom Feature: multimodal-health
 * Multi-modal crop health assessment
 *
 * POST /api/ai/multimodal-health
 * Auth required (inline JWT verification matching server.js convention).
 * Integration credentials: process.env.FEATURE_MULTIMODAL_HEALTH_KEY
 * TODO: configure credentials
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
let pool = null; try { pool = require('./db'); } catch (_) { pool = null; }

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const FEATURE_KEY = process.env.FEATURE_MULTIMODAL_HEALTH_KEY;
const SYSTEM_PROMPT = `You are an expert agricultural assistant specialized in: Multi-modal crop health assessment.
Respond with clear, actionable analysis. Prefer JSON when structured output is requested.`;

function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'crop-disease-secret');
    req.user = decoded;
    req.userId = decoded.id || decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function callLLM(userPayload) {
  if (!OPENROUTER_API_KEY) {
    const err = new Error('OPENROUTER_API_KEY not configured');
    err.statusCode = 503;
    throw err;
  }
  const fetchFn = global.fetch || (await import('node-fetch')).default;
  const response = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AICropDiseasePestDetection - multimodal-health',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: typeof userPayload === 'string' ? userPayload : JSON.stringify(userPayload) },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter error');
  if (!data.choices || !data.choices[0]) throw new Error('Invalid AI response');
  const content = data.choices[0].message.content;
  let parsed;
  try { parsed = JSON.parse(content); } catch (_) {
    const m = content.match(/```json\n?([\s\S]*?)\n?```/);
    try { parsed = m ? JSON.parse(m[1]) : { analysis: content }; } catch (__) { parsed = { analysis: content }; }
  }
  return { result: parsed, model: data.model || OPENROUTER_MODEL, tokens: data.usage?.total_tokens || null };
}

router.post('/multimodal-health', auth, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Request body is required' });
    }
    if (!FEATURE_KEY) res.set('X-Feature-Credentials-Missing', 'FEATURE_MULTIMODAL_HEALTH_KEY');
    const ai = await callLLM({ feature: 'multimodal-health', goal: 'Multi-modal crop health assessment', input: payload });
    try {
      if (pool && pool.query) {
        await pool.query(
          `INSERT INTO ai_results (user_id, endpoint, model, result) VALUES ($1, $2, $3, $4)`,
          [req.userId || null, 'multimodal-health', ai.model, JSON.stringify({ parsed: ai.result })]
        );
      }
    } catch (e) { console.warn('[multimodal-health] persistence skipped:', e.message); }
    return res.json({
      ok: true,
      feature: 'multimodal-health',
      endpoint: '/api/ai/multimodal-health',
      ai_result: ai.result,
      model: ai.model,
      tokens: ai.tokens,
      user_id: req.userId || null,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[multimodal-health] error:', err.message);
    return res.status(err.statusCode || 500).json({ error: err.message || 'Internal error' });
  }
});

router.get('/multimodal-health/health', (req, res) => {
  res.json({
    feature: 'multimodal-health',
    endpoint: '/api/ai/multimodal-health',
    openrouter_configured: !!OPENROUTER_API_KEY,
    feature_key_configured: !!FEATURE_KEY,
  });
});

module.exports = router;
