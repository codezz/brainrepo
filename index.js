const fs = require('fs');
const path = require('path');
const { getBrainRoot } = require('./scripts/config');
const { formatCompact } = require('./scripts/build-index');
const { buildCaptureContext } = require('./scripts/build-context');
const promote = require('./scripts/promote');
const { validateAndUpgrade } = require('./scripts/schema');
const { appendEvidence, findSimilarBelief } = require('./scripts/append-evidence');

const MAX_EVIDENCE_LINES = 20;

function truncateEvidence(persona) {
  const evidenceHeader = /^###?\s*Evidence\s*Log/im;
  const match = persona.match(evidenceHeader);
  if (!match) return persona;

  const headerIdx = persona.indexOf(match[0]);
  const beforeEvidence = persona.slice(0, headerIdx + match[0].length);
  const afterHeader = persona.slice(headerIdx + match[0].length);

  const nextSection = afterHeader.match(/^##\s/m);
  const evidenceBlock = nextSection ? afterHeader.slice(0, nextSection.index) : afterHeader;
  const afterEvidence = nextSection ? afterHeader.slice(nextSection.index) : '';

  const lines = evidenceBlock.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('['));
  if (lines.length <= MAX_EVIDENCE_LINES) return persona;

  const truncated = lines.slice(-MAX_EVIDENCE_LINES);
  return beforeEvidence + '\n' + truncated.join('\n') + '\n\n' + afterEvidence;
}

