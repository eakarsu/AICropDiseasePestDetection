/**
 * Advanced AI endpoints for AICropDiseasePestDetection — implements the audit-proposed
 * NEW custom non-CRUD features. All AI calls are rate-limited and persisted to ai_results.
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('./db');
const { queryAI, parseAIJson } = require('./openrouter');
const { aiRateLimiter } = require('./rateLimiter');

function makeRouter({ authMiddleware }) {
  const router = express.Router();

  function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    next();
  }

  async function persistAIResult({ endpoint, userId, entityType, entityId, raw, parsed, model }) {
    try {
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, entity_type, entity_id, model, result)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId || null, endpoint, entityType || null, entityId || null, model || null, JSON.stringify({ raw, parsed })]
      );
    } catch (e) { console.error('[ai_results.insert]', e.message); }
  }

  // ── 1. Seasonal Risk Calendar ──────────────────────────────────────────────
  router.post(
    '/seasonal-risk',
    authMiddleware,
    aiRateLimiter,
    [body('crop_name').notEmpty(), body('region').notEmpty()],
    validate,
    async (req, res) => {
      try {
        const { crop_name, region } = req.body;
        const prompt = `Generate a 12-month risk heatmap for crop diseases & pests for the given crop and region.

Crop: ${crop_name}
Region: ${region}

Return STRICT JSON: {
  "monthly_risk": [
    { "month": "Jan", "disease_risk_pct": 0, "pest_risk_pct": 0, "top_threats": [], "preventive_actions": [] }
    /* ... 12 entries */
  ],
  "high_risk_months": [],
  "calendar_summary": ""
}`;
        const r = await queryAI(prompt);
        const parsed = parseAIJson(r.response) || {};
        await persistAIResult({ endpoint: 'seasonal-risk', userId: req.userId, raw: r.response, parsed, model: r.model });
        res.json({ crop_name, region, ...parsed, raw: r.response, model: r.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 2. Cross-Farm Benchmarking ─────────────────────────────────────────────
  router.post(
    '/cross-farm-benchmark',
    authMiddleware,
    aiRateLimiter,
    [body('crop_name').notEmpty()],
    validate,
    async (req, res) => {
      try {
        const { crop_name } = req.body;
        // Aggregate stats from local user farm + other farms (anonymized)
        const userFarm = await pool.query(
          `SELECT AVG(health_score) AS avg_health, COUNT(*) AS scans
           FROM crop_health WHERE user_id = $1 AND crop_name ILIKE $2`,
          [req.userId, `%${crop_name}%`]
        );
        const peers = await pool.query(
          `SELECT AVG(health_score) AS avg_health, COUNT(*) AS scans
           FROM crop_health WHERE user_id != $1 AND crop_name ILIKE $2`,
          [req.userId, `%${crop_name}%`]
        );

        const prompt = `Compare farmer's performance vs anonymized peer benchmark and surface best practices.

Crop: ${crop_name}
Subject Farm:
- Avg health score: ${parseFloat(userFarm.rows[0].avg_health || 0).toFixed(1)}
- Scans logged: ${userFarm.rows[0].scans}

Peer Cohort:
- Avg health score: ${parseFloat(peers.rows[0].avg_health || 0).toFixed(1)}
- Scans logged: ${peers.rows[0].scans}

Return STRICT JSON: {
  "percentile_rank": 0,
  "performance_label": "top|above|average|below|bottom",
  "key_gaps": [],
  "best_practices_to_adopt": [],
  "expected_yield_lift_pct": 0
}`;
        const r = await queryAI(prompt);
        const parsed = parseAIJson(r.response) || {};
        await persistAIResult({ endpoint: 'cross-farm-benchmark', userId: req.userId, raw: r.response, parsed, model: r.model });
        res.json({ crop_name, you: userFarm.rows[0], peers: peers.rows[0], ...parsed, raw: r.response, model: r.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 3. Fertilizer Optimizer ───────────────────────────────────────────────
  router.post(
    '/fertilizer-optimize',
    authMiddleware,
    aiRateLimiter,
    [
      body('crop_name').notEmpty(),
      body('crop_stage').notEmpty(),
      body('soil').notEmpty(),
    ],
    validate,
    async (req, res) => {
      try {
        const { crop_name, crop_stage, soil, target_yield } = req.body;
        const prompt = `Recommend optimal fertilizer blend and application timing for max ROI.

Crop: ${crop_name}
Growth stage: ${crop_stage}
Soil test: ${JSON.stringify(soil)}
Target yield (optional): ${target_yield || 'best achievable'}

