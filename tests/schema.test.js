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

test('detectType: explicit decisions are world-facts', () => {
  assert.equal(
    schema.detectType('We decided to use Postgres because of jsonb support.'),
    schema.TYPES.WORLD_FACT,
  );
  assert.equal(
    schema.detectType('Going with Next.js 16 over Remix.'),
    schema.TYPES.WORLD_FACT,
  );
});

test('detectType: stated preferences are beliefs', () => {
  assert.equal(
    schema.detectType('User prefers terse replies.'),
    schema.TYPES.BELIEF,
  );
  assert.equal(
    schema.detectType('Probably better to ship a smaller MVP first.'),
    schema.TYPES.BELIEF,
  );
});

test('detectType: dated meetings/journal entries are experiences', () => {
  assert.equal(
    schema.detectType('On 2026-04-12 we met with the client and discussed billing.'),
    schema.TYPES.EXPERIENCE,
  );
});

test('detectType: descriptions of an entity are observations', () => {
  assert.equal(
    schema.detectType('Maria is the lead designer on Impact3, lives in Berlin, prefers async comms.'),
    schema.TYPES.OBSERVATION,
  );
});

test('detectType: empty / unknown defaults to world-fact', () => {
  assert.equal(schema.detectType(''), schema.TYPES.WORLD_FACT);
  assert.equal(schema.detectType('   '), schema.TYPES.WORLD_FACT);
});
