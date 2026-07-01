# Copilot Instructions for Level Designer

## Memory-first workflow
- Treat MemPalace as the primary context source for project architecture, systems, and decisions.
- At the start of each new chat, call MemPalace MCP tools first: `mempalace_search` scoped to `wing=level_designer`, then `mempalace_traverse`/`mempalace_get_drawer` for exact context.
- Do not ask to re-read project markdown files when MemPalace already covers the topic.
- Read repository files only for verification, code edits, or when memory coverage is missing.
- If memory and code conflict, prefer current code and report the conflict explicitly.
- After resolving a task, persist newly discovered stable facts back to MemPalace (`mempalace_add_drawer` and optional `mempalace_kg_add`).

### MemPalace self-healing workflow
- If MemPalace MCP is online but retrieval looks empty/stale/noisy after recent mining, the agent must self-heal before asking the user.
- Run `mempalace_reconnect` first to refresh in-memory index state.
- Re-run a narrow `mempalace_search` query in `wing=level_designer` to verify recovery.
- If still stale, verify MCP and CLI use the same palace path (`E:\AI_tools\mempalace-palace`).
- If path is correct but data is still stale, restart the MemPalace MCP server and retry search/traverse.
- Only after these steps, report the issue briefly and continue with repository evidence as fallback.
- If MemPalace is temporarily unavailable, fall back to repository evidence and the local docs (`Context_map.md`, `docs/`).

## Rules capture workflow
- During normal work chats, infer likely client/work rules from user phrasing without asking the user to label them explicitly.
- When the conversation includes stable preferences, constraints, or style directives, store them in MemPalace via `mempalace_add_drawer` under a rules/preferences room and link with `mempalace_kg_add`.
- Keep only reusable, stable rules; avoid storing transient one-off requests.

## Response style
- Keep answers concrete and action-oriented.
- Provide minimal clarification questions; ask one focused question when required.
- Do not ask the user to save/update memory manually.
- Handle memory updates internally via MemPalace tools when a stable fact is discovered.

## Browser verification (chrome-devtools MCP)

- The editor server is **always already running** at `http://localhost:8000/index.html` (per `Context_map.md` — never start `python -m http.server`/`npx serve`/`start_Editor.bat` yourself).
- Use the `chrome-devtools` MCP tools to verify changes instead of asking the user to check manually: `navigate_page` to `http://localhost:8000/index.html`, perform the interaction (`click`/`fill`/`drag`/`press_key`), then `list_console_messages` to check for errors/warnings before declaring a fix done.
- `take_screenshot`/`take_snapshot` for visual confirmation of UI changes; `list_network_requests`/`get_network_request` when debugging level/asset load issues.
- `evaluate_script` can call `levelEditor`/`stateManager` APIs directly in the page context for state inspection — prefer this over guessing from code alone.
- Always re-check `list_console_messages` after the interaction, not just on page load — most bugs here surface during interaction (drag, undo/redo, dialog open/close), not at startup.
- If `chrome-devtools` MCP is unavailable this session, say so explicitly and fall back to static code review.
- BugHunter's "Suggested Manual Test" and TestGenerator's manual QA checklists can be executed directly this way instead of staying purely theoretical — run them through `chrome-devtools` and report actual results.

## JavaScript development guidelines (Level Designer)
- Route all DOM events through `EventHandlerManager`/`GlobalEventRegistry`; never raw `addEventListener` outside that layer.
- Treat `StateManager`/`ConfigManager` as the single source of truth; don't add `if (!stateManager)` guards — trust the architecture.
- Use `Logger.<category>.<method>()`; never `console.log`/`console.warn`/`console.error` directly.
- New dialogs/panels extend `BaseDialog`/established base classes; don't duplicate lifecycle logic — call `super.method()`.
- Build DOM via `UIFactory`, not raw `document.createElement` chains.
- Default to passive listeners for high-frequency events (`wheel`, `mousemove`, `pointermove`); non-passive only where `preventDefault` is required.
- No per-frame allocations in `RenderOperations`/`MouseHandlers` hot paths; avoid LINQ-style chained `.map`/`.filter` in render/drag code.
- Keep one operation per file (`ObjectOperations`, `LayerOperations`, etc.) — no monolithic multi-purpose modules.
- Never start dev servers (`python -m http.server`, `npx serve`, `start_Editor.bat`) — they are always already running.
- Full detail lives in `docs/ARCHITECTURE.md`, `docs/COMMON_MISTAKES.md`, `docs/DEVELOPMENT_GUIDE.md`, `Context_map.md`.