Return STRICT JSON: {
  "blend": { "N_kg_per_ha": 0, "P_kg_per_ha": 0, "K_kg_per_ha": 0, "micros": [] },
  "application_timing": [],
  "split_doses": 0,
  "estimated_yield_increase_pct": 0,
  "estimated_cost_per_ha_usd": 0,
  "estimated_roi_ratio": 0,
  "alternative_organic_blend": "",
  "rationale": ""
}`;
        const r = await queryAI(prompt);
        const parsed = parseAIJson(r.response) || {};
        await persistAIResult({ endpoint: 'fertilizer-optimize', userId: req.userId, raw: r.response, parsed, model: r.model });
        res.json({ crop_name, crop_stage, ...parsed, raw: r.response, model: r.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 4. Weather-Triggered Auto-Alerts ──────────────────────────────────────
  router.post(
    '/weather-trigger',
    authMiddleware,
    aiRateLimiter,
    [
      body('field_name').notEmpty(),
      body('forecast').notEmpty(),
    ],
    validate,
    async (req, res) => {
      try {
        const { field_name, region, forecast } = req.body;
        const prompt = `Inspect this 7-day weather forecast and flag pest/disease risk windows. Generate an alert per risk.

Field: ${field_name}
Region: ${region || 'unknown'}
Forecast: ${JSON.stringify(forecast)}

