# Remember Structure Guide

Detailed breakdown of every folder and when to use it.

## Directory Tree

```
remember/
│
├── Inbox/                          # Temporary capture zone
│   └── *.md                        # Unprocessed notes (clear daily)
│
├── Projects/                       # Active work with deadlines
│   └── <project-name>/
│       ├── <project-name>.md      # Project overview & status
│       ├── meetings/              # Meeting notes
│       └── *.md                   # Project-specific notes
│
├── Areas/                          # Ongoing responsibilities (FLAT)
│   ├── career.md                  # Professional development
│   ├── health.md                  # Fitness, wellbeing, routines
│   ├── family.md                  # Relationships, quality time, dates
│   ├── finances.md                # Budget, investments, income
│   └── <custom-area>.md           # User-created areas
│
├── Notes/                          # Atomic knowledge (Zettelkasten)
│   └── <note-name>.md             # One idea per note
│
├── Resources/                      # External references
│   ├── articles/                  # Saved articles
│   ├── books/                     # Book notes
│   ├── tools/                     # Tool documentation
│   └── *.md                       # General resources
│
├── Journal/                        # Daily notes
│   └── YYYY-MM-DD.md              # One file per day
│
├── People/                         # Relationship tracking
│   └── <firstname-lastname>.md    # One file per person
│
├── Tasks/                          # Task management
│   └── tasks.md                   # All tasks, linked to projects
│
└── Archive/                        # Completed/inactive items
    └── *.md                       # Archived projects/notes
```

## Areas — Design Principles

**Areas are FLAT.** Each area is a single `.md` file, not a folder with sub-files.

### Why flat?

1. **No index pages** — Index pages become either empty or duplicate content
2. **No empty sub-files** — Sub-files like `habits.md` or `learning.md` stay empty forever
3. **No confusion** — You always know where to put something (one file per domain)
4. **Easy to scan** — Open `Areas/` and see 4 files, not nested folders

### Rules

1. **One file per area** — no sub-files, no sub-folders
2. **If a section grows too big** → extract to a Note in `Notes/` and link to it
3. **If an area becomes time-bound** → it's a Project, move it to `Projects/`
4. **Keep each area file under ~200 lines** — if longer, extract sections to Notes

### Default Areas (created at init)

| Area | What goes here | What does NOT go here |
|------|---------------|----------------------|
| `career.md` | Roles, goals, skills, results, positioning | Personal routines, family plans |
| `health.md` | Exercise, nutrition, routines, wellbeing | Career skills |
| `family.md` | Relationships, quality time, dates, vacations | Work schedules |
| `finances.md` | Budget, investments, income streams | Project costs (→ Projects/) |

### Creating custom areas

Users can create additional areas as single files:
```
Areas/side-projects.md
Areas/spirituality.md
Areas/volunteering.md
```

**When to create an area:**
- Ongoing responsibility with no end date
- Regular attention needed
- Not a project (no specific deliverable)

**When NOT to create an area:**
- If it has a deadline → it's a Project
- If it's a one-time note → it's a Note
- If it only has 2-3 lines → add as a section in an existing area

## Folder Details

### Inbox/

**Purpose:** Quick capture without friction. Brain dump zone.

**Rules:**
- Anything goes here first
- No organization required
- Clear DAILY during evening processing
- If something sits >3 days, either process or delete

---

### Projects/

**Purpose:** Active work with specific outcomes and deadlines.

**Rules:**
- Each project gets its own folder
- Must have a main `.md` with overview
- Move to Archive/ when complete
- Link to relevant People/ and Notes/

**When to create a project:**
- Has a clear deliverable
- Has a deadline (even if fuzzy)
- Requires multiple actions
- Will eventually be "done"

---

### Notes/

**Purpose:** Permanent atomic knowledge. Zettelkasten-style.

**Rules:**
- One idea per note
- Heavily linked with `[[wikilinks]]`
- Evergreen — update as knowledge grows
- Not project-specific (that goes in Projects/)

**Good for:**
- Concepts and mental models
- Lessons learned
- Frameworks and methodologies
- Insights that apply broadly

---

### Resources/

**Purpose:** External content worth saving.

**Rules:**
- Always include source URL
- Add why it's valuable
- Summarize key points

---

### Journal/

**Purpose:** Daily chronological record.

**Rules:**
- One file per day: `YYYY-MM-DD.md`
- Created during evening processing
- Links to what was captured/processed

---

### People/

**Purpose:** Track relationships and interactions.

**Rules:**
- One file per person: `firstname-lastname.md`
- Record how you met, context
- Log significant interactions
- Link to shared projects

---

### Tasks/

**Purpose:** Centralized task tracking.

