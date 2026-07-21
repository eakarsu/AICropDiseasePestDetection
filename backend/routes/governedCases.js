'use strict';

const express = require('express');
const { normalizeObservation, observationFingerprint, assertTransition } = require('../governance/casePolicy');

module.exports = function governedCases({ pool, authMiddleware }) {
  const router = express.Router();
  router.use(authMiddleware);

  async function membership(client, tenantId, userId) {
    const result = await client.query(
      'SELECT role FROM cg_tenant_memberships WHERE tenant_id = $1 AND user_id = $2 AND active = true',
      [tenantId, userId]
    );
    if (!result.rows[0]) { const error = new Error('tenant membership required'); error.status = 403; throw error; }
    return result.rows[0].role;
  }

  router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
      const tenantId = String(req.body.tenantId || '');
      const idempotencyKey = String(req.get('Idempotency-Key') || '');
      if (!tenantId || !idempotencyKey || idempotencyKey.length > 200) return res.status(422).json({ error: 'tenantId and Idempotency-Key are required' });
      const observation = normalizeObservation(req.body.observation);
      await client.query('BEGIN');
      await membership(client, tenantId, req.userId);
      const inserted = await client.query(
        `INSERT INTO cg_cases (tenant_id, field_id, crop, species, region, season, captured_at, symptoms, source_type, observation_fingerprint, idempotency_key, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
         RETURNING *`,
        [tenantId, observation.fieldId, observation.crop, observation.species, observation.region, observation.season, observation.capturedAt, observation.symptoms, observation.sourceType, observationFingerprint(observation), idempotencyKey, req.userId]
      );
      for (const evidence of observation.evidence) {
        await client.query(
          `INSERT INTO cg_evidence (case_id, kind, uri, sha256) VALUES ($1,$2,$3,$4) ON CONFLICT (case_id, sha256) DO NOTHING`,
          [inserted.rows[0].id, evidence.kind, evidence.uri, evidence.sha256]
        );
      }
      await client.query(`INSERT INTO cg_audit_events (tenant_id, case_id, actor_id, action, after_state) VALUES ($1,$2,$3,'case.ingested',$4)`, [tenantId, inserted.rows[0].id, req.userId, inserted.rows[0]]);
      await client.query('COMMIT');
      res.status(201).json(inserted.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(error.status || 422).json({ error: error.message });
    } finally { client.release(); }
  });

  router.post('/:id/transition', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT * FROM cg_cases WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!current.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'case not found' }); }
      const record = current.rows[0];
      const role = await membership(client, record.tenant_id, req.userId);
      assertTransition(record.status, req.body.to, role, { ...req.body.context, approverId: req.userId });
      const updated = await client.query('UPDATE cg_cases SET status=$1, version=version+1, updated_at=NOW() WHERE id=$2 AND version=$3 RETURNING *', [req.body.to, record.id, req.body.expectedVersion]);
      if (!updated.rows[0]) { const error = new Error('version conflict'); error.status = 409; throw error; }
      await client.query('INSERT INTO cg_audit_events (tenant_id, case_id, actor_id, action, before_state, after_state) VALUES ($1,$2,$3,$4,$5,$6)', [record.tenant_id, record.id, req.userId, `case.${req.body.to}`, record, updated.rows[0]]);
      if (req.body.to === 'dispatched') await client.query(`INSERT INTO cg_outbox (tenant_id, topic, aggregate_id, payload) VALUES ($1,'crop.work_order.dispatched',$2,$3)`, [record.tenant_id, record.id, req.body.context.workOrder]);
      await client.query('COMMIT');
      res.json(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(error.status || 422).json({ error: error.message });
    } finally { client.release(); }
  });
  return router;
};
