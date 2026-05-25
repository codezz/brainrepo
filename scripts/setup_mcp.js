#!/usr/bin/env node
'use strict';

// Patches a Claude Code MCP config (user-level ~/.claude.json OR
// project-level ./.mcp.json) to register the @remember-md/mcp server
// pointing at the user's brain. Idempotent: re-running updates the
// env block and leaves other mcpServers untouched.
//
// CLI:
//   node setup_mcp.js --brain /path --scope user|project [--config /path] [--name remember]
//
// Module API:
//   setupMcp({ brainPath, scope, configPath?, serverName?, projectRoot? })
//     returns { configPath, scope, action: 'created'|'updated'|'no-change' }

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const SERVER_NAME = 'remember';
const NPM_PACKAGE = '@remember-md/mcp';

function resolveConfigPath({ scope, configPath, projectRoot }) {
  if (configPath) return path.resolve(configPath);
  if (scope === 'user') {
    return path.join(os.homedir(), '.claude.json');
  }
  if (scope === 'project') {
    return path.join(projectRoot || process.cwd(), '.mcp.json');
  }
  throw new Error(`unknown scope: ${scope}`);
}

function classifyBrainScope(brainAbsPath, cwd = process.cwd()) {
  const cwdAbs = path.resolve(cwd);
  const brainAbs = path.resolve(brainAbsPath);
  // Brain is inside cwd → project scope.
  const inside = brainAbs === cwdAbs || brainAbs.startsWith(cwdAbs + path.sep);
  return inside ? 'project' : 'user';
}

function brainEnvValue({ scope, brainPath, projectRoot }) {
  // For project scope, store as a path relative to project root so the
  // config is portable across machines (and works even if the project is
  // checked out at a different absolute path on another machine).
  if (scope === 'project') {
    const root = projectRoot || process.cwd();
    const rel = path.relative(root, path.resolve(brainPath));
    // Ensure relative paths are prefixed with ./ so MCP host doesn't
    // confuse them with absolute / module-style refs.
    if (rel === '' || rel === '.') return './';
    if (rel.startsWith('..')) {
      // Brain isn't inside the project root after all — fall back to
      // absolute. (Caller should usually have classified as 'user'.)
      return path.resolve(brainPath);
    }
    return `./${rel}`;
  }
  // user scope: absolute path (resolved + tilde-expanded already).
  return path.resolve(brainPath);
}

function buildEntry({ scope, brainPath, projectRoot }) {
  return {
    command: 'npx',
    args: ['-y', NPM_PACKAGE],
    env: {
      REMEMBER_BRAIN_PATH: brainEnvValue({ scope, brainPath, projectRoot }),
    },
  };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function setupMcp({
  brainPath,
  scope,
  configPath,
  serverName = SERVER_NAME,
  projectRoot,
} = {}) {
  if (!brainPath) throw new Error('brainPath is required');
  if (scope !== 'user' && scope !== 'project') {
    throw new Error(`scope must be "user" or "project", got: ${scope}`);
  }

  const target = resolveConfigPath({ scope, configPath, projectRoot });

  let config = {};
  let existed = false;
  if (fs.existsSync(target)) {
    const raw = fs.readFileSync(target, 'utf-8');
    if (raw.trim()) {
      existed = true;
      try {
        config = JSON.parse(raw);
      } catch (err) {
        throw new Error(`failed to parse ${target}: ${err.message}`);
      }
    }
    // Whitespace-only files are treated as non-existent for accounting:
    // we still overwrite them, but the action is 'created' not 'added'.
  }

  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
  }

  const newEntry = buildEntry({ scope, brainPath, projectRoot });
  const prevEntry = config.mcpServers[serverName];

  let action;
  if (prevEntry && deepEqual(prevEntry, newEntry)) {
    action = 'no-change';
  } else {
    config.mcpServers[serverName] = newEntry;
    action = existed ? (prevEntry ? 'updated' : 'added') : 'created';
  }

  // Always write so the file ends with a trailing newline and keys are
  // sorted predictably. Skip the write when no-change to keep mtimes
  // stable.
  if (action !== 'no-change') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  }

  return {
    configPath: target,
    scope,
    serverName,
    action,
    entry: newEntry,
  };
}

module.exports = {
  setupMcp,
  classifyBrainScope,
  buildEntry,
  brainEnvValue,
  resolveConfigPath,
  SERVER_NAME,
  NPM_PACKAGE,
};

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  function arg(name) {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  }
  const brainPath = arg('--brain');
  const scope = arg('--scope');
  const configPath = arg('--config');
  const serverName = arg('--name');
  const projectRoot = arg('--project-root');

  if (!brainPath || !scope) {
    process.stderr.write(
      'Usage:\n' +
      '  node setup_mcp.js --brain <path> --scope user|project [--config <file>] [--name <id>] [--project-root <dir>]\n',
    );
    process.exit(1);
  }

  try {
    const result = setupMcp({ brainPath, scope, configPath, serverName, projectRoot });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`setup_mcp: ${err.message}\n`);
    process.exit(1);
  }
}
