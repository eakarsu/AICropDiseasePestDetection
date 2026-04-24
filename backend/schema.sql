-- Drop existing tables
DROP TABLE IF EXISTS community_reports CASCADE;
DROP TABLE IF EXISTS treatment_recommendations CASCADE;
DROP TABLE IF EXISTS pest_alerts CASCADE;
DROP TABLE IF EXISTS disease_history CASCADE;
DROP TABLE IF EXISTS expert_consultations CASCADE;
DROP TABLE IF EXISTS marketplace_items CASCADE;
DROP TABLE IF EXISTS farm_management CASCADE;
DROP TABLE IF EXISTS crop_calendar CASCADE;
DROP TABLE IF EXISTS soil_analyses CASCADE;
DROP TABLE IF EXISTS weather_risks CASCADE;
DROP TABLE IF EXISTS crop_health CASCADE;
DROP TABLE IF EXISTS pest_identifications CASCADE;
DROP TABLE IF EXISTS disease_detections CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS analytics_data CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  farm_name VARCHAR(255),
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1. Disease Detections
CREATE TABLE disease_detections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  crop_name VARCHAR(100) NOT NULL,
  disease_name VARCHAR(200) NOT NULL,
  confidence DECIMAL(5,2),
  severity VARCHAR(50),
  symptoms TEXT,
  affected_area VARCHAR(100),
  image_url TEXT,
  ai_diagnosis TEXT,
  status VARCHAR(50) DEFAULT 'detected',
  detected_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Pest Identifications
CREATE TABLE pest_identifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  crop_name VARCHAR(100) NOT NULL,
  pest_name VARCHAR(200) NOT NULL,
  pest_type VARCHAR(100),
  confidence DECIMAL(5,2),
  damage_level VARCHAR(50),
  description TEXT,
  recommended_action TEXT,
  image_url TEXT,
  ai_analysis TEXT,
  status VARCHAR(50) DEFAULT 'identified',
  identified_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crop Health Monitoring
CREATE TABLE crop_health (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  crop_name VARCHAR(100) NOT NULL,
  field_name VARCHAR(100),
  health_score INTEGER,
  growth_stage VARCHAR(100),
  ndvi_value DECIMAL(5,3),
  chlorophyll_level VARCHAR(50),
  water_stress VARCHAR(50),
  notes TEXT,
  ai_assessment TEXT,
  monitored_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Treatment Recommendations
CREATE TABLE treatment_recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  disease_or_pest VARCHAR(200) NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  treatment_type VARCHAR(100),
  treatment_name VARCHAR(200),
  dosage VARCHAR(200),
  application_method TEXT,
  frequency VARCHAR(100),
  precautions TEXT,
  organic_alternative TEXT,
  effectiveness_rating INTEGER,
  ai_recommendation TEXT,
  status VARCHAR(50) DEFAULT 'recommended',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Weather Risk Assessment
CREATE TABLE weather_risks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  location VARCHAR(200) NOT NULL,
  risk_type VARCHAR(100),
  risk_level VARCHAR(50),
  temperature DECIMAL(5,2),
  humidity DECIMAL(5,2),
  rainfall DECIMAL(8,2),
  wind_speed DECIMAL(6,2),
  forecast_summary TEXT,
  disease_risk_factors TEXT,
  ai_risk_analysis TEXT,
  assessed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Soil Analysis
CREATE TABLE soil_analyses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  field_name VARCHAR(100) NOT NULL,
  soil_type VARCHAR(100),
  ph_level DECIMAL(4,2),
  nitrogen_level DECIMAL(8,2),
  phosphorus_level DECIMAL(8,2),
  potassium_level DECIMAL(8,2),
  organic_matter DECIMAL(5,2),
  moisture_content DECIMAL(5,2),
  recommendations TEXT,
  ai_analysis TEXT,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Crop Calendar
CREATE TABLE crop_calendar (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  crop_name VARCHAR(100) NOT NULL,
  activity VARCHAR(200) NOT NULL,
  scheduled_date DATE,
  season VARCHAR(50),
  priority VARCHAR(50),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'planned',
  ai_suggestion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Pest Alerts
CREATE TABLE pest_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  alert_title VARCHAR(200) NOT NULL,
  pest_name VARCHAR(200),
  region VARCHAR(200),
  severity VARCHAR(50),
  affected_crops TEXT,
  description TEXT,
  prevention_tips TEXT,
  ai_alert_analysis TEXT,
  is_active BOOLEAN DEFAULT true,
  alert_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Disease History
CREATE TABLE disease_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  crop_name VARCHAR(100) NOT NULL,
  disease_name VARCHAR(200) NOT NULL,
  occurrence_date DATE,
  resolution_date DATE,
  treatment_used TEXT,
  outcome VARCHAR(100),
  crop_loss_percentage DECIMAL(5,2),
  lessons_learned TEXT,
  ai_pattern_analysis TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Community Reports
CREATE TABLE community_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  reporter_name VARCHAR(200),
  report_type VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200),
  crop_affected VARCHAR(100),
  severity VARCHAR(50),
  image_url TEXT,
  verified BOOLEAN DEFAULT false,
  ai_verification TEXT,
  reported_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 11. Expert Consultations
CREATE TABLE expert_consultations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  expert_name VARCHAR(200),
  specialization VARCHAR(200),
  question TEXT NOT NULL,
  crop_name VARCHAR(100),
  response TEXT,
  consultation_type VARCHAR(100),
  rating INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  ai_preliminary_response TEXT,
  consulted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 12. Marketplace Items
CREATE TABLE marketplace_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  item_name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  price DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'USD',
  seller_name VARCHAR(200),
  seller_location VARCHAR(200),
  availability VARCHAR(50) DEFAULT 'in_stock',
  rating DECIMAL(3,1),
  ai_product_review TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. Farm Management
CREATE TABLE farm_management (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  farm_name VARCHAR(200) NOT NULL,
  field_name VARCHAR(100),
  crop_name VARCHAR(100),
  area_size DECIMAL(10,2),
  area_unit VARCHAR(20) DEFAULT 'acres',
  planting_date DATE,
  expected_harvest DATE,
  irrigation_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  ai_management_tips TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 14. Knowledge Base
CREATE TABLE knowledge_base (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  category VARCHAR(100),
  content TEXT,
  crop_type VARCHAR(100),
  disease_or_pest VARCHAR(200),
  region VARCHAR(200),
  difficulty_level VARCHAR(50),
  tags TEXT,
  views INTEGER DEFAULT 0,
  ai_enhanced_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. Analytics Data
CREATE TABLE analytics_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  metric_name VARCHAR(200) NOT NULL,
  metric_value DECIMAL(15,2),
  metric_unit VARCHAR(50),
  category VARCHAR(100),
  period VARCHAR(50),
  crop_name VARCHAR(100),
  comparison_value DECIMAL(15,2),
  trend VARCHAR(50),
  ai_insight TEXT,
  recorded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