const plugin = {
  id: 'remember',
  name: 'Remember',
  description: 'Portable knowledge base — one brain, every AI tool. Extract decisions, people, and insights from your AI sessions into organized local markdown.',
  version: '2.6.0',

  configSchema: {
    type: 'object',
    properties: {
      brainPath: {
        type: 'string',
        default: '~/remember',
        description: 'Path to your Remember brain (markdown knowledge base)',
      },
    },
    additionalProperties: false,
  },

  register(api) {
    // Read plugin config and set environment for scripts
    const pluginCfg = api.pluginConfig || {};
    const brainPath = pluginCfg.brainPath || process.env.REMEMBER_BRAIN_PATH || '~/remember';
    const expandedPath = brainPath.startsWith('~')
      ? path.join(require('os').homedir(), brainPath.slice(1))
      : path.resolve(brainPath);
    process.env.REMEMBER_BRAIN_PATH = expandedPath;

    // Hook: Inject Persona.md on session_start
    // (migrated from openclaw-hooks/persona-loader/handler.js)
    api.on('session_start', async (event) => {
      const brain = getBrainRoot();
      if (!brain || !fs.existsSync(brain)) return;

      const personaPath = path.join(brain, 'Persona.md');
      let persona;
      try {
        persona = fs.readFileSync(personaPath, 'utf-8');
      } catch {
        return;
      }
      if (!persona || !persona.trim()) return;

      persona = truncateEvidence(persona);

      return {
        prependContext:
          `# REMEMBER BRAIN LOADED\nBrain: ${brain}\n\n` +
          `## PERSONA\n${persona}\n\n` +
          `Commands: /remember:ask, /remember:process, /remember:status, /remember:evolve, 'remember this: ...'`,
      };
    });

    // Tool: remember_brain_dump_context
    // Returns brain index + processing instructions when the agent needs to save knowledge
    api.registerTool({
      name: 'remember_brain_dump_context',
      description: 'Get brain dump context with index and processing instructions. Call this when the user says "remember this", "save this", "brain dump", or similar.',
      parameters: {
        type: 'object',
        properties: {
          userMessage: {
            type: 'string',
            description: 'The user message that triggered the brain dump',
          },
        },
        required: ['userMessage'],
      },
      async execute(_id, _params) {
        const brain = getBrainRoot();
        if (!fs.existsSync(brain)) {
          return { content: [{ type: 'text', text: 'Brain not found. Run /remember:init first.' }] };
        }
        const context = buildCaptureContext(brain, __dirname);
        return { content: [{ type: 'text', text: context }] };
      },
    });

    // Tool: remember_brain_index
    // Returns compact brain index for quick lookups
    api.registerTool({
      name: 'remember_brain_index',
      description: 'Get the brain index showing all tracked people, projects, areas, notes, tasks, and journal entries.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      async execute() {
        const brain = getBrainRoot();
        if (!fs.existsSync(brain)) {
          return { content: [{ type: 'text', text: 'Brain not found. Run /remember:init first.' }] };
        }

        try {
          const index = formatCompact(brain);
          return { content: [{ type: 'text', text: index }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Error building index: ${err.message}` }] };
        }
      },
    });

    // Tool: remember_promote
    // Runs evolve Phase 3 deterministically (no LLM cost). Filters beliefs by
    // configured thresholds, ranks by composite score, updates Persona.md
    // ## Top Beliefs as wikilinks. Cron-safe.
    api.registerTool({
      name: 'remember_promote',
      description: 'Run the deterministic Top Beliefs promotion (evolve Phase 3). Filters beliefs by thresholds (default conf>=0.85, sources>=5) and pins top N to Persona.md. No LLM cost.',
      parameters: {
        type: 'object',
        properties: {
          dryRun: { type: 'boolean', default: false, description: 'Compute deltas without writing.' },
        },
        additionalProperties: false,
      },
      async execute(_id, params = {}) {
        const brain = getBrainRoot();
        if (!fs.existsSync(brain)) {
          return { content: [{ type: 'text', text: 'Brain not found. Run /remember:init first.' }] };
        }
        try {
          const result = promote.run({ brain, dryRun: !!params.dryRun });
          const summary = [
            `Beliefs: ${result.beliefsCount}`,
            `Above threshold: ${result.candidatesCount}`,
            `Pinned (top): ${result.top.length}`,
            `Promoted: ${result.promoted.length}`,
            `Demoted: ${result.demoted.length}`,
            params.dryRun ? '(dry run — no changes written)' : '',
          ].filter(Boolean).join('\n');
          return { content: [{ type: 'text', text: summary }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }
      },
    });

    // Tool: remember_validate
    // Runs validateAndUpgrade on a single brain file. Used by agent flows that
    // write files outside the standard skill paths.
    api.registerTool({
      name: 'remember_validate',
      description: 'Validate and auto-upgrade a brain file. Adds missing schema fields (type, freshness, sources_count, evidence) or Persona sections. Idempotent.',
      parameters: {
        type: 'object',
        properties: {
          filepath: { type: 'string', description: 'Absolute path to a brain file.' },
        },
        required: ['filepath'],
      },
      async execute(_id, params = {}) {
        const brain = getBrainRoot();
        try {
          const result = validateAndUpgrade(params.filepath, { brainRoot: brain });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }
      },
    });

    // Tool: remember_append_evidence
    // Dedup-aware evidence appender. Use when a similar belief/world-fact
    // already exists — increments sources_count and appends the new entry.
    api.registerTool({
      name: 'remember_append_evidence',
      description: 'Append an evidence entry to an existing belief/world-fact file. Increments sources_count, refuses duplicate sources.',
      parameters: {
        type: 'object',
        properties: {
          filepath: { type: 'string', description: 'Path to the existing belief/world-fact file.' },
          source: { type: 'string', description: 'Real file path inside the brain (e.g. Journal/2026-05-05.md).' },
          quote: { type: 'string', description: 'Verbatim quote from the source.' },
          date: { type: 'string', description: 'YYYY-MM-DD of the evidence.' },
        },
        required: ['filepath', 'source', 'quote', 'date'],
      },
      async execute(_id, params = {}) {
        try {
          const result = appendEvidence(params.filepath, {
            source: params.source,
            quote: params.quote,
            date: params.date,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }
      },
    });

    // Tool: remember_find_similar_belief
    // Searches Notes/ for an existing belief/world-fact by slug.
    api.registerTool({
      name: 'remember_find_similar_belief',
      description: 'Search Notes/ for an existing belief or world-fact by slug. Returns the absolute path or "(none)".',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Filename slug (kebab-case, no .md).' },
          type: { type: 'string', description: 'Optional type filter: "belief" or "world-fact".' },
        },
        required: ['slug'],
      },
      async execute(_id, params = {}) {
        const brain = getBrainRoot();
        try {
          const match = findSimilarBelief(brain, params.slug, { typeFilter: params.type || null });
          return { content: [{ type: 'text', text: match || '(none)' }] };
        } catch (err) {
          return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
        }
      },
    });
  },
};

module.exports = plugin;
module.exports.default = plugin;
