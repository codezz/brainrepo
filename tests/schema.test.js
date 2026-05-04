'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const schema = require('../scripts/schema');

test('TYPES exposes the four epistemic types', () => {
  assert.deepEqual(
    new Set(Object.values(schema.TYPES)),
    new Set(['world-fact', 'belief', 'observation', 'experience']),
  );
});

test('FRESHNESS exposes the five states', () => {
  assert.deepEqual(
    new Set(Object.values(schema.FRESHNESS)),
    new Set(['stable', 'strengthening', 'weakening', 'stale', 'contradicted']),
  );
});

test('DEFAULT_THRESHOLDS contains promotion knobs with sane values', () => {
  const t = schema.DEFAULT_THRESHOLDS;
  assert.equal(t.promotion_confidence, 0.85);
  assert.equal(t.promotion_sources, 5);
  assert.equal(t.stale_days, 90);
  assert.equal(t.consolidate_touches, 5);
  assert.equal(t.top_beliefs_n, 10);
});