### JS code checklist for agent output
- Clear module/class purpose and small API surface, one operation per file.
- All event wiring through `EventHandlerManager`/`GlobalEventRegistry`, with explicit cleanup tied to component lifecycle.
- No per-frame allocations or uncached DOM queries in render/drag hot paths.
- `Logger` used for all diagnostic output, with the correct category.
- New UI built through `UIFactory`; new dialogs extend `BaseDialog`.
- Ownership and cleanup explicit for caches (`CacheManager`), subscriptions (`stateManager.subscribe`), and async level/asset loads.
- Comments only for non-obvious logic, especially timing-sensitive or lifecycle-related code.

## Subagent delegation workflow

All delegations are **context-preserving**: parent agent prefetches relevant MemPalace/repo context, infers scope, and includes explicit scope in subagent prompt.

### Orchestrator-first mode (default for every new chat)
- Treat each new chat as an **orchestrator session**.
- The orchestrator must: clarify requirements, produce a concrete plan, consult relevant subagents, and confirm the proposed approach with the user before implementation.
- Implementation starts only after user approval of the plan/approach.

### Mandatory execution pipeline
1. **Orchestrator**: collect context (MemPalace + repo), define scope, risks, and acceptance criteria.
2. **Specialist consultation** (as applicable):
	- BugHunter for correctness/edge-case risks.
	- PerformanceOptimizer for perf-sensitive systems.
	- TestGenerator for test strategy and concrete test cases.
	- DocCodeSync for documentation impact.
3. **User approval gate**: present synthesized plan and proceed only after approval.
4. **Coding agent implementation**: execute code changes strictly according to approved plan.
5. **Verification pass**:
	- BugHunter checks regressions/defensive gaps.
	- PerformanceOptimizer checks perf side effects when relevant.
	- TestGenerator implements/updates tests for the delivered scope.
	- DocCodeSync updates docs and memory when behavior/contracts changed.

### Role responsibilities
- **Orchestrator**: planning, decomposition, delegation, decision log, approval checkpoint.
- **Coding agent**: code implementation only (no silent scope expansion).
- **BugHunter**: bug/race/null/lifecycle analysis before and after implementation.
- **PerformanceOptimizer**: DevTools-profiler-oriented perf validation for affected systems.
- **TestGenerator**: required tests for the exact task scope.
- **DocCodeSync**: docs + memory synchronization after accepted behavior changes.

### Architecture and routing best practices
- **Complexity gate first**: prefer the simplest viable pattern (`single agent + tools` > `sequential` > `concurrent` > `handoff/group`) and escalate only when quality requires it.
- **Deterministic by default**: use sequential orchestration for predictable coding workflows (plan -> implement -> verify).
- **Concurrent only for independent checks**: run BugHunter/PerformanceOptimizer/TestGenerator in parallel only when they don't share mutable state.
- **Maker-checker loop for quality**: use coding-agent (maker) + BugHunter/TestGenerator (checker) with explicit pass/fail criteria.

### Delegation contract (required per subagent call)
Each subagent prompt must include:
1. **Task scope**: exact files/symbols/features in scope and out of scope.
2. **Inputs**: required context, constraints, and acceptance criteria.
3. **Output schema**: exact structure expected back (findings, risks, patches, tests, docs).
4. **Done criteria**: objective completion checks.
5. **Escalation condition**: when to stop and request orchestrator/user decision.

