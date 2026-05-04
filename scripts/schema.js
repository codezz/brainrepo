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

module.exports = {
  TYPES,
  FRESHNESS,
  DEFAULT_THRESHOLDS,
  detectType,
};
