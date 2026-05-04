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

test('validateFrontmatter: valid belief passes', () => {
  const result = schema.validateFrontmatter({
    type: 'belief',
    confidence: 0.7,
    freshness: 'stable',
    sources_count: 3,
    evidence: [{ source: 'journal/2026-05-04', quote: 'said it', date: '2026-05-04' }],
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateFrontmatter: belief missing confidence is invalid', () => {
  const result = schema.validateFrontmatter({
    type: 'belief',
    freshness: 'stable',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('confidence')));
});

test('validateFrontmatter: unknown type is invalid', () => {
  const result = schema.validateFrontmatter({ type: 'rumor' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('type')));
});

test('validateFrontmatter: invalid freshness is invalid', () => {
  const result = schema.validateFrontmatter({
    type: 'world-fact',
    freshness: 'rotten',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('freshness')));
});

test('validateFrontmatter: missing type is invalid', () => {
  const result = schema.validateFrontmatter({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('type')));
});

test('validateFrontmatter: confidence out of range is invalid', () => {
  const result = schema.validateFrontmatter({
    type: 'belief',
    confidence: 1.5,
    freshness: 'stable',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('confidence')));
});

test('validateFrontmatter: array input is rejected as not-an-object', () => {
  const result = schema.validateFrontmatter(['type']);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('object')));
});

test('validateFrontmatter: null input is rejected as not-an-object', () => {
  const result = schema.validateFrontmatter(null);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('object')));
});

test('validateFrontmatter: confidence=null on belief is rejected', () => {
  const result = schema.validateFrontmatter({
    type: 'belief',
    confidence: null,
    freshness: 'stable',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('confidence')));
});

test('validateFrontmatter: confidence boundary 0 and 1 are valid', () => {
  const lower = schema.validateFrontmatter({ type: 'belief', confidence: 0, freshness: 'stable' });
  assert.equal(lower.valid, true);
  const upper = schema.validateFrontmatter({ type: 'belief', confidence: 1, freshness: 'stable' });
  assert.equal(upper.valid, true);
});

test('validateFrontmatter: confidence below 0 is rejected', () => {
  const result = schema.validateFrontmatter({
    type: 'belief',
    confidence: -0.1,
    freshness: 'stable',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('confidence')));
});

test('detectType: decision markers beat belief markers when both appear', () => {
  // Both "I think" (belief) and "we decided" (decision) match.
  // detectType evaluates DECISION before BELIEF → world-fact wins.
  assert.equal(
    schema.detectType('I think we decided to use Postgres.'),
    schema.TYPES.WORLD_FACT,
  );
});

test('detectType: bare "is" no longer triggers observation', () => {
  // After tightening ENTITY_MARKERS, plain declarations like
  // "Postgres is faster" should NOT classify as observation.
  // It should fall through to the WORLD_FACT default.
  assert.equal(
    schema.detectType('Postgres is faster than MySQL.'),
    schema.TYPES.WORLD_FACT,
  );
});