### Reliability and safety guards
- **Iteration limits**: max 2 refinement loops between maker-checker unless user approves another pass.
- **Handoff limits**: max 3 sequential handoffs before forced orchestrator review.
- **Timeout/retry policy**: retry failed specialist call once with narrowed prompt; on second failure degrade gracefully and continue with available evidence.
- **No silent failures**: propagate errors to orchestrator summary; never hide tool/subagent failures.
- **Risk-gated actions**: require explicit user approval before any broad/refactor-style or potentially disruptive change.

### Context and state management
- Pass only task-relevant context to each subagent; avoid full transcript forwarding by default.
- Use compact summaries between stages (problem, constraints, current decision, open risks).
- Persist stable decisions and conventions to memory (`wing=level_designer`) after completion.

### Conflict resolution and aggregation
- If specialist outputs conflict, orchestrator must produce a decision note:
	- competing options,
	- risk/cost tradeoff,
	- selected option and rationale,
	- residual risks.
- For parallel reviews, merge by severity first (correctness > safety > performance > style).

### Observability and run ledger
- Maintain a lightweight run ledger in responses:
	- active plan step,
	- delegated agents and outcomes,
	- approval checkpoints,
	- unresolved blockers.
- Ensure every final implementation report includes changed files, validation performed, and known limitations.

### Definition of done (task-level)
A task is complete only when all are true:
1. Approved plan implemented with no unauthorized scope expansion.
2. Correctness risks reviewed by BugHunter (or explicitly marked not applicable).
3. Performance impact reviewed by PerformanceOptimizer for perf-relevant tasks.
4. Tests added/updated by TestGenerator for behavior changes.
5. Docs/memory synchronized by DocCodeSync when contracts or behavior changed.

### CodeMaster (Code Review Specialist)
**When to delegate:**
- User phrases: "проверь код", "посмотри код", "глянь код", "ревью кода", "проанализируй реализацию"
- After implementing an editor feature: verify against this project's centralization rules (`docs/ARCHITECTURE.md`, `docs/COMMON_MISTAKES.md`)
- Before merging: audit for performance (GC/listener growth), architecture adherence, lifecycle safety

**Pre-delegation:**
- Fetch relevant code files (target scope or recent work)
- Prefetch CodeMaster's `wing=level_designer` MemPalace context (architecture patterns, prior review findings)
- Prepare: file path(s) + specific concern (or general code review)

**Expect return:**
- Code violations grouped by category (Architecture / Performance / Lifecycle / Pattern / Duplication)
- Refactoring suggestions WITHOUT implementation
- Priority and confidence levels

### PerformanceOptimizer (Canvas/Browser Performance Specialist)
**When to delegate:**
- User phrases: "оптимизируй код", "профилирование", "производительность", "тормозит", "фризы", "просадки FPS", "лагает canvas"
- DevTools Performance trace shows frame drops, long tasks, or a growing listener/memory count
- Before a large-level stress test: validate frame budget and memory growth
- After a feature: check for potential performance regression

**Pre-delegation:**
- Attach a DevTools Performance/Memory screenshot or trace excerpt, or describe the bottleneck
- Specify the interaction affected (pan/zoom/drag/select/load) and approximate level size (object count)
- Prefetch PerformanceOptimizer's `wing=level_designer` MemPalace context (known hotspots, prior optimization decisions)

**Expect return:**
- Bottleneck analysis (main-thread time / allocation rate / listener count / memory delta, sorted by impact)
- Prioritized recommendations: action + expected gain + effort + risk + validation method
- Notes on whether the analysis is from real profiling data or static code review

### BugHunter (Crash Prevention & Edge Case Specialist)
**When to delegate:**
- User phrases: "баг", "ошибка", "крах", "null reference", "race condition", "утечка памяти", "edge case"
- Investigating a browser console error or stack trace
- Preempting listener/state leaks before merging
- Designing a stress scenario for drag/marquee/undo-redo or async level load

