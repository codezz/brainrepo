'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const schema = require('../scripts/schema');

function freshBrain() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-validate-'));
  for (const sub of ['Notes', 'People', 'Areas', 'Journal', 'Projects', 'Inbox']) {
    fs.mkdirSync(path.join(root, sub), { recursive: true });
  }
  return root;
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
}

// --- inferExpectedSchema ---

test('inferExpectedSchema: Notes/<x>.md → world-fact defaults', () => {
  const brain = freshBrain();
  const expected = schema.inferExpectedSchema(path.join(brain, 'Notes', 'foo.md'), { brainRoot: brain });
  assert.equal(expected.kind, 'l2-typed');
  assert.equal(expected.requiredFields.includes('type'), true);
  assert.equal(expected.requiredFields.includes('freshness'), true);
  assert.equal(expected.defaultType, schema.TYPES.WORLD_FACT);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('inferExpectedSchema: People/<x>.md → observation', () => {
  const brain = freshBrain();
  const expected = schema.inferExpectedSchema(path.join(brain, 'People', 'maria.md'), { brainRoot: brain });
  assert.equal(expected.kind, 'l2-typed');
  assert.equal(expected.defaultType, schema.TYPES.OBSERVATION);
  assert.ok(expected.requiredFields.includes('last_consolidated'));
  fs.rmSync(brain, { recursive: true, force: true });
});

test('inferExpectedSchema: Projects/<x>/<x>.md → observation', () => {
  const brain = freshBrain();
  const projDir = path.join(brain, 'Projects', 'dollie');
  fs.mkdirSync(projDir, { recursive: true });
  const expected = schema.inferExpectedSchema(path.join(projDir, 'dollie.md'), { brainRoot: brain });
  assert.equal(expected.kind, 'l2-typed');
  assert.equal(expected.defaultType, schema.TYPES.OBSERVATION);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('inferExpectedSchema: Projects/<x>/decisions/foo.md → world-fact', () => {
  const brain = freshBrain();
  const expected = schema.inferExpectedSchema(
    path.join(brain, 'Projects', 'dollie', 'decisions', 'foo.md'),
    { brainRoot: brain },
  );
  assert.equal(expected.kind, 'l2-typed');
  assert.equal(expected.defaultType, schema.TYPES.WORLD_FACT);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('inferExpectedSchema: Journal/<date>.md → experience', () => {
  const brain = freshBrain();
  const expected = schema.inferExpectedSchema(path.join(brain, 'Journal', '2026-05-04.md'), { brainRoot: brain });
  assert.equal(expected.kind, 'l2-typed');
  assert.equal(expected.defaultType, schema.TYPES.EXPERIENCE);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('inferExpectedSchema: Persona.md → persona-sections', () => {
  const brain = freshBrain();
  const expected = schema.inferExpectedSchema(path.join(brain, 'Persona.md'), { brainRoot: brain });
  assert.equal(expected.kind, 'persona-sections');
  assert.deepEqual(expected.requiredSections, ['Mission', 'Directives', 'Top Beliefs', 'Evidence Log']);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('inferExpectedSchema: Inbox/<x>.md → passthrough', () => {
  const brain = freshBrain();
  const expected = schema.inferExpectedSchema(path.join(brain, 'Inbox', 'random.md'), { brainRoot: brain });
  assert.equal(expected.kind, 'passthrough');
  fs.rmSync(brain, { recursive: true, force: true });
});

test('inferExpectedSchema: file outside brain → passthrough', () => {
  const brain = freshBrain();
  const expected = schema.inferExpectedSchema('/tmp/random.md', { brainRoot: brain });
  assert.equal(expected.kind, 'passthrough');
  fs.rmSync(brain, { recursive: true, force: true });
});

// --- validateAndUpgrade ---

test('validateAndUpgrade: adds missing schema fields to Notes file', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Notes', 'something.md');
  writeFile(file, '---\ncreated: 2026-05-04\n---\n\n# Something\n\nbody\n');

  const result = schema.validateAndUpgrade(file, { brainRoot: brain, today: '2026-05-04' });

  assert.equal(result.changed, true);
  assert.ok(result.addedFields.includes('type'));
  assert.ok(result.addedFields.includes('freshness'));
  assert.ok(result.addedFields.includes('sources_count'));

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^type: world-fact$/m);
  assert.match(after, /^freshness: stable$/m);
  assert.match(after, /^sources_count: 1$/m);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: idempotent — no changes if already valid', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Notes', 'foo.md');
  writeFile(
    file,
    '---\ncreated: 2026-05-04\ntype: world-fact\nfreshness: stable\nsources_count: 1\nevidence: []\n---\n\n# foo\n',
  );

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, false);
  assert.deepEqual(result.addedFields, []);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: belief without confidence gets default + warning', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Notes', 'pref.md');
  writeFile(file, '---\ntype: belief\nfreshness: stable\nsources_count: 1\n---\n\n# pref\n');

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, true);
  assert.ok(result.addedFields.includes('confidence'));
  assert.ok(result.warnings.some(w => w.toLowerCase().includes('confidence')));

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^confidence: 0\.5$/m);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: People file gets observation defaults', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'People', 'maria.md');
  writeFile(file, '---\ncreated: 2026-05-04\n---\n\n# Maria\n');

  const result = schema.validateAndUpgrade(file, { brainRoot: brain, today: '2026-05-04' });
  assert.equal(result.changed, true);

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^type: observation$/m);
  assert.match(after, /^last_consolidated: 2026-05-04$/m);
  assert.match(after, /^sources_count: 1$/m);
  assert.match(after, /^freshness: stable$/m);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: Journal date file gets experience type', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Journal', '2026-05-04.md');
  writeFile(file, '# 2026-05-04\n\nstuff\n');

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, true);
  assert.ok(result.addedFields.includes('type'));

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^type: experience$/m);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: Persona missing section gets placeholder appended', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Persona.md');
  writeFile(
    file,
    '---\ntags: [persona]\n---\n\n# Persona\n\n## Mission\n- name: Gabi\n\n## Directives\n- some\n\n## Evidence Log\n- entry\n',
  );

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, true);
  assert.deepEqual(result.addedSections.sort(), ['Top Beliefs']);

  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^## Top Beliefs\b/m);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: Persona with all sections present is no-op', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Persona.md');
  writeFile(
    file,
    '# Persona\n\n## Mission\n- x\n\n## Directives\n- y\n\n## Top Beliefs\n- a\n\n## Evidence Log\n- b\n',
  );

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, false);
  assert.deepEqual(result.addedSections, []);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: Persona with legacy Disposition section is preserved (no-op)', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Persona.md');
  writeFile(
    file,
    '# Persona\n\n## Mission\n- x\n\n## Directives\n- y\n\n## Disposition\n- terseness: 5\n\n## Top Beliefs\n- a\n\n## Evidence Log\n- b\n',
  );

  // Legacy Disposition section should not be removed by upgrade — user keeps what they wrote.
  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, false);
  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^## Disposition\b/m);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: file outside brain is no-op', () => {
  const brain = freshBrain();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'remember-outside-'));
  const file = path.join(out, 'random.md');
  writeFile(file, '# random\n');

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, false);

  fs.rmSync(brain, { recursive: true, force: true });
  fs.rmSync(out, { recursive: true, force: true });
});

test('validateAndUpgrade: Inbox file is passthrough', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Inbox', 'random.md');
  writeFile(file, '# random\n');

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, false);

  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: missing file returns changed=false, no throw', () => {
  const brain = freshBrain();
  const result = schema.validateAndUpgrade(path.join(brain, 'Notes', 'nope.md'), { brainRoot: brain });
  assert.equal(result.changed, false);
  fs.rmSync(brain, { recursive: true, force: true });
});

test('validateAndUpgrade: file without frontmatter gets full block', () => {
  const brain = freshBrain();
  const file = path.join(brain, 'Notes', 'bare.md');
  writeFile(file, '# Bare note\n\nbody only\n');

  const result = schema.validateAndUpgrade(file, { brainRoot: brain });
  assert.equal(result.changed, true);
  const after = fs.readFileSync(file, 'utf-8');
  assert.match(after, /^---\n/);
  assert.match(after, /^type: world-fact$/m);

  fs.rmSync(brain, { recursive: true, force: true });
});
