'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  setupMcp,
  classifyBrainScope,
  buildEntry,
  brainEnvValue,
  resolveConfigPath,
  SERVER_NAME,
  NPM_PACKAGE,
} = require('../scripts/setup_mcp');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `remember-setup-mcp-${prefix}-`));
}

test('classifyBrainScope: brain inside cwd → project', () => {
  const cwd = '/Users/gabi/Projects/dollie';
  assert.equal(
    classifyBrainScope(path.join(cwd, 'project-brain'), cwd),
    'project',
  );
  assert.equal(classifyBrainScope(cwd, cwd), 'project');
});

test('classifyBrainScope: brain outside cwd → user', () => {
  const cwd = '/Users/gabi/Projects/dollie';
  assert.equal(
    classifyBrainScope('/Users/gabi/second-brain', cwd),
    'user',
  );
});

test('buildEntry: user scope writes absolute brain path', () => {
  const entry = buildEntry({ scope: 'user', brainPath: '/Users/gabi/second-brain' });
  assert.deepEqual(entry, {
    command: 'npx',
    args: ['-y', NPM_PACKAGE],
    env: { REMEMBER_BRAIN_PATH: '/Users/gabi/second-brain' },
  });
});

test('buildEntry: project scope writes ./relative path', () => {
  const root = '/tmp/some-project';
  const entry = buildEntry({
    scope: 'project',
    brainPath: path.join(root, 'project-brain'),
    projectRoot: root,
  });
  assert.equal(entry.env.REMEMBER_BRAIN_PATH, './project-brain');
});

test('buildEntry: project scope w/ brain outside falls back to absolute', () => {
  const root = '/tmp/some-project';
  const entry = buildEntry({
    scope: 'project',
    brainPath: '/Users/gabi/second-brain',
    projectRoot: root,
  });
  assert.equal(entry.env.REMEMBER_BRAIN_PATH, '/Users/gabi/second-brain');
});

test('brainEnvValue: nested subfolder in project root', () => {
  const root = '/tmp/proj';
  assert.equal(
    brainEnvValue({ scope: 'project', brainPath: path.join(root, 'docs/brain'), projectRoot: root }),
    './docs/brain',
  );
});

test('resolveConfigPath: user → ~/.claude.json, project → ./.mcp.json', () => {
  const userPath = resolveConfigPath({ scope: 'user' });
  assert.equal(userPath, path.join(os.homedir(), '.claude.json'));
  const projPath = resolveConfigPath({ scope: 'project', projectRoot: '/tmp/x' });
  assert.equal(projPath, path.join('/tmp/x', '.mcp.json'));
});

test('setupMcp: creates new user-level config when none exists', () => {
  const dir = tmpDir('create-user');
  const configPath = path.join(dir, '.claude.json');

  const result = setupMcp({
    brainPath: '/Users/gabi/second-brain',
    scope: 'user',
    configPath,
  });

  assert.equal(result.action, 'created');
  assert.equal(result.scope, 'user');
  assert.equal(result.configPath, configPath);

  const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert.deepEqual(written.mcpServers[SERVER_NAME], {
    command: 'npx',
    args: ['-y', NPM_PACKAGE],
    env: { REMEMBER_BRAIN_PATH: '/Users/gabi/second-brain' },
  });

  fs.rmSync(dir, { recursive: true, force: true });
});

test('setupMcp: merges into existing config preserving other mcpServers', () => {
  const dir = tmpDir('merge-existing');
  const configPath = path.join(dir, '.claude.json');
  const initial = {
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@mcp/filesystem'], env: {} },
    },
    other_setting: 'preserved',
  };
  fs.writeFileSync(configPath, JSON.stringify(initial, null, 2));

  const result = setupMcp({
    brainPath: '/Users/gabi/second-brain',
    scope: 'user',
    configPath,
  });

  assert.equal(result.action, 'added');

  const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  // remember server added
  assert.ok(written.mcpServers[SERVER_NAME]);
  // filesystem server preserved
  assert.deepEqual(written.mcpServers.filesystem, initial.mcpServers.filesystem);
  // unrelated keys preserved
  assert.equal(written.other_setting, 'preserved');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('setupMcp: idempotent — re-run with same args is no-change', () => {
  const dir = tmpDir('idempotent');
  const configPath = path.join(dir, '.claude.json');

  const r1 = setupMcp({
    brainPath: '/Users/gabi/second-brain',
    scope: 'user',
    configPath,
  });
  assert.equal(r1.action, 'created');

  const mtime1 = fs.statSync(configPath).mtimeMs;

  // Sleep a tiny bit to ensure mtime would change if we wrote again.
  const start = Date.now();
  while (Date.now() - start < 5) {} // busy wait

  const r2 = setupMcp({
    brainPath: '/Users/gabi/second-brain',
    scope: 'user',
    configPath,
  });
  assert.equal(r2.action, 'no-change');

  const mtime2 = fs.statSync(configPath).mtimeMs;
  assert.equal(mtime1, mtime2, 'file should not have been re-written');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('setupMcp: updates env when brain path changes', () => {
  const dir = tmpDir('update-env');
  const configPath = path.join(dir, '.claude.json');

  setupMcp({ brainPath: '/old/brain', scope: 'user', configPath });
  const r2 = setupMcp({ brainPath: '/new/brain', scope: 'user', configPath });

  assert.equal(r2.action, 'updated');
  const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert.equal(
    written.mcpServers[SERVER_NAME].env.REMEMBER_BRAIN_PATH,
    '/new/brain',
  );

  fs.rmSync(dir, { recursive: true, force: true });
});

test('setupMcp: project scope writes .mcp.json in projectRoot with ./relative env', () => {
  const root = tmpDir('proj-scope');
  const brainPath = path.join(root, 'project-brain');
  fs.mkdirSync(brainPath, { recursive: true });

  const result = setupMcp({
    brainPath,
    scope: 'project',
    projectRoot: root,
  });

  assert.equal(result.action, 'created');
  assert.equal(result.configPath, path.join(root, '.mcp.json'));

  const written = JSON.parse(fs.readFileSync(result.configPath, 'utf-8'));
  assert.equal(
    written.mcpServers[SERVER_NAME].env.REMEMBER_BRAIN_PATH,
    './project-brain',
  );

  fs.rmSync(root, { recursive: true, force: true });
});

test('setupMcp: rejects unknown scope', () => {
  assert.throws(
    () => setupMcp({ brainPath: '/x', scope: 'bogus' }),
    /scope must be/,
  );
});

test('setupMcp: rejects missing brainPath', () => {
  assert.throws(
    () => setupMcp({ scope: 'user' }),
    /brainPath is required/,
  );
});

test('setupMcp: handles empty existing config file (whitespace only)', () => {
  const dir = tmpDir('empty-file');
  const configPath = path.join(dir, '.claude.json');
  fs.writeFileSync(configPath, '   \n');

  const result = setupMcp({
    brainPath: '/Users/gabi/second-brain',
    scope: 'user',
    configPath,
  });

  assert.equal(result.action, 'created');
  const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert.ok(written.mcpServers[SERVER_NAME]);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('setupMcp: throws on malformed JSON', () => {
  const dir = tmpDir('malformed');
  const configPath = path.join(dir, '.claude.json');
  fs.writeFileSync(configPath, '{ not valid json ');

  assert.throws(
    () => setupMcp({ brainPath: '/x', scope: 'user', configPath }),
    /failed to parse/,
  );

  fs.rmSync(dir, { recursive: true, force: true });
});