**Pre-delegation:**
- Attach error log/stack trace or describe the reproduction scenario
- Specify context: which module, lifecycle phase (load / interaction / teardown), async involvement
- Provide the edge case or stress scenario description
- Prefetch BugHunter's `wing=level_designer` MemPalace context (lifecycle checklist, known race patterns)

**Expect return:**
- Bug reproduction path (when/why it happens, not always obvious)
- Root cause analysis with file/line reference
- Defensive fix proposal (strategy, effort, risk)
- Suggested manual browser-console test to prevent recurrence

### DocCodeSync (Documentation Alignment Specialist)
**When to delegate:**
- User phrases: "сверь доки", "сверить документацию", "обнови доки", "обновить документацию", "актуализировать docs"
- After implementing a feature: sync documentation
- On conflict: resolve doc vs. code divergence (code is source of truth)

**Pre-delegation:**
- Prefetch affected documentation files (`docs/`, `Context_map.md`)
- Infer scope from recent chat context (feature area, modified systems)
- Optional: specify accuracy criteria or doc sections to prioritize

**Expect return:**
- Updated docs with inline explanations of changes
- List of fixed mismatches, removed outdated claims
- Unresolved gaps or documentation TODOs

### TestGenerator (Manual/Browser-Console QA Specialist)
**When to delegate:**
- User phrases: "написать тесты", "тестирование", "покрытие", "напиши тест для", "проверить вручную"
- Need a browser-console test script or manual QA checklist for an untested system
- Stress testing edge cases (large levels, rapid undo/redo, malformed level JSON)

**Pre-delegation:**
- Specify target system/module to test (file path or class name)
- Indicate test type: scriptable browser-console assertions vs. manual visual checklist
- Attach existing tests if extending coverage (`src/event-system/*Test.js`)
- Optional: note specific edge cases or lifecycle transitions to test

**Expect return:**
- Full, runnable browser-console test module (following the `*Test.js` pattern) or a structured manual QA checklist
- Coverage report: tested scenarios + identified gaps + priority ranking

---

## Delegation rules (all subagents)
1. **Preserve context**: Include inferred scope + recent work context in delegation prompt
2. **No re-discovering**: Prefetch MemPalace + repository context before delegating; don't make subagent re-read
3. **Explicit output contract**: Subagent returns structured analysis/recommendations, NOT code edits (except DocCodeSync, which edits docs only, and TestGenerator, which writes test files)
4. **Fallback on MemPalace unavailability**: If MCP offline, delegate with repository-only context
5. **Update memory on completion**: After successful delegation, store new learnings in MemPalace via `mempalace_add_drawer` or `mempalace_kg_add`
6. **Approval before coding**: Do not start implementation until the orchestrator presents the plan and receives user approval
7. **Test delegation default**: For test-writing tasks, route implementation to TestGenerator by default
8. **No direct bypass**: Do not skip specialist consultation when task scope explicitly matches a specialist role
9. **Enforce delegation contract**: Every subagent call must include scope, expected output schema, done criteria, and escalation condition
10. **Loop and handoff caps**: Respect iteration/handoff limits unless user explicitly extends them
11. **Conflict note required**: If specialist recommendations disagree, orchestrator must document the final decision and tradeoff

## Subagent access fallback (effective mode)
- Default expectation: all subagents must have full workspace file/tool access for their role.
- Any missing subagent file access is treated as an environment/runtime failure, not a normal operating mode.
- Subagents are recommended, not blocking: if a subagent cannot access workspace files/tools in the current session, do not stop task execution.
- On subagent access failure, immediately fall back to direct workspace tools (read/edit/search/test) in the main agent and continue to completion.
- One retry maximum for the same subagent with narrowed prompt; after second failure, continue without that subagent and report this briefly.
- For code review requests, if CodeMaster cannot read files, perform review directly from repository files with the same severity-first format.
- For test-writing requests, if TestGenerator cannot modify/read files, main agent must implement tests directly.
- For bug/perf reviews, if BugHunter/PerformanceOptimizer are unavailable, main agent performs the same checks directly and records assumptions.
- Do not require user approval to switch into fallback mode when the only blocker is subagent tool access.
