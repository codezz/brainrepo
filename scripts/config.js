#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { DEFAULT_THRESHOLDS } = require('./schema');

let _cached = null;

function getBrainRoot() {
  const raw = process.env.REMEMBER_BRAIN_PATH || '~/remember';
  return raw.startsWith('~') ? path.join(os.homedir(), raw.slice(1)) : path.resolve(raw);
}

function loadConfig({ forceReload = false } = {}) {
  if (_cached && !forceReload) return _cached;

  const pluginRoot = path.resolve(__dirname, '..');
  const defaultsFile = path.join(pluginRoot, 'config.defaults.json');

  try {
    _cached = JSON.parse(fs.readFileSync(defaultsFile, 'utf-8'));
  } catch {
    _cached = {
      session: {
        brain_dump_keywords: [
          'save this', 'remember this', 'brain dump', 'note to self',
          'capture this', 'save to brain', 'write to brain', 'add to brain',
        ],
        load_persona: true,
        passive_nudge: true,
      },
      extract: {
        max_assistant_text_len: 500,
        min_session_size: 500,
      },
    };
  }

  return _cached;
}

function parseFrontmatter(filePath, maxBytes = 2048) {
  let text;
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
    fs.closeSync(fd);
    text = buf.toString('utf-8', 0, bytesRead);
  } catch {
    return {};
  }

  const meta = {};

  if (text.startsWith('---')) {
    const end = text.indexOf('---', 3);
    if (end > 0) {
      const fm = text.slice(3, end);
      for (const line of fm.trim().split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (val.startsWith('[') && val.endsWith(']')) {
          val = val.slice(1, -1).trim();
        }
        meta[key] = val;
      }
    }
  }

  const h1Match = text.match(/^#\s+(.+)$/m);
  if (h1Match) {
    meta._title = h1Match[1].trim();
  }

  return meta;
}

function loadEvolutionConfig({ stateDir = null } = {}) {
  const dir = stateDir || path.join(
    process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'),
    'remember',
  );
  const file = path.join(dir, 'config.json');

  let user = {};
  try {
    user = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!user || typeof user !== 'object') user = {};
  } catch {
    user = {};
  }

  return {
    thresholds: { ...DEFAULT_THRESHOLDS, ...(user.thresholds || {}) },
    auto_promote: typeof user.auto_promote === 'boolean' ? user.auto_promote : true,
    paths: { ...(user.paths || {}) },
  };
}

module.exports = { getBrainRoot, loadConfig, parseFrontmatter, loadEvolutionConfig };

// CLI: node config.js [brain_root | key.path]
if (require.main === module) {
  const key = process.argv[2];
  if (!key) {
    console.log(JSON.stringify(loadConfig(), null, 2));
  } else if (key === 'brain_root') {
    console.log(getBrainRoot());
  } else {
    const config = loadConfig();
    let val = config;
    for (const part of key.split('.')) {
      val = val && typeof val === 'object' ? val[part] : undefined;
    }
    if (val === undefined) val = '';
    console.log(typeof val === 'object' ? JSON.stringify(val) : val);
  }
}
