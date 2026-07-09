# Claude Code Instructions for Level Designer

## Memory-first workflow

- Treat MemPalace as the primary context source for project architecture, systems, and decisions — not the built-in per-session auto-memory.
- At the start of a session involving this project, call MemPalace MCP tools first: `mempalace_search` scoped to `wing=level_designer`, then `mempalace_traverse`/`mempalace_get_drawer` for exact context. **Skip for trivial tasks** (typo fix, config-only change, "what does X mean" question — no code change needed).
- `mempalace_search` returns verbatim full drawer content, not summaries — always bound calls to control token cost: `limit=3` (raise only if the first pass misses), `max_distance≈0.8` (tighter than the 1.5 default, drops weak matches), add `room` filter alongside `wing` whenever the room is known, and keep `query` to bare keywords (no restated task text). Prefer a narrow `search` first, then `mempalace_get_drawer` by ID for specific follow-up instead of widening `limit`.
- Do not ask to re-read project markdown files when MemPalace already covers the topic.
- Read repository files only for verification, code edits, or when memory coverage is missing.
- If memory and code conflict, prefer current code and report the conflict explicitly.
- After resolving a task, persist newly discovered stable facts back to MemPalace (`mempalace_add_drawer` and optional `mempalace_kg_add`) instead of (or in addition to) the local auto-memory files.

### MemPalace self-healing workflow

- If MemPalace MCP is online but retrieval looks empty/stale/noisy after recent mining, self-heal before asking the user.
- Run `mempalace_reconnect` first to refresh in-memory index state.
- Re-run a narrow `mempalace_search` query in `wing=level_designer` to verify recovery.
- If still stale, verify MCP and CLI use the same palace path (`E:\AI_tools\mempalace-palace`).
- If path is correct but data is still stale, restart the MemPalace MCP server and retry search/traverse.
- Only after these steps, report the issue briefly and continue with repository evidence as fallback.
- If MemPalace is temporarily unavailable (e.g., MCP server not yet connected this session), fall back to the local auto-memory files and repository evidence.

## Post-fix mandatory steps

After completing any code fix or feature implementation, always execute these steps in order before reporting done:

1. **Update docs** — tier by change scope:
   - **Minor fix** (isolated JS change, no new API or behavior contract): directly append 1-line entry to `docs/CHANGELOG.md` only. Do not spawn DocCodeSync.
   - **Behavioral / API change** (new feature, changed contract, new module): run `DocCodeSync` subagent to sync `docs/`, `Context_map.md`, and `docs/CHANGELOG.md`.
   - **`docs/CHANGELOG.md` stays unreleased-only**: it must contain only entries not yet in a git commit. At the moment of `git commit` touching `docs/CHANGELOG.md`, before committing, move everything already committed (i.e. the pre-commit `HEAD` content of the file) into `docs/CHANGELOG_ARCHIVE.md` (prepend, keep newest-first) and leave `CHANGELOG.md` holding only the new entries from this commit. Never let `CHANGELOG.md` re-accumulate multiple releases' worth of history — full history lives in `CHANGELOG_ARCHIVE.md` / `git log`.
2. **Update MemPalace** — persist any stable architectural facts, design decisions, or newly discovered patterns via `mempalace_add_drawer` / `mempalace_update_drawer` and `mempalace_kg_add` if relevant.
3. **Update local auto-memory** — only for always-on behavioral triggers (e.g., rate-limit handling, response language). Everything else goes to MemPalace, not local files.
4. **Browser verification** — confirm the fix via `chrome-devtools` MCP (`list_console_messages`, `evaluate_script` for state check). Only then declare the task complete.

Do not skip these steps even for "small" fixes — consistency is what keeps docs and memory trustworthy over time.

## Iteration loop mode

Triggered only by explicit user phrases: "сделай в лупе", "используй луп", "луп эту ошибку", "loop this". Not the default workflow — regular tasks use a single pass.

- Use only when the task has an **objectively checkable** success criterion (reproducible bug, failing test, clear acceptance criteria). If the ask is exploratory/ambiguous, say so instead of looping.
- Cap at **6 iterations**. If criteria aren't met by then, stop, report remaining gaps, and ask how to proceed — do not loop indefinitely burning tokens on an unclear target.
- Each iteration: PLAN (next single step) → EXECUTE → CHECK → DECISION.
- **CHECK must be objective, never self-graded prose scores.** Use whichever applies: actual test run, `chrome-devtools` verification tier (see below) with real console/state output, or an independent subagent (CodeMaster/BugHunter) reviewing the diff. A pass/fail per criterion, not a 1-10 vibe rating.
- DECISION: all criteria pass → stop and report `FINAL`. Otherwise `ITERATING`, fix the single worst-failing criterion next, continue.
- Run **Post-fix mandatory steps** once after the loop ends (`FINAL`), not on every iteration — avoids doc/memory update spam.
- No mid-loop clarifying questions unless genuinely blocked (missing input, destructive action, decision only the user can make) — same bar as Auto Mode generally.

## Response style