Return STRICT JSON: {
  "alerts": [
    { "trigger_condition": "", "pest_risk": "", "severity": "low|medium|high|critical", "advised_action": "", "window_start": "", "window_end": "" }
  ],
  "summary": ""
}`;
        const r = await queryAI(prompt);
        const parsed = parseAIJson(r.response) || { alerts: [] };

        // Persist generated alerts
        for (const a of (parsed.alerts || []).slice(0, 10)) {
          await pool.query(
            `INSERT INTO weather_alerts (field_name, region, trigger_condition, pest_risk, severity, forecast)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [field_name, region || null, a.trigger_condition || '', a.pest_risk || '', a.severity || 'low', JSON.stringify(a)]
          );
        }
        await persistAIResult({ endpoint: 'weather-trigger', userId: req.userId, raw: r.response, parsed, model: r.model });
        res.json({ field_name, region, ...parsed, raw: r.response, model: r.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // GET /weather-trigger — paginated alerts log
  router.get('/weather-trigger', authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const [data, count] = await Promise.all([
        pool.query('SELECT * FROM weather_alerts ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
        pool.query('SELECT COUNT(*) FROM weather_alerts'),
      ]);
      res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── 5. Treatment Efficacy Tracker ─────────────────────────────────────────
  router.post(
    '/treatment-efficacy',
    authMiddleware,
    [
      body('field_name').notEmpty(),
      body('treatment_name').notEmpty(),
      body('applied_at').notEmpty(),
      body('health_score_before').isInt({ min: 0, max: 100 }),
    ],
    validate,
    async (req, res) => {
      try {
        const { field_name, crop_name, treatment_name, applied_at, health_score_before, health_score_after, weeks_observed, notes } = req.body;
        const efficacy = (health_score_after && health_score_before)
          ? Math.max(0, Math.min(100, Math.round((health_score_after - health_score_before) / Math.max(1, 100 - health_score_before) * 100)))
          : null;
        const r = await pool.query(
          `INSERT INTO treatment_efficacy (user_id, field_name, crop_name, treatment_name, applied_at, health_score_before, health_score_after, weeks_observed, efficacy_score, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [req.userId, field_name, crop_name || null, treatment_name, applied_at, health_score_before, health_score_after || null, weeks_observed || null, efficacy, notes || null]
        );
        res.status(201).json(r.rows[0]);
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // GET /treatment-efficacy — list + AI insights
  router.get('/treatment-efficacy', authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const [data, count] = await Promise.all([
        pool.query('SELECT * FROM treatment_efficacy WHERE user_id = $1 ORDER BY applied_at DESC LIMIT $2 OFFSET $3', [req.userId, limit, offset]),
        pool.query('SELECT COUNT(*) FROM treatment_efficacy WHERE user_id = $1', [req.userId]),
      ]);
      res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // POST /treatment-efficacy/insights — ask AI to summarize farm-specific learnings
  router.post('/treatment-efficacy/insights', authMiddleware, aiRateLimiter, async (req, res) => {
    try {
      const r = await pool.query('SELECT * FROM treatment_efficacy WHERE user_id = $1 ORDER BY applied_at DESC LIMIT 50', [req.userId]);
      const prompt = `Analyze treatment efficacy history and recommend the most effective treatments per crop.

History (n=${r.rows.length}):
${r.rows.slice(0, 30).map((t) => `- ${t.applied_at} | ${t.crop_name || 'unknown'} | ${t.treatment_name} | before=${t.health_score_before} after=${t.health_score_after} efficacy=${t.efficacy_score}%`).join('\n') || 'no data'}

Return STRICT JSON: {
  "best_treatments": [{ "crop": "", "treatment": "", "avg_efficacy_pct": 0, "sample_count": 0 }],
  "ineffective_treatments": [],
  "farm_specific_insights": [],
  "recommended_next_treatment": ""
}`;
      const ai = await queryAI(prompt);
      const parsed = parseAIJson(ai.response) || {};
      await persistAIResult({ endpoint: 'treatment-efficacy-insights', userId: req.userId, raw: ai.response, parsed, model: ai.model });
      res.json({ history_count: r.rows.length, ...parsed, raw: ai.response, model: ai.model });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── 6. Supplier Marketplace Integration ──────────────────────────────────
  router.post(
    '/supplier-match',
    authMiddleware,
    aiRateLimiter,
    [body('treatment_name').notEmpty(), body('region').optional().isString()],
    validate,
    async (req, res) => {
      try {
        const { treatment_name, region, quantity } = req.body;
        const local = await pool.query(
          `SELECT id, item_name, category, price, currency, seller_name, seller_location, availability
           FROM marketplace_items WHERE item_name ILIKE $1 LIMIT 25`,
          [`%${treatment_name}%`]
        );
        const prompt = `Match the requested treatment to local marketplace listings and recommend bulk-pricing strategies.

Treatment requested: ${treatment_name}
Region: ${region || 'unknown'}
Quantity: ${quantity || 'unknown'}

Local listings (${local.rows.length}):
${local.rows.map((x) => `- ${x.id}: ${x.item_name} | $${x.price} ${x.currency} | seller=${x.seller_name} (${x.seller_location}) | ${x.availability}`).join('\n') || 'no matches'}

Return STRICT JSON: {
  "matched_supplier_ids": [],
  "best_match_id": 0,
  "estimated_price_range_usd": "",
  "bulk_negotiation_strategy": "",
  "community_order_recommendation": "",
  "estimated_savings_pct": 0
}`;
        const ai = await queryAI(prompt);
        const parsed = parseAIJson(ai.response) || {};
        await persistAIResult({ endpoint: 'supplier-match', userId: req.userId, raw: ai.response, parsed, model: ai.model });
        res.json({ treatment_name, region, candidates: local.rows, ...parsed, raw: ai.response, model: ai.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 7. WhatsApp/SMS Webhook (Twilio shape) ───────────────────────────────
  // POST /whatsapp/webhook — anyone can hit; we accept text-only for now
  router.post(
    '/whatsapp/webhook',
    [body('Body').notEmpty(), body('From').optional().isString()],
    validate,
    async (req, res) => {
      try {
        const { Body, From } = req.body;
        const prompt = `A farmer sent the following text via WhatsApp. Provide a concise diagnosis (max 4 sentences) and one actionable next step. If image attached note it cannot be processed in this endpoint.

Message: "${Body}"
From: ${From || 'unknown'}`;
        const ai = await queryAI(prompt);
        await persistAIResult({ endpoint: 'whatsapp', userId: null, raw: ai.response, parsed: null, model: ai.model });

        // Twilio expects TwiML XML response by default, but JSON works for testing
        if ((req.headers['accept'] || '').includes('xml')) {
          res.setHeader('Content-Type', 'text/xml');
          return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${(ai.response || 'Service unavailable').replace(/[<>&]/g, '')}</Message></Response>`);
        }
        res.json({ from: From, response: ai.response, model: ai.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 8. Field Scout Reports — image-based (uses base CRUD + analyze image) ──
  router.get('/field-scout', authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const [data, count] = await Promise.all([
        pool.query('SELECT * FROM field_scout_reports WHERE user_id = $1 ORDER BY reported_at DESC LIMIT $2 OFFSET $3', [req.userId, limit, offset]),
        pool.query('SELECT COUNT(*) FROM field_scout_reports WHERE user_id = $1', [req.userId]),
      ]);
      res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post(
    '/field-scout',
    authMiddleware,
    [body('field_name').notEmpty(), body('crop_name').notEmpty()],
    validate,
    async (req, res) => {
      try {
        const { field_name, crop_name, image_url, ai_detection, confidence_pct, urgency } = req.body;
        const r = await pool.query(
          `INSERT INTO field_scout_reports (user_id, field_name, crop_name, image_url, ai_detection, confidence_pct, urgency)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [req.userId, field_name, crop_name, image_url || null, ai_detection ? JSON.stringify(ai_detection) : null, confidence_pct || null, urgency || null]
        );
        res.status(201).json(r.rows[0]);
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 9. Predict Yield ───────────────────────────────────────────────────────
  router.post(
    '/predict-yield',
    authMiddleware,
    aiRateLimiter,
    [body('crop_name').notEmpty(), body('field_name').notEmpty()],
    validate,
    async (req, res) => {
      try {
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_key_here') {
          return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured' });
        }
        const { crop_name, field_name, region, planted_at, soil, weather_summary, target_harvest_at } = req.body;
        const prompt = `Estimate the expected yield for the given field using the supplied agronomic context. Account for soil, weather, and historical norms for the region.

Crop: ${crop_name}
Field: ${field_name}
Region: ${region || 'unknown'}
Planted at: ${planted_at || 'unknown'}
Target harvest at: ${target_harvest_at || 'unknown'}
Soil: ${soil ? JSON.stringify(soil) : 'not provided'}
Weather summary: ${weather_summary || 'not provided'}

Return STRICT JSON: {
  "predicted_yield_per_ha": 0,
  "yield_unit": "kg|bushels|tons",
  "confidence_pct": 0,
  "low_estimate": 0,
  "high_estimate": 0,
  "key_drivers": [],
  "risks": [],
  "recommended_actions_to_lift_yield": []
}`;
        const r = await queryAI(prompt);
        const parsed = parseAIJson(r.response) || {};
        await persistAIResult({ endpoint: 'predict-yield', userId: req.userId, raw: r.response, parsed, model: r.model });
        res.json({ crop_name, field_name, region, ...parsed, raw: r.response, model: r.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 10. Optimize Harvest Timing ────────────────────────────────────────────
  router.post(
    '/optimize-harvest-timing',
    authMiddleware,
    aiRateLimiter,
    [body('crop_name').notEmpty(), body('field_name').notEmpty()],
    validate,
    async (req, res) => {
      try {
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_key_here') {
          return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured' });
        }
        const { crop_name, field_name, region, planted_at, current_stage, weather_forecast, market_price_outlook } = req.body;
        const prompt = `Recommend the optimal harvest window balancing yield maturity, weather risk, and market price.

Crop: ${crop_name}
Field: ${field_name}
Region: ${region || 'unknown'}
Planted: ${planted_at || 'unknown'}
Current stage: ${current_stage || 'unknown'}
Forecast: ${weather_forecast ? JSON.stringify(weather_forecast) : 'not provided'}
Market outlook: ${market_price_outlook || 'not provided'}

Return STRICT JSON: {
  "optimal_harvest_window": { "start": "", "end": "" },
  "early_harvest_tradeoffs": "",
  "late_harvest_tradeoffs": "",
  "weather_risk_window": "",
  "market_price_signal": "",
  "actions_before_harvest": [],
  "expected_yield_loss_if_delayed_pct": 0
}`;
        const r = await queryAI(prompt);
        const parsed = parseAIJson(r.response) || {};
        await persistAIResult({ endpoint: 'optimize-harvest-timing', userId: req.userId, raw: r.response, parsed, model: r.model });
        res.json({ crop_name, field_name, ...parsed, raw: r.response, model: r.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── 11. Recommend IPM Strategy ─────────────────────────────────────────────
  router.post(
    '/recommend-ipm-strategy',
    authMiddleware,
    aiRateLimiter,
    [body('crop_name').notEmpty()],
    validate,
    async (req, res) => {
      try {
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_key_here') {
          return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured' });
        }
        const { crop_name, region, observed_pests, observed_diseases, prior_treatments, organic_only } = req.body;
        const prompt = `Design an integrated pest management (IPM) strategy combining cultural, biological, mechanical, and (only when needed) chemical controls.

Crop: ${crop_name}
Region: ${region || 'unknown'}
Observed pests: ${observed_pests || 'none'}
Observed diseases: ${observed_diseases || 'none'}
Prior treatments: ${prior_treatments || 'none'}
Organic-only: ${organic_only ? 'yes' : 'no'}

Return STRICT JSON: {
  "cultural_controls": [],
  "biological_controls": [],
  "mechanical_controls": [],
  "chemical_controls_last_resort": [],
  "monitoring_plan": [],
  "thresholds_for_action": [],
  "expected_efficacy_pct": 0,
  "estimated_cost_per_ha_usd": 0,
  "rationale": ""
}`;
        const r = await queryAI(prompt);
        const parsed = parseAIJson(r.response) || {};
        await persistAIResult({ endpoint: 'recommend-ipm-strategy', userId: req.userId, raw: r.response, parsed, model: r.model });
        res.json({ crop_name, region, ...parsed, raw: r.response, model: r.model });
      } catch (err) { res.status(500).json({ error: err.message }); }
    }
  );

  // ── GET /api/ai-advanced/results — paginated AI audit log ────────────────
  router.get('/results', authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const filters = ['user_id = $1']; const params = [req.userId];
      if (req.query.endpoint) { params.push(req.query.endpoint); filters.push(`endpoint = $${params.length}`); }
      const where = 'WHERE ' + filters.join(' AND ');
      params.push(limit); params.push(offset);
      const data = await pool.query(`SELECT * FROM ai_results ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
      const count = await pool.query(`SELECT COUNT(*) FROM ai_results ${where}`, params.slice(0, params.length - 2));
      res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}

module.exports = makeRouter;