**Rules:**
- Main file: `tasks.md`
- Tasks linked to projects where relevant
- Use `- [ ]` checkbox format
- Review weekly

---

### Archive/

**Purpose:** Completed or inactive items.

**Rules:**
- Move completed projects here
- Maintains history without clutter

## Decision Tree

```
New information arrives
│
├─ Is it about an active project?
│  YES → Projects/<project>/
│
├─ Is it about a person?
│  YES → People/<person>.md
│
├─ Is it about career/professional development?
│  YES → Areas/career.md
│
├─ Is it about health/fitness/routines?
│  YES → Areas/health.md
│
├─ Is it about family/relationships?
│  YES → Areas/family.md
│
├─ Is it about money/budget/investments?
│  YES → Areas/finances.md
│
├─ Is it a task/todo?
│  YES → Tasks/tasks.md (+ project link if relevant)
│
├─ Is it external content (article, link)?
│  YES → Resources/
│
├─ Is it reusable knowledge (concept, lesson)?
│  YES → Notes/
│
├─ Is it a daily reflection?
│  YES → Journal/YYYY-MM-DD.md
│
└─ Not sure?
   → Inbox/ (process later)
```

---

## Layered model

The brain has three durability layers, mapped onto existing folders (no folder restructuring):

| Layer | Role | Mutability | Folders |
|---|---|---|---|
| **L1 — Capture** | Raw, immutable, append-only | Append-only | `Inbox/`, `Journal/`, `Tasks/` (active focus) |
| **L2 — Curate** | Synthesized knowledge with evidence | Never overwrite; append + counter-evidence | `Notes/`, `People/`, `Projects/<x>/`, `Areas/`, `Resources/` |
| **L3 — Pinned** | Always-loaded identity & top beliefs | Auto-regenerated by skills | `Persona.md` (only file pinned to session context) |

**Loading discipline:**
- Session start: L3 only (`Persona.md` via `session_start.js`)
- Capture trigger ("remember this", "salvează", etc.): L2 brain index + REMEMBER.md cascading via `build-context.js`
- Process / evolution skills: full read access, scoped to relevant subset
- `REMEMBER.md` is config, not session context — already lazy-loaded today

## Epistemic schema

Each L2 file carries an epistemic `type` indicating what kind of knowledge it represents:

| Type | What it stores | Where it lives |
|---|---|---|
| `world-fact` | Verifiable claim about reality (decision, technical fact, learning) | `Notes/<topic>.md`, `Notes/decision-<topic>.md` |
| `belief` | Subjective claim with confidence (preference, hypothesis, judgment) | `Notes/<topic>.md` with `type: belief` |
| `observation` | Synthesized profile per entity | `People/<name>.md`, `Projects/<x>/<x>.md`, `Areas/<x>.md` |
| `experience` | First-person event log | `Journal/<date>.md` |

### Frontmatter contract

Every L2 file SHOULD carry these fields (additive — files without them keep working):

```yaml
type: belief                  # one of: world-fact | belief | observation | experience
freshness: stable             # one of: stable | strengthening | weakening | stale | contradicted
confidence: 0.7               # 0.0–1.0; required for type=belief
sources_count: 3              # number of sources contributing
evidence:                     # array of {source, quote, date}
  - source: journal/2026-05-04
    quote: "verbatim from session"
    date: 2026-05-04
counter_evidence: []          # populated by /remember:evolve when contradiction detected
last_consolidated: 2026-05-04 # for type=observation only
```

Helpers in `scripts/schema.js`:
- `detectType(text)` — heuristic classification
- `validateFrontmatter(meta)` — checks required fields and ranges
- `TYPES`, `FRESHNESS`, `DEFAULT_THRESHOLDS` — constants

### Schema rules

1. **Additive only** — files without epistemic fields keep working. Skills lazily upgrade on touch.
2. **Never overwrite L2** — append evidence; conflicts go to `counter_evidence`. History preserved.
3. **Always cite** — every fact added by extraction must have at least one `evidence` entry.
4. **Distinguish fact from opinion at extraction time** — *"user said X"* = world-fact (verifiable quote). *"user prefers X"* = belief (interpretation).
5. **Lazy entity creation** — create `People/<x>.md` only at the second touch (first mention stays in journal only).

## Plugin state

Plugin metadata lives in `~/.local/state/remember/` (XDG):

| File | Purpose |
|---|---|
| `processed-claude-code` | Session IDs already extracted (existing) |
| `processed-openclaw` | Same for OpenClaw (existing) |
| `evolution.log` | Append-only audit log for auto-changes (NEW in v2.1) |
| `config.json` | Optional plugin overrides — thresholds, paths (NEW in v2.1) |

The brain itself never references files in this directory.
