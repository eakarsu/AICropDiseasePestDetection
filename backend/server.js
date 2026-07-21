const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
let helmet;
try { helmet = require('helmet'); } catch (_) { helmet = null; }
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('./db');
const { queryAI, parseAIJson } = require('./openrouter');
const { aiRateLimiter, generalLimiter } = require('./rateLimiter');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

// Helmet security headers
if (helmet) app.use(helmet({ contentSecurityPolicy: false }));

// CORS — env-driven allow list
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(generalLimiter);

// Multer — images only, max 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Validation helper
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// ── Allowed column names per table (prevents SQL injection in dynamic queries) ──
const ALLOWED_COLUMNS = {
  disease_detections: ['crop_name','disease_name','symptoms','severity','location','field_name','notes','image_url','status','treatment_applied','user_id'],
  pest_identifications: ['crop_name','pest_name','pest_type','damage_level','description','location','field_name','notes','image_url','status','user_id'],
  crop_health: ['crop_name','field_name','health_score','growth_stage','ndvi_value','chlorophyll_level','water_stress','notes','assessment_date','user_id'],
  treatment_recommendations: ['disease_or_pest','crop_name','treatment_name','application_rate','timing','safety_precautions','organic_alternative','cost_estimate','effectiveness_rating','notes','user_id'],
  weather_risks: ['location','temperature','humidity','rainfall','risk_type','risk_level','disease_risk','pest_risk','notes','recorded_at','user_id'],
  soil_analyses: ['field_name','soil_type','ph_level','nitrogen_level','phosphorus_level','potassium_level','organic_matter','texture','moisture','notes','sample_date','user_id'],
  crop_calendar: ['crop_name','activity','season','scheduled_date','actual_date','status','notes','field_name','user_id'],
  pest_alerts: ['alert_title','pest_name','region','severity','affected_crops','is_active','description','source','expiry_date'],
  disease_history: ['crop_name','disease_name','occurrence_date','treatment_used','outcome','crop_loss_percentage','field_name','notes','season','user_id'],
  community_reports: ['report_type','title','description','location','crop_affected','severity','status','verified','image_url','user_id'],
  expert_consultations: ['question','crop_name','specialization','status','expert_response','consultation_date','user_id'],
  marketplace_items: ['item_name','category','description','price','unit','supplier','in_stock','image_url','user_id'],
  farm_management: ['farm_name','field_name','crop_name','area_size','area_unit','irrigation_type','status','notes','planting_date','expected_harvest','user_id'],
  knowledge_base: ['title','category','content','crop_type','disease_or_pest','region','difficulty_level','tags','ai_enhanced_content'],
  analytics_data: ['metric_name','metric_value','metric_unit','category','period','crop_name','comparison_value','trend','ai_insight','recorded_at','user_id'],
};

function sanitizeData(tableName, data) {
  const allowed = ALLOWED_COLUMNS[tableName];
  if (!allowed) return data; // unknown table — pass through
  const clean = {};
  for (const key of Object.keys(data)) {
    if (allowed.includes(key)) {
      clean[key] = data[key];
    }
  }
  return clean;
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, farm_name: user.farm_name, location: user.location } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, farm_name, location } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, full_name, farm_name, location) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, farm_name, location',
      [email, hashed, full_name, farm_name, location]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, farm_name, location FROM users WHERE id = $1', [req.userId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/harvest-disease-window', authMiddleware, (req, res) => {
  const body = req.body || {};
  const humidity = Number(body.humidity_pct || 0);
  const rain = Number(body.rain_forecast_mm || 0);
  const days = Number(body.days_to_harvest || 0);
  const pressure = Math.min(100, Math.round(humidity * 0.45 + rain * 1.4 + Math.max(0, 14 - days) * 2));
  res.json({
    crop: body.crop || 'crop',
    field: body.field || 'field',
    risk_score: pressure,
    window: pressure >= 70 ? 'harvest early or treat immediately' : pressure >= 40 ? 'tight scouting window' : 'standard harvest window',
    actions: [
      pressure >= 70 ? 'Scout within 24 hours and protect harvestable blocks.' : 'Maintain normal scouting cadence.',
      rain > 10 ? 'Avoid spray timing before forecast rain.' : 'Spray timing is not rain-blocked.',
      days <= 7 ? 'Check pre-harvest interval before any treatment.' : 'Treatment interval remains feasible.',
    ],
  });
});

