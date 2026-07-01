# Claude Code Instructions for Level Designer

## Memory-first workflow

- Treat MemPalace as the primary context source for project architecture, systems, and decisions — not the built-in per-session auto-memory.
- At the start of a session involving this project, call MemPalace MCP tools first: `mempalace_search` scoped to `wing=level_designer`, then `mempalace_traverse`/`mempalace_get_drawer` for exact context.
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

1. **Update docs** — run the `DocCodeSync` subagent (or update manually) to reflect the change in `docs/`, `Context_map.md`, and `docs/CHANGELOG.md`. Even minor fixes warrant a CHANGELOG entry.
2. **Update MemPalace** — persist any stable architectural facts, design decisions, or newly discovered patterns via `mempalace_add_drawer` / `mempalace_update_drawer` and `mempalace_kg_add` if relevant.
3. **Update local auto-memory** — only for always-on behavioral triggers (e.g., rate-limit handling, response language). Everything else goes to MemPalace, not local files.
4. **Browser verification** — confirm the fix via `chrome-devtools` MCP (`list_console_messages`, `evaluate_script` for state check). Only then declare the task complete.

Do not skip these steps even for "small" fixes — consistency is what keeps docs and memory trustworthy over time.

## Response style

- Отвечать на русском языке (см. также локальную auto-memory).
- Keep answers concrete and action-oriented.
- Do not ask the user to save/update memory manually — handle memory updates internally via MemPalace tools when a stable fact is discovered.

## Browser verification (chrome-devtools MCP)

- The editor server is **always already running** at `http://localhost:8000/index.html` (per `Context_map.md` — never start `python -m http.server`/`npx serve`/`start_Editor.bat` yourself).
- Use the `chrome-devtools` MCP tools to verify changes instead of asking the user to check manually: `navigate_page` to `http://localhost:8000/index.html`, perform the interaction (`click`/`fill`/`drag`/`press_key`), then `list_console_messages` to check for errors/warnings before declaring a fix done.
- `take_screenshot`/`take_snapshot` for visual confirmation of UI changes; `list_network_requests`/`get_network_request` when debugging level/asset load issues.
- `evaluate_script` can call `levelEditor`/`stateManager` APIs directly in the page context for state inspection — prefer this over guessing from code alone.
- Always re-check `list_console_messages` after the interaction, not just on page load — most bugs here surface during interaction (drag, undo/redo, dialog open/close), not at startup.
- If `chrome-devtools` MCP is unavailable this session, say so explicitly and fall back to static code review.

## Specialist subagents

This project also defines five specialist subagents (`.claude/agents/`): **CodeMaster** (review), **BugHunter** (defensive/edge-case analysis), **PerformanceOptimizer** (Canvas/DOM performance), **DocCodeSync** (docs sync), **TestGenerator** (browser-console tests). Prefetch relevant `wing=level_designer` MemPalace context before delegating to any of them, and persist their findings back to MemPalace after the task completes. See `.github/copilot-instructions.md` for the full delegation pipeline — it applies the same way here.
