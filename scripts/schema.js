#!/usr/bin/env node
'use strict';

const TYPES = Object.freeze({
  WORLD_FACT: 'world-fact',
  BELIEF: 'belief',
  OBSERVATION: 'observation',
  EXPERIENCE: 'experience',
});

const FRESHNESS = Object.freeze({
  STABLE: 'stable',
  STRENGTHENING: 'strengthening',
  WEAKENING: 'weakening',
  STALE: 'stale',
  CONTRADICTED: 'contradicted',
});

const DEFAULT_THRESHOLDS = Object.freeze({
  promotion_confidence: 0.85,
  promotion_sources: 5,
  stale_days: 90,
  consolidate_touches: 5,
  top_beliefs_n: 10,
});

const BELIEF_MARKERS = [
  /\bprefer(?:s|red|ence)?\b/i,
  /\bprobably\b/i,
  /\bI think\b/i,
  /\bseems? (?:like|to)\b/i,
  /\bbetter (?:to|than|if)\b/i,
];

const DECISION_MARKERS = [
  /\b(?:we|I) (?:decided|chose|picked|went with|choose)\b/i,
  /\bgoing with\b/i,
  /\bdecision[: ]/i,
  /\bchose\s+\S+\s+over\b/i,
];

const EXPERIENCE_MARKERS = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b(?:on|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
  /\bmet (?:with|today|yesterday)\b/i,
  /\bcalled\s+\S+\s+about\b/i,
];

const ENTITY_MARKERS = [
  /\b(?:is|works as|lives in|leads|runs|owns)\b/i,
  /\bbased in\b/i,
];

function detectType(text) {
  const t = (text || '').trim();
  if (!t) return TYPES.WORLD_FACT;

  for (const re of EXPERIENCE_MARKERS) if (re.test(t)) return TYPES.EXPERIENCE;
  for (const re of DECISION_MARKERS) if (re.test(t)) return TYPES.WORLD_FACT;
  for (const re of ENTITY_MARKERS) if (re.test(t)) return TYPES.OBSERVATION;
  for (const re of BELIEF_MARKERS) if (re.test(t)) return TYPES.BELIEF;

  return TYPES.WORLD_FACT;
}

const VALID_TYPES = new Set(Object.values(TYPES));
const VALID_FRESHNESS = new Set(Object.values(FRESHNESS));

function validateFrontmatter(meta) {
  const errors = [];
  if (!meta || typeof meta !== 'object') {
    return { valid: false, errors: ['frontmatter must be an object'] };
  }

  if (!meta.type) {
    errors.push('missing required field: type');
  } else if (!VALID_TYPES.has(meta.type)) {
    errors.push(`invalid type: "${meta.type}" (allowed: ${[...VALID_TYPES].join(', ')})`);
  }

  if (meta.freshness !== undefined && !VALID_FRESHNESS.has(meta.freshness)) {
    errors.push(`invalid freshness: "${meta.freshness}" (allowed: ${[...VALID_FRESHNESS].join(', ')})`);
  }

  if (meta.confidence !== undefined) {
    const c = Number(meta.confidence);
    if (Number.isNaN(c) || c < 0 || c > 1) {
      errors.push(`invalid confidence: "${meta.confidence}" (must be 0.0–1.0)`);
    }
  }

  if (meta.type === TYPES.BELIEF && meta.confidence === undefined) {
    errors.push('confidence is required for type=belief');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  TYPES,
  FRESHNESS,
  DEFAULT_THRESHOLDS,
  detectType,
  validateFrontmatter,
};
