#!/usr/bin/env node
'use strict';

// Shared context builder used by both the Claude Code hook (scripts/user_prompt.js)
// and the OpenClaw tool registration (index.js).
//
// Reads the plugin's default REMEMBER.md plus the user's REMEMBER.md (brain root
// + cwd) and merges them per-section. User sections named exactly the same as
// a default section APPEND to the default; sections named "Override: <Name>"
// fully REPLACE the matching default; sections that don't match any default
// are passed through verbatim at the end.

const fs = require('fs');
const path = require('path');
const { formatCompact } = require('./build-index');

const OVERRIDE_PREFIX = /^override:\s*/i;

/**
 * Parse all `## Section Name` blocks from a markdown string.
 * Returns an ordered array of { name, content }.
 * Content excludes the header line and is trimmed.
 */
function parseSections(text) {
  if (!text) return [];
  const sections = [];
  const headerRe = /^##\s+(.+?)\s*$/gm;
  const matches = [...text.matchAll(headerRe)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const name = m[1].trim();
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    sections.push({ name, content });
  }
  return sections;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function normalizeName(name) {
  return name.toLowerCase().trim();
}

/**
 * Merge plugin defaults with user sections.
 *
 * @param {Array<{name, content}>} pluginSections - default sections from plugin REMEMBER.md
 * @param {Array<{name, content}>} userSections - all user sections (from one or more REMEMBER.md)
 * @returns {{merged: Array<{name, content, source}>, extraUser: Array<{name, content}>}}
 */
function mergeSections(pluginSections, userSections) {
  const pluginByName = new Map();
  pluginSections.forEach((s, i) => pluginByName.set(normalizeName(s.name), { ...s, index: i }));

  // Bucket user sections by target plugin section name
  const appendsByPluginName = new Map(); // pluginNameLC → array of content blocks
  const overridesByPluginName = new Map(); // pluginNameLC → content (last write wins)
  const extras = []; // user sections that don't match any plugin section

  for (const u of userSections) {
    const overrideMatch = u.name.match(OVERRIDE_PREFIX);
    if (overrideMatch) {
      const targetName = u.name.replace(OVERRIDE_PREFIX, '').trim();
      const key = normalizeName(targetName);
      if (pluginByName.has(key)) {
        overridesByPluginName.set(key, u.content);
      } else {
        // Override of a non-existent default — keep as extra so user still sees it in context
        extras.push({ name: targetName, content: u.content });
      }
      continue;
    }

    const key = normalizeName(u.name);
    if (pluginByName.has(key)) {
      if (!appendsByPluginName.has(key)) appendsByPluginName.set(key, []);
      appendsByPluginName.get(key).push(u.content);
    } else {
      extras.push({ name: u.name, content: u.content });
    }
  }

  const merged = pluginSections.map((s) => {
    const key = normalizeName(s.name);
    if (overridesByPluginName.has(key)) {
      return { name: s.name, content: overridesByPluginName.get(key), source: 'override' };
    }
    const appends = appendsByPluginName.get(key);
    if (appends && appends.length) {
      return {
        name: s.name,
        content: [s.content, ...appends].filter(Boolean).join('\n\n'),
        source: 'append',
      };
    }
    return { name: s.name, content: s.content, source: 'default' };
  });

  return { merged, extraUser: extras };
}

function renderSections(sections) {
  return sections
    .filter((s) => s.content && s.content.trim())
    .map((s) => `## ${s.name}\n${s.content}`)
    .join('\n\n');
}

/**
 * Build the full capture context: brain index + merged rulebook.
 *
 * @param {string} brain - path to user's brain root
 * @param {string} pluginRoot - path to plugin root (where default REMEMBER.md lives)
 * @param {string} [cwd] - current working directory (for project-scoped REMEMBER.md). Defaults to process.cwd().
 * @param {string} [today] - YYYY-MM-DD. Defaults to today.
 * @returns {string}
 */
function buildCaptureContext(brain, pluginRoot, cwd = process.cwd(), today = null) {
  const dateStr = today || new Date().toISOString().slice(0, 10);

  // 1. Brain index
  let compactIndex;
  try {
    compactIndex = formatCompact(brain);
  } catch {
    compactIndex = `BRAIN INDEX (${brain})\n(index unavailable)`;
  }

  // 2. Plugin defaults from REMEMBER.md (root of plugin)
  const pluginRulebook = readFileSafe(path.join(pluginRoot, 'REMEMBER.md')).replace(
    /\{\{TODAY\}\}/g,
    dateStr,
  );
  const pluginSections = parseSections(pluginRulebook);

  // 3. User REMEMBER.md(s) — brain root and cwd if different. Dedupe by resolved path
  // so the same file is never read twice (e.g. cwd inside the plugin tree).
  const seenPaths = new Set([path.resolve(pluginRoot, 'REMEMBER.md')]);
  const userTexts = [];
  const tryAdd = (filePath) => {
    const resolved = path.resolve(filePath);
    if (seenPaths.has(resolved)) return;
    seenPaths.add(resolved);
    const text = readFileSafe(resolved);
    if (text) userTexts.push(text);
  };
  tryAdd(path.join(brain, 'REMEMBER.md'));
  if (cwd) tryAdd(path.join(cwd, 'REMEMBER.md'));
  const userSections = userTexts.flatMap(parseSections);

  // 4. Merge
  const { merged, extraUser } = mergeSections(pluginSections, userSections);

  const rulebook = renderSections(merged);
  const userExtras = extraUser.length
    ? `\n\n## User-defined sections (no matching default)\n\n${renderSections(extraUser)}`
    : '';

  // 5. Compose
  const header = `BRAIN DUMP — capture routing rulebook. Brain: ${brain}. Today: ${dateStr}.`;
  return `${header}\n\n${compactIndex}\n\n${rulebook}${userExtras}\n`;
}

module.exports = {
  parseSections,
  mergeSections,
  buildCaptureContext,
};
