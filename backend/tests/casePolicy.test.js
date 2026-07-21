'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeObservation, observationFingerprint, assertTransition } = require('../governance/casePolicy');

const observation = { fieldId:'north-4', crop:'tomato', species:'Solanum lycopersicum', region:'US-NY', season:'2026-summer', capturedAt:'2026-07-01T12:00:00Z', symptoms:'concentric leaf lesions', sourceType:'field-app', evidence:[{kind:'image',uri:'s3://tenant/case/photo.jpg',sha256:'a'.repeat(64)}] };
test('normalizes a traceable observation deterministically', () => { assert.equal(normalizeObservation(observation).region, 'US-NY'); assert.equal(observationFingerprint(observation).length, 64); });
test('rejects missing evidence and future observations', () => { assert.throws(() => normalizeObservation({...observation,evidence:[]}), /evidence/); assert.throws(() => normalizeObservation({...observation,capturedAt:'2999-01-01T00:00:00Z'}), /past/); });
test('enforces expert evidence and independent approval', () => { assert.throws(() => assertTransition('assessed','expert_review','agronomist',{}), /requires/); assert.throws(() => assertTransition('expert_review','approved','agronomist',{approverId:7,recommenderId:7}), /independent/); assert.equal(assertTransition('expert_review','approved','agronomist',{approverId:8,recommenderId:7}), true); });
test('requires safety acceptance before dispatch', () => { assert.throws(() => assertTransition('approved','dispatched','operator',{workOrder:{id:'wo-1'}}), /safety/); assert.equal(assertTransition('approved','dispatched','operator',{workOrder:{id:'wo-1'},safetyConstraintsAccepted:true}), true); });
