'use strict';

const crypto = require('node:crypto');

const transitions = Object.freeze({
  ingested: ['assessed'],
  assessed: ['expert_review'],
  expert_review: ['approved', 'rejected'],
  approved: ['dispatched'],
  dispatched: ['completed', 'cancelled'],
  rejected: [], completed: [], cancelled: [],
});

const roles = Object.freeze({
  assessed: ['agronomist', 'operator'],
  expert_review: ['agronomist'],
  approved: ['agronomist'],
  rejected: ['agronomist'],
  dispatched: ['operator'],
  completed: ['operator'],
  cancelled: ['operator', 'agronomist'],
});

function requiredText(value, name, max = 200) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  if (value.trim().length > max) throw new Error(`${name} exceeds ${max} characters`);
  return value.trim();
}

function normalizeObservation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('observation is required');
  const capturedAt = new Date(input.capturedAt);
  if (Number.isNaN(capturedAt.getTime()) || capturedAt > new Date()) throw new Error('capturedAt must be a past ISO timestamp');
  const evidence = Array.isArray(input.evidence) ? input.evidence : [];
  if (evidence.length === 0) throw new Error('at least one evidence item is required');
  const normalizedEvidence = evidence.map((item) => ({
    kind: requiredText(item.kind, 'evidence.kind', 40),
    uri: requiredText(item.uri, 'evidence.uri', 1000),
    sha256: requiredText(item.sha256, 'evidence.sha256', 64).toLowerCase(),
  }));
  if (normalizedEvidence.some((item) => !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error('evidence.sha256 must be 64 hexadecimal characters');
  return {
    fieldId: requiredText(input.fieldId, 'fieldId'),
    crop: requiredText(input.crop, 'crop', 120),
    species: requiredText(input.species, 'species', 160),
    region: requiredText(input.region, 'region', 120),
    season: requiredText(input.season, 'season', 80),
    capturedAt: capturedAt.toISOString(),
    symptoms: requiredText(input.symptoms, 'symptoms', 4000),
    sourceType: requiredText(input.sourceType, 'sourceType', 40),
    evidence: normalizedEvidence,
  };
}

function observationFingerprint(observation) {
  return crypto.createHash('sha256').update(JSON.stringify(normalizeObservation(observation))).digest('hex');
}

function assertTransition(from, to, role, context = {}) {
  if (!(transitions[from] || []).includes(to)) throw new Error(`invalid transition: ${from} -> ${to}`);
  if (!(roles[to] || []).includes(role)) throw new Error(`role ${role} cannot transition to ${to}`);
  if (to === 'expert_review' && (!context.uncertainty || !context.ruleVersion || !context.sources?.length)) {
    throw new Error('expert review requires uncertainty, ruleVersion, and sources');
  }
  if (to === 'approved' && (!context.approverId || context.approverId === context.recommenderId)) {
    throw new Error('approval requires an independent agronomist');
  }
  if (to === 'dispatched' && (!context.workOrder || !context.safetyConstraintsAccepted)) {
    throw new Error('dispatch requires a work order and accepted safety constraints');
  }
  return true;
}

module.exports = { normalizeObservation, observationFingerprint, assertTransition, transitions };
