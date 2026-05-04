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

module.exports = {
  TYPES,
  FRESHNESS,
  DEFAULT_THRESHOLDS,
};
