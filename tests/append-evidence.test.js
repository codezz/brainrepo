'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { appendEvidence, appendCounterEvidence, findSimilarBelief } = require('../scripts/append-evidence');

function tmpFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-evidence-'));
  const file = path.join(dir, 'note.md');
  fs.writeFileSync(file, content, 'utf-8');
  return { file, dir };
}

const baseFm = `---
created: 2026-05-04
updated: 2026-05-04
type: belief
confidence: 0.9
sources_count: 1
evidence:
  - source: Journal/2026-05-04.md
    quote: "first quote"
    date: 2026-05-04
counter_evidence: []
---

# Belief

body
`;

test('appendEvidence increments sources_count and appends evidence entry', () => {
  const { file, dir } = tmpFile(baseFm);

  const result = appendEvidence(file, {
    source: 'Journal/2026-05-05.md',
    quote: 'second quote',
    date: '2026-05-05',
  }, { today: '2026-05-05' });

  assert.equal(result.changed, true);
  assert.equal(result.newSourcesCount, 2);

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^sources_count: 2$/m);
  assert.match(after, /Journal\/2026-05-05\.md/);
  assert.match(after, /"second quote"/);
  assert.match(after, /^updated: 2026-05-05$/m);
  // Old evidence still there
  assert.match(after, /Journal\/2026-05-04\.md/);
  assert.match(after, /"first quote"/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendEvidence: counter_evidence section preserved', () => {
  const { file, dir } = tmpFile(baseFm);
  appendEvidence(file, { source: 'Journal/x.md', quote: 'q', date: '2026-05-05' });
  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^counter_evidence:/m);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendEvidence: refuses to add same source twice (idempotent on identical entry)', () => {
  const { file, dir } = tmpFile(baseFm);

  const r1 = appendEvidence(file, {
    source: 'Journal/2026-05-04.md',
    quote: 'first quote',
    date: '2026-05-04',
  });
  assert.equal(r1.changed, false);
  assert.match(r1.reason || '', /already/i);

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^sources_count: 1$/m);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendEvidence: missing sources_count gets initialized to 1 then incremented', () => {
  const fmWithoutSourcesCount = `---
created: 2026-05-04
updated: 2026-05-04
type: belief
confidence: 0.9
evidence: []
counter_evidence: []
---

body
`;
  const { file, dir } = tmpFile(fmWithoutSourcesCount);

  const result = appendEvidence(file, {
    source: 'Journal/2026-05-05.md',
    quote: 'first',
    date: '2026-05-05',
  });

  assert.equal(result.changed, true);
  assert.equal(result.newSourcesCount, 1);
  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^sources_count: 1$/m);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('findSimilarBelief: matches by exact slug', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-similar-'));
  fs.mkdirSync(path.join(dir, 'Notes'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'Notes', 'pref-async-comms.md'),
    `---\ntype: belief\n---\n\n# Prefer async comms\n`,
  );

  const match = findSimilarBelief(dir, 'pref-async-comms');
  assert.ok(match);
  assert.equal(path.basename(match), 'pref-async-comms.md');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('findSimilarBelief: returns null for no match', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-similar-empty-'));
  fs.mkdirSync(path.join(dir, 'Notes'), { recursive: true });

  const match = findSimilarBelief(dir, 'pref-something');
  assert.equal(match, null);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('findSimilarBelief: ignores type=world-fact files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-similar-types-'));
  fs.mkdirSync(path.join(dir, 'Notes'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'Notes', 'foo.md'),
    `---\ntype: world-fact\n---\n\n# foo\n`,
  );

  const match = findSimilarBelief(dir, 'foo', { typeFilter: 'belief' });
  assert.equal(match, null);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendCounterEvidence: appends to empty counter_evidence and does not bump sources_count', () => {
  const { file, dir } = tmpFile(baseFm);

  const result = appendCounterEvidence(file, {
    source: 'Journal/2026-05-05.md',
    quote: 'actually no',
    date: '2026-05-05',
  }, { today: '2026-05-05' });

  assert.equal(result.changed, true);
  assert.equal(result.evidenceCount, 1);
  assert.equal(result.counterCount, 1);

  const after = fs.readFileSync(file, 'utf-8');
  // sources_count untouched
  assert.match(after, /^sources_count: 1$/m);
  // counter entry appended
  assert.match(after, /counter_evidence:[\s\S]*Journal\/2026-05-05\.md/);
  assert.match(after, /"actually no"/);
  // updated bumped
  assert.match(after, /^updated: 2026-05-05$/m);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendCounterEvidence: flips freshness to contradicted when counter > evidence', () => {
  const fm = `---
created: 2026-05-04
updated: 2026-05-04
type: belief
confidence: 0.9
freshness: stable
sources_count: 1
evidence:
  - source: Journal/a.md
    quote: "for"
    date: 2026-05-04
counter_evidence:
  - source: Journal/b.md
    quote: "against1"
    date: 2026-05-05
---

body
`;
  const { file, dir } = tmpFile(fm);

  const r = appendCounterEvidence(file, {
    source: 'Journal/c.md',
    quote: 'against2',
    date: '2026-05-06',
  });
  assert.equal(r.changed, true);
  assert.equal(r.evidenceCount, 1);
  assert.equal(r.counterCount, 2);
  assert.equal(r.freshnessChanged, 'contradicted');

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^freshness: contradicted$/m);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendCounterEvidence: refuses duplicate source (idempotent)', () => {
  const fm = `---
created: 2026-05-04
updated: 2026-05-04
type: belief
confidence: 0.9
sources_count: 1
evidence: []
counter_evidence:
  - source: Journal/dup.md
    quote: "first"
    date: 2026-05-04
---

body
`;
  const { file, dir } = tmpFile(fm);

  const r = appendCounterEvidence(file, {
    source: 'Journal/dup.md',
    quote: 'first',
    date: '2026-05-04',
  });
  assert.equal(r.changed, false);
  assert.match(r.reason || '', /already/i);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('appendCounterEvidence: creates counter_evidence block if missing', () => {
  const fm = `---
created: 2026-05-04
updated: 2026-05-04
type: belief
confidence: 0.9
sources_count: 1
evidence:
  - source: Journal/a.md
    quote: "x"
    date: 2026-05-04
---

body
`;
  const { file, dir } = tmpFile(fm);

  const r = appendCounterEvidence(file, {
    source: 'Journal/b.md',
    quote: 'against',
    date: '2026-05-05',
  });
  assert.equal(r.changed, true);

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^counter_evidence:/m);
  assert.match(after, /Journal\/b\.md/);

  fs.rmSync(dir, { recursive: true, force: true });
});
