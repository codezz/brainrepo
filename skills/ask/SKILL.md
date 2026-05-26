---
name: remember:ask
description: Ask a natural-language question of your second brain. The AI reformulates as optimal search queries, calls the `mcp__remember__search_brain` tool, and synthesizes an answer with citations.
---

# /remember:ask — Ask the Brain

Wraps the `mcp__remember__search_brain` MCP tool with: query reformulation, multi-call retry, citation-rich answer synthesis, and honest "not found" handling.

## Prerequisite

The `@remember-md/mcp` server must be configured in the host's MCP config (added automatically by `/remember:init` since plugin v2.5.0). The tool `mcp__remember__search_brain` must be available in this session. If it isn't:

```
⚠️ The brain search MCP server isn't connected. Run `/remember:init` to
auto-configure, then restart Claude Code.
```

Don't proceed without the tool — there's no fallback in v1.

---

## Step 1: Parse the user's question

The slash command is invoked as `/remember:ask <question>`. If the question is empty or only the slash command itself, ask the user what they want to know and stop.

Note the user's language (Romanian / English / mixed). Final answer will mirror the user's language unless content forces English (e.g., technical terms).

## Step 2: Reformulate the query

Convert the natural-language question into a topical search phrase that matches how the brain is actually written. Apply these rules (also documented in the `search_brain` tool description — read it before this step):

- **3–7 words**, declarative noun-phrase
- **Strip stopwords + question words** ("what", "how", "ce", "cum", "do I", "am I")
- **Keep nouns, concepts, proper names**
- **Language match the content, not the question.** Technical notes in this brain are usually English. Personal/strategic/relational notes are usually Romanian. If unsure, plan to try both languages (Step 3 retry).

### Quick reformulation table

| User says | Reformulated query |
|---|---|
| "what do I think about postgres for small projects" | `postgres small projects preferences` |
| "who works on dollie" | `dollie project people contributors` |
| "ce decizii am luat în martie" | `decisions march 2026` |
| "ce stiu despre cezar" | `cezar` (proper name; let BM25 + wikilinks carry it) |
| "cum lucrez în paralel pe proiecte" | `multiple parallel projects orchestration` |
| "what's my strategic direction for 2026" | `strategic direction 2026 priorities` |
| "ce zice persona despre comunicare" | **SKIP** — Persona is already in your session context |

If the question is trivially answered by content already in the Persona block (Mission, Directives, recent Evidence Log), answer directly without calling the tool. Don't waste a tool call on Persona content.

## Step 3: Call `mcp__remember__search_brain`

```
mcp__remember__search_brain({ query: "<reformulated phrase>", top_k: 8 })
```

Default `top_k: 8`. Use:
- **5–7** for focused queries (one specific fact/decision)
- **10–15** for broad surveys ("what do I know about X")
- **20+** for "give me everything on this topic"

## Step 4: Evaluate result quality and retry if weak

**Strong** = top result has `score >= 0.025` AND its `path`/`heading_path`/`text` obviously matches the user's intent.

**Weak** = top result score `< 0.020`, OR results are off-topic, OR `note` says vector index is building (BM25-only mode).

If weak, **retry once or twice** with alternative phrasing:
1. Try a different keyword set (synonyms, broader/narrower concepts)
2. Try the other language (RO ↔ EN)
3. For "decision" queries that miss, try the project name directly
4. For person queries that miss, try the person's project as second hit

Cap at **3 total search_brain calls** per `/remember:ask` invocation. Don't loop.

## Step 5: Synthesize the answer

Write a natural-language answer **in the user's language** (Romanian if they asked in Romanian, English if they asked in English; mix when the content is mixed).

Structure:
1. **Direct answer** in 1–2 sentences. Lead with the conclusion.
2. **Supporting evidence** — bullets or table with `[[wikilinks]]` citing the exact paths from `results[].path`. Quote concise snippets when they carry weight.
3. **Caveats** when relevant (data is stale, decision was for a specific project, contradiction noted, etc.)
4. **Closing** if useful — pointer to the source-of-truth file with strongest score.

