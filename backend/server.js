const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('./db');
const { queryAI } = require('./openrouter');

const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
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

// ==================== GENERIC CRUD HELPER ====================
function createCRUD(tableName, displayName, aiPromptGenerator) {
  const router = express.Router();

  // GET all
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
      res.json(result.rows);
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

  // POST create
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const data = { ...req.body, user_id: req.userId };
      const keys = Object.keys(data);
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

  // PUT update
  router.put('/:id', authMiddleware, async (req, res) => {
    try {
      const data = req.body;
      delete data.id;
      delete data.created_at;
      const keys = Object.keys(data);
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
    router.post('/ai-analyze', authMiddleware, async (req, res) => {
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

// 9. Disease History
app.use('/api/disease-history', createCRUD('disease_history', 'Disease History', (data) =>
  `Analyze disease history pattern: Crop: ${data.crop_name || 'Unknown'}, Disease: ${data.disease_name || 'Unknown'}, Occurrence: ${data.occurrence_date || 'Unknown'}, Treatment Used: ${data.treatment_used || 'None'}, Outcome: ${data.outcome || 'Unknown'}, Crop Loss: ${data.crop_loss_percentage || 'N/A'}%. Provide pattern analysis, prevention recommendations, and lessons for future seasons.`
));

// 10. Community Reports
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

// 14. Knowledge Base (no auth required for reading)
const kbRouter = express.Router();
kbRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM knowledge_base ORDER BY views DESC');
    res.json(result.rows);
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
    const data = req.body;
    const keys = Object.keys(data);
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
    const data = req.body;
    delete data.id;
    delete data.created_at;
    const keys = Object.keys(data);
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
kbRouter.post('/ai-analyze', authMiddleware, async (req, res) => {
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
app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  try {
    const { message, context } = req.body;
    const result = await queryAI(message, context);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌱 CropGuard AI Backend running on port ${PORT}`);
});
