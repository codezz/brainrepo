'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const config = require('../scripts/config');
const { DEFAULT_THRESHOLDS } = require('../scripts/schema');

function freshTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'remember-cfg-'));
}

test('loadEvolutionConfig returns defaults when no override file', () => {
  const dir = freshTmpDir();

  const out = config.loadEvolutionConfig({ stateDir: dir });
  assert.deepEqual(out.thresholds, DEFAULT_THRESHOLDS);
  assert.equal(out.auto_promote, true);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadEvolutionConfig merges user file over defaults', () => {
  const dir = freshTmpDir();
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify({
      thresholds: { promotion_confidence: 0.9 },
      auto_promote: false,
    }),
  );

  const out = config.loadEvolutionConfig({ stateDir: dir });
  assert.equal(out.thresholds.promotion_confidence, 0.9);
  assert.equal(out.thresholds.promotion_sources, DEFAULT_THRESHOLDS.promotion_sources);
  assert.equal(out.auto_promote, false);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('loadEvolutionConfig tolerates malformed JSON (returns defaults)', () => {
  const dir = freshTmpDir();
  fs.writeFileSync(path.join(dir, 'config.json'), '{not json');

  const out = config.loadEvolutionConfig({ stateDir: dir });
  assert.deepEqual(out.thresholds, DEFAULT_THRESHOLDS);

  fs.rmSync(dir, { recursive: true, force: true });
});
