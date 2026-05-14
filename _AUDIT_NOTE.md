# Audit Apply Notes — AICropDiseasePestDetection

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_02.md` (lines 605-625).

The audit classifies this project as **skeleton** with "0 routes, 0 AI
endpoints." Inspection contradicts this: `backend/server.js` defines 9+ HTTP
endpoints and `aiAdvanced.js` adds another 12+ AI endpoints (image-analyze,
treatment-efficacy/insights, field-scout, weather-trigger, etc.). The audit
metadata appears to be stale.

Per apply-pass policy (substantive AI integration → backlog-only) this pass
is **backlog-only**.

## Original audit recommendations

### Missing non-AI features (audit)
- Crop / field management.
- Image upload pipeline.
- Disease/pest detection results.
- Treatment recommendations.
- Weather integration.
- Farm analytics.

(Inspection shows crop-management, image upload, treatment-recommendations,
weather-risks tables and routes already exist.)

### Custom feature suggestions
- Multi-modal crop health assessment (drone + sensor + weather).
- Farmer decision support.
- Supply-chain optimization.
- Integrated pest management automation.

## Implemented in this pass

None. Backlog-only because the project already has substantive AI integration
that the audit did not capture, and adding new endpoints risks duplication.

## Backlog (prioritized)

### Mechanical, low-risk
1. Verify the existing endpoint list against audit-suggested gaps; add any
   genuinely missing endpoints (e.g., `/api/ai/predict-yield`,
   `/api/ai/optimize-harvest-timing`).
2. Stateless `/api/ai/recommend-ipm-strategy` — integrated pest-management
   recommendation.

### Needs product decision
- Drone imagery ingestion pipeline (storage, format).
- Sensor integration schema (which sensors, which protocols).

### Needs credentials / external SDK
- Weather APIs (NOAA, OpenWeatherMap).
- Satellite / drone imagery providers.
- Buyer/market data feeds for supply-chain optimization.

### Too risky / large refactor
- Real ML models for image-based disease detection (the current LLM-based
  approach is a placeholder; replacing with a CV model is a separate effort).

## Apply pass 3 (frontend)

LEFT-AS-IS. `frontend/src/pages/AIAdvanced.jsx` already drives every AI tool
exposed by `backend/aiAdvanced.js` (`seasonal-risk`, `cross-farm-benchmark`,
`fertilizer-optimize`, `weather-trigger`, `treatment-efficacy/insights`,
`supplier-match`) plus the GET `/results` history pane. `frontend/src/api.js`
adds `Authorization: Bearer ${localStorage.getItem('token')}` and surfaces
`error.response.data.error` so the 503-no-key path is shown to the user.
No FE changes needed.

## Apply pass 4 (mechanical backlog)

LEFT-AS-IS. All three mechanical backlog items (`predict-yield`,
`optimize-harvest-timing`, `recommend-ipm-strategy`) are already implemented
in `backend/aiAdvanced.js` (each with the `OPENROUTER_API_KEY`-missing 503
guard) and surfaced in `frontend/src/pages/AIAdvanced.jsx` via the TOOLS
array. `node --check backend/aiAdvanced.js` re-verified syntax. Remaining
backlog is either NEEDS-PRODUCT-DECISION (drone/sensor pipelines),
NEEDS-CREDS (weather/satellite/buyer feeds), or TOO-RISKY (real CV models).
No code changes required this pass.
