'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const promote = require('../scripts/promote');
const { TYPES, FRESHNESS, DEFAULT_THRESHOLDS } = require('../scripts/schema');

function freshBrain() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-promote-'));
  fs.mkdirSync(path.join(root, 'Notes'), { recursive: true });
  return root;
}

function writeBelief(brain, slug, fm) {
  const fmStr = Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(
    path.join(brain, 'Notes', `${slug}.md`),
    `---\n${fmStr}\n---\n\n# ${slug}\n\nbody\n`,
    'utf-8',
  );
}

function writePersona(brain, body) {
  fs.writeFileSync(path.join(brain, 'Persona.md'), body, 'utf-8');
}

test('findBeliefs returns only type=belief notes', () => {
  const brain = freshBrain();
  writeBelief(brain, 'pref-async', { type: TYPES.BELIEF, confidence: 0.9, sources_count: 6, freshness: FRESHNESS.STABLE });
  writeBelief(brain, 'fact-postgres', { type: TYPES.WORLD_FACT, confidence: 1.0, sources_count: 3, freshness: FRESHNESS.STABLE });

  const beliefs = promote.findBeliefs(brain);
  assert.equal(beliefs.length, 1);
  assert.equal(beliefs[0].path, 'Notes/pref-async.md');
  assert.equal(beliefs[0].confidence, 0.9);
  assert.equal(beliefs[0].sources_count, 6);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('findBeliefs returns empty when Notes/ missing', () => {
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-promote-empty-'));
  assert.deepEqual(promote.findBeliefs(brain), []);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('filterCandidates rejects below-threshold confidence', () => {
  const beliefs = [
    { path: 'a', confidence: 0.9, sources_count: 6, freshness: FRESHNESS.STABLE },
    { path: 'b', confidence: 0.7, sources_count: 6, freshness: FRESHNESS.STABLE },
  ];
  const out = promote.filterCandidates(beliefs, DEFAULT_THRESHOLDS);
  assert.deepEqual(out.map(o => o.path), ['a']);
});

test('filterCandidates rejects below-threshold sources_count', () => {
  const beliefs = [
    { path: 'a', confidence: 0.9, sources_count: 6, freshness: FRESHNESS.STABLE },
    { path: 'b', confidence: 0.9, sources_count: 2, freshness: FRESHNESS.STABLE },
  ];
  const out = promote.filterCandidates(beliefs, DEFAULT_THRESHOLDS);
  assert.deepEqual(out.map(o => o.path), ['a']);
});

test('filterCandidates rejects weakening/stale/contradicted freshness', () => {
  const beliefs = [
    { path: 'stable', confidence: 0.9, sources_count: 6, freshness: FRESHNESS.STABLE },
    { path: 'strengthening', confidence: 0.9, sources_count: 6, freshness: FRESHNESS.STRENGTHENING },
    { path: 'weakening', confidence: 0.9, sources_count: 6, freshness: FRESHNESS.WEAKENING },
    { path: 'stale', confidence: 0.9, sources_count: 6, freshness: FRESHNESS.STALE },
    { path: 'contradicted', confidence: 0.9, sources_count: 6, freshness: FRESHNESS.CONTRADICTED },
  ];
  const out = promote.filterCandidates(beliefs, DEFAULT_THRESHOLDS);
  assert.deepEqual(out.map(o => o.path).sort(), ['stable', 'strengthening']);
});

test('score: higher sources at same confidence ranks higher', () => {
  const a = { confidence: 0.9, sources_count: 5 };
  const b = { confidence: 0.9, sources_count: 50 };
  assert.ok(promote.score(b) > promote.score(a));
});

test('score: higher confidence at same sources ranks higher', () => {
  const a = { confidence: 0.85, sources_count: 5 };
  const b = { confidence: 0.99, sources_count: 5 };
  assert.ok(promote.score(b) > promote.score(a));
});

test('rankAndTake sorts desc and slices to n', () => {
  const beliefs = [
    { path: 'low', confidence: 0.86, sources_count: 5 },
    { path: 'high', confidence: 0.95, sources_count: 20 },
    { path: 'mid', confidence: 0.9, sources_count: 8 },
  ];
  const out = promote.rankAndTake(beliefs, 2);
  assert.deepEqual(out.map(o => o.path), ['high', 'mid']);
});

test('readCurrentTopBeliefs extracts wikilinks from Persona ## Top Beliefs', () => {
  const brain = freshBrain();
  writePersona(
    brain,
    `# Persona\n\n## Mission\n- name: x\n\n## Top Beliefs\n\n1. [[Notes/a.md]] — conf=0.9\n2. [[Notes/b.md]] — conf=0.87\n\n## Evidence Log\n- something\n`,
  );
  const out = promote.readCurrentTopBeliefs(path.join(brain, 'Persona.md'));
  assert.deepEqual(out, ['Notes/a.md', 'Notes/b.md']);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('readCurrentTopBeliefs returns empty if section missing', () => {
  const brain = freshBrain();
  writePersona(brain, `# Persona\n\n## Mission\n- name: x\n`);
  assert.deepEqual(promote.readCurrentTopBeliefs(path.join(brain, 'Persona.md')), []);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('readCurrentTopBeliefs returns empty if Persona file missing', () => {
  const brain = freshBrain();
  assert.deepEqual(promote.readCurrentTopBeliefs(path.join(brain, 'Persona.md')), []);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('computeDeltas: promoted = in top not in current; demoted = in current not in top', () => {
  const top = [{ path: 'a' }, { path: 'b' }, { path: 'c' }];
  const current = ['b', 'c', 'd'];
  const { promoted, demoted } = promote.computeDeltas(current, top);
  assert.deepEqual(promoted.map(p => p.path), ['a']);
  assert.deepEqual(demoted, ['d']);
});

test('writeTopBeliefs replaces existing ## Top Beliefs section in place', () => {
  const brain = freshBrain();
  writePersona(
    brain,
    `# Persona\n\n## Mission\n- name: x\n\n## Top Beliefs\n\n_old content_\n\n## Evidence Log\n- something\n`,
  );
  const personaPath = path.join(brain, 'Persona.md');
  promote.writeTopBeliefs(personaPath, [
    { path: 'Notes/a.md', confidence: 0.9, sources_count: 6, freshness: 'stable' },
  ]);
  const text = fs.readFileSync(personaPath, 'utf-8');
  assert.match(text, /## Top Beliefs/);
  assert.match(text, /\[\[Notes\/a\.md\]\]/);
  assert.doesNotMatch(text, /_old content_/);
  assert.match(text, /## Evidence Log/);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('writeTopBeliefs renders empty placeholder when no beliefs', () => {
  const brain = freshBrain();
  writePersona(brain, `# Persona\n\n## Top Beliefs\n\n_old_\n\n## Evidence Log\n- x\n`);
  const personaPath = path.join(brain, 'Persona.md');
  promote.writeTopBeliefs(personaPath, []);
  const text = fs.readFileSync(personaPath, 'utf-8');
  assert.match(text, /None yet/);
  assert.match(text, /## Evidence Log/);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('run: end-to-end on a brain with mixed beliefs', () => {
  const brain = freshBrain();
  writeBelief(brain, 'strong', { type: TYPES.BELIEF, confidence: 0.95, sources_count: 10, freshness: FRESHNESS.STABLE });
  writeBelief(brain, 'medium', { type: TYPES.BELIEF, confidence: 0.86, sources_count: 6, freshness: FRESHNESS.STRENGTHENING });
  writeBelief(brain, 'weak', { type: TYPES.BELIEF, confidence: 0.5, sources_count: 6, freshness: FRESHNESS.STABLE });
  writeBelief(brain, 'stale', { type: TYPES.BELIEF, confidence: 0.9, sources_count: 6, freshness: FRESHNESS.STALE });
  writePersona(brain, `# Persona\n\n## Top Beliefs\n\n_empty_\n`);

  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-promote-state-'));
  const logPath = path.join(stateDir, 'evolution.log');

  const result = promote.run({ brain, logPath });

  assert.equal(result.beliefsCount, 4);
  assert.equal(result.candidatesCount, 2);
  assert.equal(result.top.length, 2);
  assert.equal(result.top[0].path, 'Notes/strong.md');
  assert.equal(result.promoted.length, 2);
  assert.equal(result.demoted.length, 0);

  const personaText = fs.readFileSync(path.join(brain, 'Persona.md'), 'utf-8');
  assert.match(personaText, /\[\[Notes\/strong\.md\]\]/);
  assert.match(personaText, /\[\[Notes\/medium\.md\]\]/);

  const logText = fs.readFileSync(logPath, 'utf-8');
  assert.match(logText, /PROMOTE\s+Notes\/strong\.md/);
  assert.match(logText, /PROMOTE\s+Notes\/medium\.md/);

  fs.rmSync(brain, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

test('run: dry-run does not modify Persona or log', () => {
  const brain = freshBrain();
  writeBelief(brain, 'strong', { type: TYPES.BELIEF, confidence: 0.95, sources_count: 10, freshness: FRESHNESS.STABLE });
  const personaBefore = `# Persona\n\n## Top Beliefs\n\n_intact_\n`;
  writePersona(brain, personaBefore);

  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-promote-dry-'));
  const logPath = path.join(stateDir, 'evolution.log');

  const result = promote.run({ brain, dryRun: true, logPath });

  assert.equal(result.top.length, 1);
  const personaAfter = fs.readFileSync(path.join(brain, 'Persona.md'), 'utf-8');
  assert.equal(personaAfter, personaBefore);
  assert.equal(fs.existsSync(logPath), false);

  fs.rmSync(brain, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});

test('run: auto_promote=false skips writes even without dry-run', () => {
  const brain = freshBrain();
  writeBelief(brain, 'strong', { type: TYPES.BELIEF, confidence: 0.95, sources_count: 10, freshness: FRESHNESS.STABLE });
  const personaBefore = `# Persona\n\n## Top Beliefs\n\n_intact_\n`;
  writePersona(brain, personaBefore);

  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-promote-noauto-'));
  const logPath = path.join(stateDir, 'evolution.log');

  const result = promote.run({
    brain,
    logPath,
    configOverride: {
      thresholds: DEFAULT_THRESHOLDS,
      auto_promote: false,
    },
  });

  assert.equal(result.top.length, 1);
  assert.equal(fs.readFileSync(path.join(brain, 'Persona.md'), 'utf-8'), personaBefore);
  assert.equal(fs.existsSync(logPath), false);

  fs.rmSync(brain, { recursive: true, force: true });
  fs.rmSync(stateDir, { recursive: true, force: true });
});
