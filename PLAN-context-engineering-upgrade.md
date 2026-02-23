# SoulPrint Context Engineering Upgrade

**Date:** 2026-02-21
**Status:** Planning
**Reference:** Agent Skills for Context Engineering (muratcankoylan)

---

## Goal

Transform SoulPrint from flat-file storage to a proper context-engineered personal OS with:
- Progressive disclosure (load only what's needed)
- Append-only memory (never lose data)
- Voice as structured data (numeric scales)
- Module separation (identity, memory, network, content, operations)

---

## Current State

```
users/{userId}/
├── SOUL.md      ← AI personality (monolithic)
├── MEMORY.md    ← Plain text memory (can be overwritten)
├── IDENTITY.md  ← AI name/role
├── USER.md      ← Info about the human
├── AGENTS.md    ← Agent instructions
└── TOOLS.md     ← Local notes
```

**Problems:**
1. Everything loads every time (token waste)
2. Memory can be overwritten (data loss risk)
3. Voice is vague adjectives not structured data
4. No separation between memory types (facts vs experiences vs decisions)

---

## Target State

```
users/{userId}/
├── BRAIN.md                    ← Routing file (always loaded, tells AI what module to use)
│
├── identity/
│   ├── SOUL.md                 ← AI personality + behavior rules
│   ├── voice.md                ← Voice attributes (1-10 scales) + anti-patterns
│   ├── brand.md                ← User's positioning, topics, audience
│   └── values.yaml             ← Core beliefs, priorities
│
├── memory/
│   ├── facts.jsonl             ← Core facts about the user (append-only)
│   ├── experiences.jsonl       ← Key moments with emotional weight
│   ├── decisions.jsonl         ← Decisions + reasoning + outcomes
│   └── failures.jsonl          ← What went wrong + lessons
│
├── network/
│   ├── contacts.jsonl          ← People they know
│   ├── interactions.jsonl      ← Conversation log with contacts
│   └── circles.yaml            ← Relationship tiers + cadences
│
├── content/
│   ├── ideas.jsonl             ← Captured ideas (scored)
│   ├── drafts/                 ← Work in progress
│   └── posts.jsonl             ← Published content + metrics
│
├── operations/
│   ├── goals.yaml              ← OKRs, what they're working toward
│   ├── todos.md                ← Active tasks (P0-P3)
│   └── meetings.jsonl          ← Past/upcoming meetings
│
└── workspace/
    ├── USER.md                 ← Info about the human (legacy compat)
    ├── TOOLS.md                ← Local notes (legacy compat)
    └── files/                  ← User's saved files
```

---

## JSONL Schema Patterns

Every JSONL file starts with a schema line:

### facts.jsonl
```jsonl
{"_schema": "fact", "_version": "1.0", "_description": "Core facts about the user. Append-only."}
{"id": "fact_001", "created": "2026-02-21", "fact": "Works at TechCorp as a PM", "category": "work", "status": "active"}
{"id": "fact_002", "created": "2026-02-21", "fact": "Has a dog named Max", "category": "personal", "status": "active"}
```

### experiences.jsonl
```jsonl
{"_schema": "experience", "_version": "1.0", "_description": "Key moments with emotional weight (1-10)."}
{"id": "exp_001", "date": "2026-02-20", "event": "Launched SoulPrint to first 10 users", "weight": 9, "emotion": "excited", "lesson": "Ship early, iterate fast"}
```

### decisions.jsonl
```jsonl
{"_schema": "decision", "_version": "1.0", "_description": "Key decisions with reasoning and outcomes."}
{"id": "dec_001", "date": "2026-02-21", "decision": "Use Workers Unbound for 30min timeout", "reasoning": "Complex tool chains need time", "alternatives": ["Break into smaller tasks", "Use queues"], "outcome": "pending"}
```

### contacts.jsonl
```jsonl
{"_schema": "contact", "_version": "1.0", "_description": "Personal contacts database."}
{"id": "contact_001", "name": "Sarah Chen", "handle": "@sarahchen", "company": "Acme Inc", "role": "CEO", "circle": "active", "how_met": "Twitter DM", "can_help_with": ["fundraising", "intros"], "you_can_help_with": ["AI strategy"], "last_contact": "2026-02-15"}
```

---

## Voice Profile Structure

### voice.md
```markdown
# Voice Profile

## Attributes (1-10)
| Attribute | Score | Notes |
|-----------|-------|-------|
| Formal ↔ Casual | 7 | Fairly casual, like texting a smart friend |
| Serious ↔ Playful | 5 | Balanced, can joke but stays on point |
| Technical ↔ Simple | 6 | Uses jargon when helpful, explains when not |
| Reserved ↔ Expressive | 6 | Shows personality but not over the top |
| Humble ↔ Confident | 7 | Confident but not arrogant |

## Signature Phrases
- "Here's the thing..."
- "Let me break it down"
- "Ship it"

## Never Use
- "Synergy"
- "Circle back"
- "I'd be happy to help" (too corporate)
- Excessive exclamation marks

## Writing Patterns
- Short sentences. One idea per line.
- 2-3 sentences per paragraph max
- Use line breaks for emphasis
- Lists over walls of text
```

---

## Progressive Disclosure Logic

### BRAIN.md (always loaded)
```markdown
# Brain Router

You are [AI_NAME], a SoulPrint AI. This file tells you what to load.

## Module Routing

| User Says | Load Module |
|-----------|-------------|
| "write", "post", "content", "draft" | identity/ + content/ |
| "remember", "you know", "we talked about" | memory/ |
| "who is", "contact", "meeting with" | network/ |
| "goals", "todos", "what should I work on" | operations/ |
| General chat | identity/SOUL.md only |

## Loading Rules
1. Always load identity/SOUL.md (your personality)
2. Load voice.md when creating any content
3. Load relevant module based on task
4. Never load everything at once
```

### Code Change in index.ts
```typescript
async function getContextForTask(env: Env, userId: string, userMessage: string): Promise<string> {
  // Always load BRAIN.md + SOUL.md
  const brain = await loadFile(env, userId, 'BRAIN.md');
  const soul = await loadFile(env, userId, 'identity/SOUL.md');
  
  let context = brain + '\n\n' + soul;
  
  // Detect task type and load relevant modules
  const msg = userMessage.toLowerCase();
  
  if (msg.match(/write|post|content|draft|create/)) {
    context += await loadFile(env, userId, 'identity/voice.md');
    context += await loadFile(env, userId, 'content/ideas.jsonl', { lastN: 20 });
  }
  
  if (msg.match(/remember|you know|we talked|last time/)) {
    context += await loadFile(env, userId, 'memory/facts.jsonl', { lastN: 50 });
    context += await loadFile(env, userId, 'memory/experiences.jsonl', { lastN: 20 });
  }
  
  if (msg.match(/who is|contact|meeting with|call with/)) {
    context += await loadFile(env, userId, 'network/contacts.jsonl');
    context += await loadFile(env, userId, 'network/interactions.jsonl', { lastN: 30 });
  }
  
  if (msg.match(/goals?|todo|task|work on|priority/)) {
    context += await loadFile(env, userId, 'operations/goals.yaml');
    context += await loadFile(env, userId, 'operations/todos.md');
  }
  
  return context;
}
```

---

## Implementation Phases

### Phase 1: New Workspace Structure (Tonight)
- [ ] Create template files for new structure
- [ ] Update R2 helper functions to support nested paths
- [ ] Create migration function for existing users

### Phase 2: Progressive Loading (Tomorrow)
- [ ] Implement `getContextForTask()` routing logic
- [ ] Update Telegram webhook to use new loading
- [ ] Update web chat to use new loading
- [ ] Test token usage reduction

### Phase 3: JSONL Memory System (This Week)
- [ ] Replace `update_memory` tool with `append_fact` tool
- [ ] Add `log_decision`, `log_experience` tools
- [ ] Implement JSONL append helpers
- [ ] Add memory search across JSONL files

### Phase 4: Voice Extraction (Next Week)
- [ ] Build voice profile generator from chat history
- [ ] Extract numeric attributes from writing samples
- [ ] Generate anti-patterns list from user feedback
- [ ] Auto-populate voice.md during onboarding

### Phase 5: Network & Content Modules (Week After)
- [ ] Implement contacts.jsonl management
- [ ] Add pre-meeting brief generation
- [ ] Build content ideas pipeline
- [ ] Connect to content calendar

---

## Migration Strategy

For existing users:
1. Keep old files in `workspace/` for backward compat
2. Create new structure alongside
3. Gradually migrate data:
   - SOUL.md → identity/SOUL.md
   - MEMORY.md → parse into memory/facts.jsonl
   - USER.md → workspace/USER.md (unchanged)

New users get the new structure from day 1.

---

## Success Metrics

1. **Token reduction:** 40%+ fewer tokens loaded per request
2. **Memory persistence:** Zero data loss (append-only)
3. **Voice consistency:** Users say AI "sounds like them"
4. **Response quality:** Better context = better answers

---

## Questions to Decide

1. **Onboarding flow:** Keep 36-question assessment or simplify?
2. **Voice extraction:** Auto-generate from chat history or manual setup?
3. **Module depth:** How many levels of nesting?
4. **Storage limits:** Max JSONL file size before archiving?

---

## Next Action

Start Phase 1: Create the template files for the new workspace structure.
