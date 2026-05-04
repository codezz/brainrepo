#!/usr/bin/env node
'use strict';

// Deterministic Top Beliefs pinning. Phase 3 of /remember:evolve, also
// runnable as a CLI (`node scripts/promote.js`) for cron-driven flows
// without invoking the LLM.

const fs = require('node:fs');
const path = require('node:path');
const { getBrainRoot, parseFrontmatter, loadEvolutionConfig } = require('./config');
const { TYPES, FRESHNESS } = require('./schema');
const evolutionLog = require('./evolution-log');

const TOP_BELIEFS_HEADING = '## Top Beliefs';
const ELIGIBLE_FRESHNESS = new Set([FRESHNESS.STABLE, FRESHNESS.STRENGTHENING]);

function findBeliefs(brain) {
  const notesDir = path.join(brain, 'Notes');
  if (!fs.existsSync(notesDir)) return [];

  const beliefs = [];
  for (const entry of fs.readdirSync(notesDir)) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(notesDir, entry);
    const fm = parseFrontmatter(filePath);
    if (fm.type !== TYPES.BELIEF) continue;

    const confidence = Number(fm.confidence);
    if (Number.isNaN(confidence)) continue;

    beliefs.push({
      path: `Notes/${entry}`,
      title: fm._title || entry.replace(/\.md$/, ''),
      confidence,
      sources_count: Number(fm.sources_count) || 0,
      freshness: fm.freshness || FRESHNESS.STABLE,
    });
  }
  return beliefs;
}

function filterCandidates(beliefs, thresholds) {
  return beliefs.filter(b =>
    b.confidence >= thresholds.promotion_confidence &&
    b.sources_count >= thresholds.promotion_sources &&
    ELIGIBLE_FRESHNESS.has(b.freshness),
  );
}

function score(b) {
  return b.confidence * Math.log(b.sources_count + 1);
}

function rankAndTake(candidates, n) {
  return [...candidates].sort((a, b) => score(b) - score(a)).slice(0, n);
}

function readCurrentTopBeliefs(personaPath) {
  if (!fs.existsSync(personaPath)) return [];
  const text = fs.readFileSync(personaPath, 'utf-8');
  const lines = text.split('\n');
  let inSection = false;
  const links = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.trim() === TOP_BELIEFS_HEADING) inSection = true;
      continue;
    }
    if (!inSection) continue;
    const match = line.match(/\[\[([^\]]+)\]\]/);
    if (match) links.push(match[1]);
  }
  return links;
}

function renderTopBeliefsSection(top) {
  if (!top.length) {
    return `${TOP_BELIEFS_HEADING}\n\n_None yet — run \`/remember:evolve\` after capturing more beliefs._\n`;
  }
  const items = top.map((b, i) =>
    `${i + 1}. [[${b.path}]] — conf=${b.confidence.toFixed(2)} sources=${b.sources_count} freshness=${b.freshness}`,
  );
  return `${TOP_BELIEFS_HEADING}\n\n${items.join('\n')}\n`;
}

function writeTopBeliefs(personaPath, top) {
  let text = fs.existsSync(personaPath) ? fs.readFileSync(personaPath, 'utf-8') : '';
  const newSection = renderTopBeliefsSection(top);

  const headingRe = /^## Top Beliefs[ \t]*$/m;
  const match = text.match(headingRe);
  if (match) {
    const start = match.index;
    const after = text.slice(start + match[0].length);
    const nextHeadingMatch = after.match(/^## /m);
    const end = nextHeadingMatch
      ? start + match[0].length + nextHeadingMatch.index
      : text.length;
    text = text.slice(0, start) + newSection + (nextHeadingMatch ? '\n' : '') + text.slice(end);
  } else {
    if (text && !text.endsWith('\n')) text += '\n';
    text += `\n${newSection}`;
  }

  fs.writeFileSync(personaPath, text, 'utf-8');
}

function computeDeltas(currentLinks, top) {
  const topPaths = new Set(top.map(t => t.path));
  const promoted = top.filter(t => !currentLinks.includes(t.path));
  const demoted = currentLinks.filter(l => !topPaths.has(l));
  return { promoted, demoted };
}

function run({ brain = null, dryRun = false, configOverride = null, logPath = null } = {}) {
  const brainRoot = brain || getBrainRoot();
  const personaPath = path.join(brainRoot, 'Persona.md');
  const config = configOverride || loadEvolutionConfig();

  const beliefs = findBeliefs(brainRoot);
  const candidates = filterCandidates(beliefs, config.thresholds);
  const top = rankAndTake(candidates, config.thresholds.top_beliefs_n);
  const currentLinks = readCurrentTopBeliefs(personaPath);
  const { promoted, demoted } = computeDeltas(currentLinks, top);

  const willWrite = !dryRun && config.auto_promote && fs.existsSync(personaPath);

  if (willWrite) {
    writeTopBeliefs(personaPath, top);

    const logOpts = logPath ? { logPath } : {};
    for (const p of promoted) {
      evolutionLog.appendEvent(
        'PROMOTE',
        `${p.path} → Persona.Top conf=${p.confidence.toFixed(2)} sources=${p.sources_count}`,
        logOpts,
      );
    }
    for (const d of demoted) {
      evolutionLog.appendEvent(
        'DEMOTE',
        `${d} ← Persona.Top reason=below_threshold`,
        logOpts,
      );
    }
  }

  return {
    top,
    promoted,
    demoted,
    beliefsCount: beliefs.length,
    candidatesCount: candidates.length,
    wrote: willWrite,
  };
}

module.exports = {
  findBeliefs,
  filterCandidates,
  score,
  rankAndTake,
  readCurrentTopBeliefs,
  renderTopBeliefsSection,
  writeTopBeliefs,
  computeDeltas,
  run,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const result = run({ dryRun });
  process.stdout.write(`Beliefs: ${result.beliefsCount}\n`);
  process.stdout.write(`Above threshold: ${result.candidatesCount}\n`);
  process.stdout.write(`Top: ${result.top.length}\n`);
  process.stdout.write(`Promoted: ${result.promoted.length}\n`);
  process.stdout.write(`Demoted: ${result.demoted.length}\n`);
  if (dryRun) process.stdout.write('(dry run — no changes written)\n');
}