- Отвечать на русском языке.
- Только суть: без вступлений, вежливости, «отличный вопрос», «как видно из», «стоит отметить».
- Не пересказывать вопрос и не анонсировать что сейчас будет сделано — сразу результат.
- Ссылки на код: `ClassName.method` или `file:line` — без описания что делает функция/переменная.
- Куски кода «было → стало» в чат не отправлять если не просят явно. Изменение описывается одной строкой: `file:line — что и почему (если не очевидно)`.
- Одно предложение на факт/действие. Без воды.
- Do not ask the user to save/update memory manually — handle memory updates internally via MemPalace tools when a stable fact is discovered.
- **Режим максимальной экономии токенов**: любой промежуточный статус/описание действия — 2-4 слова, не полное предложение. Пример: «Проверка памяти MemPalace на последние обновления внесённые после правок согласно последним правкам и файлам в проекте» → «Проверка MemPalace». Это касается и текста между тулкол(l)ами, и описаний в Agent/TodoWrite — сокращать до сути, без причин/контекста/перечисления шагов.

## Browser verification (chrome-devtools MCP)

- The editor server runs at **`http://localhost:3000/index.html`** via `npx serve` (never start another server yourself).
- Global JS variable in the page is **`editor`** (not `levelEditor`) — use `editor.renderOperations`, `editor.stateManager`, etc.
- If `chrome-devtools` MCP is unavailable this session, say so explicitly and fall back to static code review.

### Правильный workflow подключения к браузеру

1. Сначала `list_pages` — увидеть уже открытые вкладки.
2. Если редактор открыт → `select_page` по ID, затем `evaluate_script`. **Не вызывай `navigate_page` если страница уже есть.**
3. Если страницы нет → `navigate_page` к `http://localhost:3000/index.html`.
4. `chrome-devtools` MCP запускается с `--isolated` (`.mcp.json`) — временный профиль на каждый запуск, конфликтов "already running" между сессиями быть не должно. Если всё же возникнет — зависший процесс, убить через `Stop-Process -Id <PID> -Force` (PID искать через `netstat -ano | Select-String ":3000"`).

### Verification tier — choose the lightest tier that covers the change

| Tier | Change type | Steps |
|------|-------------|-------|
| **Skip** | Docs / CHANGELOG / config only | No browser check needed |
| **Lightweight** | Logic / JS fix, no UI change | `evaluate_script` state check → `list_console_messages` (errors only) |
| **Standard** | Behavior change with interaction | `evaluate_script` → trigger interaction → `list_console_messages` |
| **Full** | UI layout / visual / render change | `evaluate_script`/`list_console_messages` only — **do not** `take_screenshot`, visual check is the user's job |

**Rules:**
- Start with `evaluate_script` calling `editor`/`editor.stateManager` APIs directly — cheaper than navigating and clicking.
- Only call `navigate_page` if the page needs a specific state that cannot be set via script.
- Never call `take_screenshot`/`take_snapshot`, even for UI/layout/visual/render changes — the agent never judges "does it look right" visually; that's always the user's job. Verify only via console/state, then stop.
- `list_network_requests`/`get_network_request` only when debugging level/asset load issues.
- Re-check `list_console_messages` *after* the interaction, not only on page load — most bugs surface during interaction (drag, undo/redo, dialog open/close).
- После тестов не нужно возвращать страницу в чистое состояние — следующий агент сам перезагрузит страницу перед своей проверкой.

## Session & token hygiene

- Long sessions get expensive even with caching: `/compact` mid-task once debug output/tool results are no longer needed; `/clear` when switching to a new, unrelated task instead of reusing the session.
- `chrome-devtools` MCP results stay in context for the rest of the session and are the main cost driver — if a session doesn't touch UI/browser behavior, keep the server disabled/unused for that session.
- `list_console_messages`/`list_network_requests` return accumulated history, not a diff — call them right after the relevant interaction, not repeatedly across a long-lived page session.

## Specialist subagents

This project also defines six specialist subagents (`.claude/agents/`): **CodeMaster** (review), **BugHunter** (defensive/edge-case analysis), **PerformanceOptimizer** (Canvas/DOM performance), **DocCodeSync** (docs sync), **TestGenerator** (browser-console tests), **Coder** (haiku, implementation-only). Before delegating, reuse MemPalace context already fetched at session start — only run an additional narrowed `mempalace_search` if the subagent scope differs significantly from what was already loaded. Persist subagent findings back to MemPalace after the task completes. See `.github/copilot-instructions.md` for the full delegation pipeline — it applies the same way here.

### Coder (cheap-model implementer) — orchestrator responsibilities

- The main session agent is orchestrator/planner first — prefer delegating actual code writing to **Coder** (haiku) once a plan exists, instead of writing code directly in the main session.
- **Never delegate to Coder without a detailed, file/line-level plan.** Coder runs on a cheap model and does not make architecture/design decisions — it types out what's already been decided. If the task has open design questions, ambiguous scope, or requires inventing a new pattern, keep it in the main session (or route through CodeMaster/BugHunter first to pin down the plan) rather than delegating.
- Good candidates for Coder: mechanical/boilerplate changes, changes matching an existing pattern 1:1, edits where CodeMaster/BugHunter already specified exact file+fix.
- Bad candidates: new architecture, ambiguous requirements, anything touching more than ~2-3 files without per-file instructions, first-of-its-kind features.
- Coder's output is a fast-path or step-4 (post-approval) implementer — CodeMaster/BugHunter verification still runs after it per the existing pipeline; treat a Coder implementation exactly like a main-session implementation for the purposes of the verification pass.
- If Coder reports it stopped/escalated because the plan was underspecified, treat that as a signal to add detail, not to override and force it to guess.