// ==================== GENERIC CRUD HELPER ====================
function createCRUD(tableName, displayName, aiPromptGenerator) {
  const router = express.Router();

  // GET all (paginated)
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const [data, count] = await Promise.all([
        pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
        pool.query(`SELECT COUNT(*) FROM ${tableName}`),
      ]);
      res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET by id
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: `${displayName} not found` });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create — sanitize input
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const raw = { ...req.body, user_id: req.userId };
      const data = sanitizeData(tableName, raw);
      const keys = Object.keys(data);
      if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const result = await pool.query(
        `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT update — sanitize input
  router.put('/:id', authMiddleware, async (req, res) => {
    try {
      const raw = { ...req.body };
      delete raw.id;
      delete raw.created_at;
      const data = sanitizeData(tableName, raw);
      const keys = Object.keys(data);
      if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
      const values = Object.values(data);
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
      const result = await pool.query(
        `UPDATE ${tableName} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: `${displayName} not found` });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: `${displayName} not found` });
      res.json({ message: `${displayName} deleted successfully` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI analyze
  if (aiPromptGenerator) {
    router.post('/ai-analyze', authMiddleware, aiRateLimiter, async (req, res) => {
      try {
        const prompt = aiPromptGenerator(req.body);
        const aiResult = await queryAI(prompt);
        res.json(aiResult);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  return router;
}

// ==================== FEATURE ROUTES ====================

// 1. Disease Detections
app.use('/api/disease-detections', createCRUD('disease_detections', 'Disease Detection', (data) =>
  `Analyze this crop disease detection: Crop: ${data.crop_name || 'Unknown'}, Disease: ${data.disease_name || 'Unknown'}, Symptoms: ${data.symptoms || 'Not specified'}, Severity: ${data.severity || 'Unknown'}. Provide detailed diagnosis, treatment recommendations, and prevention strategies.`
));

// 2. Pest Identifications
app.use('/api/pest-identifications', createCRUD('pest_identifications', 'Pest Identification', (data) =>
  `Identify and analyze this pest: Crop: ${data.crop_name || 'Unknown'}, Pest: ${data.pest_name || 'Unknown'}, Type: ${data.pest_type || 'Unknown'}, Damage Level: ${data.damage_level || 'Unknown'}, Description: ${data.description || 'Not provided'}. Provide identification confirmation, damage assessment, and integrated pest management recommendations.`
));

// 3. Crop Health
app.use('/api/crop-health', createCRUD('crop_health', 'Crop Health', (data) =>
  `Assess crop health: Crop: ${data.crop_name || 'Unknown'}, Field: ${data.field_name || 'Unknown'}, Health Score: ${data.health_score || 'N/A'}/100, Growth Stage: ${data.growth_stage || 'Unknown'}, NDVI: ${data.ndvi_value || 'N/A'}, Chlorophyll: ${data.chlorophyll_level || 'Unknown'}, Water Stress: ${data.water_stress || 'Unknown'}. Provide detailed health assessment and management recommendations.`
));

// 4. Treatment Recommendations
app.use('/api/treatments', createCRUD('treatment_recommendations', 'Treatment', (data) =>
  `Recommend treatment: Disease/Pest: ${data.disease_or_pest || 'Unknown'}, Crop: ${data.crop_name || 'Unknown'}, Current Treatment: ${data.treatment_name || 'None'}. Provide comprehensive treatment plan including organic alternatives, application timing, safety precautions, and resistance management.`
));

// 5. Weather Risks
app.use('/api/weather-risks', createCRUD('weather_risks', 'Weather Risk', (data) =>
  `Analyze weather-based disease risk: Location: ${data.location || 'Unknown'}, Temperature: ${data.temperature || 'N/A'}°C, Humidity: ${data.humidity || 'N/A'}%, Rainfall: ${data.rainfall || 'N/A'}mm, Risk Type: ${data.risk_type || 'General'}. Assess disease and pest risks and provide preventive recommendations.`
));

// 6. Soil Analysis
app.use('/api/soil-analyses', createCRUD('soil_analyses', 'Soil Analysis', (data) =>
  `Analyze soil test results: Field: ${data.field_name || 'Unknown'}, Soil Type: ${data.soil_type || 'Unknown'}, pH: ${data.ph_level || 'N/A'}, Nitrogen: ${data.nitrogen_level || 'N/A'} ppm, Phosphorus: ${data.phosphorus_level || 'N/A'} ppm, Potassium: ${data.potassium_level || 'N/A'} ppm, Organic Matter: ${data.organic_matter || 'N/A'}%. Provide soil health assessment and amendment recommendations.`
));

// 7. Crop Calendar
app.use('/api/crop-calendar', createCRUD('crop_calendar', 'Calendar Event', (data) =>
  `Suggest optimal timing: Crop: ${data.crop_name || 'Unknown'}, Activity: ${data.activity || 'Unknown'}, Season: ${data.season || 'Unknown'}, Scheduled Date: ${data.scheduled_date || 'TBD'}. Provide timing advice, preparation checklist, and best practices for this activity.`
));

// 8. Pest Alerts
app.use('/api/pest-alerts', createCRUD('pest_alerts', 'Pest Alert', (data) =>
  `Analyze pest alert: Alert: ${data.alert_title || 'Unknown'}, Pest: ${data.pest_name || 'Unknown'}, Region: ${data.region || 'Unknown'}, Severity: ${data.severity || 'Unknown'}, Affected Crops: ${data.affected_crops || 'Various'}. Provide risk assessment, prevention strategies, and response recommendations.`
));

// 9. Disease History (paginated via generic CRUD)
app.use('/api/disease-history', createCRUD('disease_history', 'Disease History', (data) =>
  `Analyze disease history pattern: Crop: ${data.crop_name || 'Unknown'}, Disease: ${data.disease_name || 'Unknown'}, Occurrence: ${data.occurrence_date || 'Unknown'}, Treatment Used: ${data.treatment_used || 'None'}, Outcome: ${data.outcome || 'Unknown'}, Crop Loss: ${data.crop_loss_percentage || 'N/A'}%. Provide pattern analysis, prevention recommendations, and lessons for future seasons.`
));

// 10. Community Reports (paginated via generic CRUD)
app.use('/api/community-reports', createCRUD('community_reports', 'Community Report', (data) =>
  `Verify and analyze community report: Type: ${data.report_type || 'Unknown'}, Title: ${data.title || 'Unknown'}, Description: ${data.description || 'Not provided'}, Location: ${data.location || 'Unknown'}, Crop: ${data.crop_affected || 'Unknown'}, Severity: ${data.severity || 'Unknown'}. Assess credibility, provide context, and suggest community response.`
));

// 11. Expert Consultations
app.use('/api/expert-consultations', createCRUD('expert_consultations', 'Consultation', (data) =>
  `Provide expert consultation: Question: ${data.question || 'No question provided'}, Crop: ${data.crop_name || 'General'}, Specialization: ${data.specialization || 'General Agriculture'}. Provide a comprehensive expert-level response with practical recommendations.`
));

// 12. Marketplace
app.use('/api/marketplace', createCRUD('marketplace_items', 'Marketplace Item', (data) =>
  `Review agricultural product: Product: ${data.item_name || 'Unknown'}, Category: ${data.category || 'Unknown'}, Description: ${data.description || 'Not provided'}, Price: $${data.price || 'N/A'}. Provide product review, usage recommendations, alternatives, and value assessment for farmers.`
));

// 13. Farm Management
app.use('/api/farm-management', createCRUD('farm_management', 'Farm Record', (data) =>
  `Provide farm management advice: Farm: ${data.farm_name || 'Unknown'}, Field: ${data.field_name || 'Unknown'}, Crop: ${data.crop_name || 'Unknown'}, Area: ${data.area_size || 'N/A'} ${data.area_unit || 'acres'}, Irrigation: ${data.irrigation_type || 'Unknown'}, Status: ${data.status || 'Unknown'}. Provide management tips, expected timeline, and optimization recommendations.`
));

// 14. Knowledge Base (paginated, no auth required for reading)
const kbRouter = express.Router();
kbRouter.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [data, count] = await Promise.all([
      pool.query('SELECT * FROM knowledge_base ORDER BY views DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM knowledge_base'),
    ]);
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
kbRouter.get('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE knowledge_base SET views = views + 1 WHERE id = $1', [req.params.id]);
    const result = await pool.query('SELECT * FROM knowledge_base WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
kbRouter.post('/', authMiddleware, async (req, res) => {
  try {
    const data = sanitizeData('knowledge_base', req.body);
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `INSERT INTO knowledge_base (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
kbRouter.put('/:id', authMiddleware, async (req, res) => {
  try {
    const raw = { ...req.body };
    delete raw.id;
    delete raw.created_at;
    const data = sanitizeData('knowledge_base', raw);
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const result = await pool.query(
      `UPDATE knowledge_base SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
kbRouter.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM knowledge_base WHERE id = $1', [req.params.id]);
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
kbRouter.post('/ai-analyze', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const prompt = `Enhance this knowledge base article: Title: ${req.body.title || 'Unknown'}, Category: ${req.body.category || 'General'}, Content: ${req.body.content || 'Not provided'}. Provide enhanced, comprehensive content with practical advice for farmers.`;
    const aiResult = await queryAI(prompt);
    res.json(aiResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.use('/api/knowledge-base', kbRouter);

// 15. Analytics
app.use('/api/analytics', createCRUD('analytics_data', 'Analytics', (data) =>
  `Analyze agricultural metric: Metric: ${data.metric_name || 'Unknown'}, Value: ${data.metric_value || 'N/A'} ${data.metric_unit || ''}, Category: ${data.category || 'General'}, Crop: ${data.crop_name || 'All'}, Trend: ${data.trend || 'Unknown'}, Previous Value: ${data.comparison_value || 'N/A'}. Provide insight, benchmarking context, and improvement recommendations.`
));

// Dashboard stats
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const [diseases, pests, health, alerts, farms] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM disease_detections'),
      pool.query('SELECT COUNT(*) as count FROM pest_identifications'),
      pool.query('SELECT AVG(health_score) as avg_score FROM crop_health'),
      pool.query('SELECT COUNT(*) as count FROM pest_alerts WHERE is_active = true'),
      pool.query('SELECT COUNT(*) as count FROM farm_management'),
    ]);
    res.json({
      totalDiseases: parseInt(diseases.rows[0].count),
      totalPests: parseInt(pests.rows[0].count),
      avgHealthScore: Math.round(parseFloat(health.rows[0].avg_score) || 0),
      activeAlerts: parseInt(alerts.rows[0].count),
      totalFarms: parseInt(farms.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// General AI Chat
app.post('/api/ai/chat', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    const result = await queryAI(message, context);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/crop-diseases/analyze-image — vision-based disease detection ──
app.post('/api/crop-diseases/analyze-image', authMiddleware, aiRateLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_openrouter_key_here') {
      return res.status(503).json({ error: 'OpenRouter API key not configured.' });
    }

    const base64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype || 'image/jpeg';
    const cropHint = req.body.crop_type || 'unknown crop';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Crop Disease & Pest Detection',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'system',
            content: 'You are an expert agronomist and plant pathologist with deep knowledge of crop diseases, pest management, and sustainable agriculture practices.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Analyze this crop image for diseases and pest damage. The crop is: ${cropHint}.

Please provide:
1. Disease/Pest Identification (name, type, confidence level)
2. Symptom Description (what you observe in the image)
3. Severity Assessment (mild / moderate / severe)
4. Affected Area Estimate (% of plant/field visible)
5. Recommended Treatment (immediate and long-term)
6. Organic Alternatives
7. Prevention Strategies
8. Urgency Level (Low / Medium / High / Critical)`,
              },
            ],
          },
        ],
        temperature: 0.5,
        max_tokens: 1500,
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message || 'Vision analysis failed' });

    res.json({
      analysis: data.choices?.[0]?.message?.content || 'No analysis generated',
      model: data.model,
      usage: data.usage || null,
      crop_type: cropHint,
      image_size_bytes: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/integrated-pest-management ────────────────────────────────
app.post(
  '/api/ai/integrated-pest-management',
  authMiddleware,
  aiRateLimiter,
  [
    body('pest_type').notEmpty().withMessage('pest_type is required'),
    body('crop_type').notEmpty().withMessage('crop_type is required'),
    body('infestation_level')
      .isIn(['low', 'medium', 'high', 'severe'])
      .withMessage('infestation_level must be low, medium, high, or severe'),
    body('organic_only').optional().isBoolean().withMessage('organic_only must be boolean'),
  ],
  validate,
  async (req, res) => {
    try {
      const { pest_type, crop_type, infestation_level, organic_only } = req.body;
      const prompt = `
Create a comprehensive Integrated Pest Management (IPM) strategy for the following situation:

Pest Type: ${pest_type}
Crop: ${crop_type}
Infestation Level: ${infestation_level}
Organic Only: ${organic_only ? 'YES — only organic/biological methods' : 'No restriction'}

Provide a full IPM strategy covering:

1. Biological Controls
   - Natural predators / parasitoids
   - Microbial pesticides (if applicable)
   - Habitat manipulation

2. Cultural Controls
   - Crop rotation recommendations
   - Planting date adjustments
   - Resistant varieties
   - Sanitation practices

3. Chemical Controls${organic_only ? ' (organic/approved only)' : ''}
   - Recommended products with active ingredients
   - Application rates and timing
   - Pre-harvest interval
   - Safety precautions and PPE

4. Monitoring Protocol
   - Scouting frequency and method
   - Economic threshold (when to act)
   - Record keeping

5. Economic Impact Assessment
   - Expected crop loss without treatment
   - Cost-benefit of each control method
   - Break-even analysis

6. 30-Day Action Plan (week by week)`.trim();

      const result = await queryAI(prompt);
      res.json({ pest_type, crop_type, infestation_level, organic_only: !!organic_only, ipm_strategy: result.response, model: result.model });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/ai/harvest-timing ────────────────────────────────────────────
app.post(
  '/api/ai/harvest-timing',
  authMiddleware,
  aiRateLimiter,
  [
    body('crop_type').notEmpty().withMessage('crop_type is required'),
    body('plant_date').notEmpty().withMessage('plant_date is required'),
    body('current_conditions').notEmpty().withMessage('current_conditions is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { crop_type, plant_date, current_conditions } = req.body;
      const prompt = `
Determine the optimal harvest timing for the following crop:

Crop Type: ${crop_type}
Plant Date: ${plant_date}
Current Field Conditions: ${JSON.stringify(current_conditions)}

Please provide:

1. Optimal Harvest Window
   - Earliest harvest date (with rationale)
   - Peak harvest date (maximum quality/yield)
   - Latest acceptable harvest date

2. Harvest Readiness Indicators
   - Visual cues to look for
   - Measurable parameters (Brix, moisture, color, firmness)
   - Field tests to confirm readiness

3. Disease Pressure Impact
   - Current disease risks that may affect timing
   - Quality risks if delayed
   - Post-harvest disease risk assessment

4. Weather Considerations
   - Ideal weather window for harvest
   - Risks of harvesting in current conditions
   - How to adjust if rain is forecast

5. Yield Forecast at Different Harvest Times
   - Early harvest: estimated yield %
   - Optimal harvest: estimated yield %
   - Late harvest: estimated yield %

6. Post-Harvest Handling
   - Storage recommendations
   - Conditioning requirements
   - Shelf life expectation`.trim();

      const result = await queryAI(prompt);
      res.json({ crop_type, plant_date, harvest_timing: result.response, model: result.model });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/ai/yield-forecast ────────────────────────────────────────────
app.post(
  '/api/ai/yield-forecast',
  authMiddleware,
  aiRateLimiter,
  [
    body('field_data').notEmpty().withMessage('field_data is required'),
    body('historical_yields').notEmpty().withMessage('historical_yields is required'),
    body('current_conditions').notEmpty().withMessage('current_conditions is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { field_data, historical_yields, current_conditions } = req.body;
      const prompt = `
Generate a crop yield forecast based on the following data:

Field Data: ${JSON.stringify(field_data)}
Historical Yields: ${JSON.stringify(historical_yields)}
Current Growing Conditions: ${JSON.stringify(current_conditions)}

Provide a comprehensive yield forecast including:

1. Yield Forecast
   - Base yield estimate (most likely scenario)
   - Optimistic scenario (upper bound)
   - Pessimistic scenario (lower bound)
   - Confidence interval (e.g., ± X% with 80% confidence)

2. Key Yield Drivers
   - Positive factors boosting yield
   - Risk factors reducing yield
   - Relative weight of each factor

3. Comparison to Historical Average
   - Year-over-year comparison
   - How this season compares to the last 3-5 years

4. Risk Scenarios
   - Impact of disease outbreak (yield loss %)
   - Impact of extreme weather event
   - Impact of pest pressure

5. Agronomic Recommendations to Improve Yield
   - Top 3 actions to take now
   - Expected yield improvement from each action

6. Financial Projection
   - Estimated gross revenue at forecast yield
   - Break-even yield requirement
   - Margin of safety`.trim();

      const result = await queryAI(prompt);
      res.json({ yield_forecast: result.response, model: result.model, field_data, current_conditions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Mount AI advanced routes ─────────────────────────────────────────────────
const makeAIAdvancedRouter = require('./aiAdvanced');
app.use('/api/ai-advanced', makeAIAdvancedRouter({ authMiddleware }));

app.use('/api/ai', require('./multimodalHealth'));


app.use('/api/ai', require('./decisionSupport'));

app.use('/api/ai', require('./supplyChainCoord'));

app.use('/api/ai', require('./ipmAutomation'));
// Governed field workflow. Generated gap endpoints are intentionally not mounted.
app.use('/api/governed-cases', require('./routes/governedCases')({ pool, authMiddleware }));

// // === Custom Views (Field Analytics) ===
app.use('/api/custom-views', require('./routes/customViews'));

// // === Health ===
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'crop-disease-backend', ts: Date.now() }));

app.listen(PORT, () => {
  console.log(`CropGuard AI Backend running on port ${PORT}`);
});