Wikilink format: `[[Notes/foo.md]]` or `[[Notes/foo.md|short label]]`. Use the **exact** `path` from the tool result so Obsidian can resolve it.

Quote `text` field directly when concise (1–3 sentences). For longer chunks, paraphrase + cite. Never paraphrase technical details (paths, IDs, dates, names) — quote those verbatim.

## Step 6: Honest "not found" handling

If after up to 3 search calls the brain genuinely doesn't contain a relevant answer:

```
Brain-ul nu pare să aibă informații despre <topic>.

Cele mai apropiate hits au scor sub 0.02 și sunt off-topic
(top: [[<path>]] — <heading_path>).

💡 Want me to remember this? Reply: `remember this: <whatever the user wanted to capture>`
```

**Never invent content** from outside the brain. If the brain is silent, say so. Adjacent or off-topic results should not be presented as if they answer the question.

## Step 7: Confirm format

Final answer should always include:
- ✅ Direct answer (not just dump of results)
- ✅ Wikilink citations using exact result paths
- ✅ User's language (don't switch to English when they asked in Romanian)
- ❌ No hallucinated content beyond what the tool returned
- ❌ No raw JSON of tool output dumped at the user

---

## Worked examples

### Example A — entity lookup
**User:** `/remember:ask cine este cezar`

**Reformulated:** `cezar`

**Tool call:** `mcp__remember__search_brain({ query: "cezar", top_k: 5 })`

**Answer (Romanian, since user asked in Romanian):**
> [[People/cezar.md|Cezar]] este [synthesize from result text]. Lucrează la [[Projects/X|X]]. Ultimul context relevant: [quote from result].
>
> Surse: [[People/cezar.md]], [[Journal/2026-…|recent journal]].

### Example B — decision recall
**User:** `/remember:ask ce am decis despre netopia la 3dtoys`

**Reformulated:** `netopia 3dtoys exclusive payment provider`

**Tool call:** above. If implementation plan ranks higher than decision note:
**Retry:** `decision netopia only 3dtoys`

**Answer:**
> Ai decis ca **Netopia să fie singurul provider de plată** pentru 3DToys ([[Notes/decision-netopia-only-3dtoys.md]]). Motivare: [quote].
>
> Implementare în [[Projects/3dtoys/projects/3dtoys-site/NETOPIA_IMPLEMENTATION_PLAN.md]].

### Example C — empty result
**User:** `/remember:ask what do I think about react native mobile apps`

**Reformulated:** `react native mobile app preferences`

**Tool call:** returns only 2 future-plan mentions (Remember GTM Phase 3), top score 0.0167.

**Answer:**
> Brain-ul nu are o opinie capturată despre **React Native mobile apps**.
>
> Singurele 2 mențiuni sunt planuri viitoare pentru un app mobil al Remember.md ([[Projects/remember/remember.md]] și [[Journal/2026-02-08.md]]) — nu o preferință personală.
>
> 💡 Want me to remember this? Reply: `remember this: ...`

---

## Error handling

| Scenario | Behavior |
|---|---|
| `mcp__remember__search_brain` not available | Tell user to run `/remember:init` + restart |
| Tool returns `note: "Vector index building"` | Use BM25 results, mention "(semantic indexing in progress, results may improve in a few minutes)" |
| Tool returns empty `results` array | Treat as "not found" per Step 6 |
| Tool throws | Surface the error message verbatim and suggest `/remember:status` |
| User asks something already in Persona | Answer from Persona directly; skip the tool call |

## Anti-patterns

- ❌ **Don't dump raw JSON** of `search_brain` output at the user. Synthesize.
- ❌ **Don't translate citations** — wikilinks must use exact result paths.
- ❌ **Don't loop** beyond 3 search calls per ask invocation.
- ❌ **Don't claim knowledge** the tool didn't return. Brain-silence is honest output.
- ❌ **Don't translate user's language** in the answer just because the brain content is the other language — quote in original, summarize in user's language.
- ❌ **Don't re-query for Persona content** — it's already in your session context.
