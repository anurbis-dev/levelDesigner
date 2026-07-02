# Qwen Code Instructions for Level Designer

## Memory-first workflow

- Treat MemPalace as the primary context source for project architecture, systems, and decisions — not the built-in `save_memory` tool.
- At the start of a session involving this project, call MemPalace MCP tools first: `mempalace_search` scoped to `wing=level_designer`, then `mempalace_traverse`/`mempalace_get_drawer` for exact context. **Skip for trivial tasks** (typo fix, config-only change, "what does X mean" question — no code change needed).
- Do not ask to re-read project markdown files when MemPalace already covers the topic.
- Read repository files only for verification, code edits, or when memory coverage is missing.
- If memory and code conflict, prefer current code and report the conflict explicitly.
- After resolving a task, persist newly discovered stable facts back to MemPalace (`mempalace_add_drawer` and optional `mempalace_kg_add`) instead of (or in addition to) `save_memory`.

### MemPalace self-healing workflow

- If MemPalace MCP is online but retrieval looks empty/stale/noisy after recent mining, self-heal before asking the user.
- Run `mempalace_reconnect` first to refresh in-memory index state.
- Re-run a narrow `mempalace_search` query in `wing=level_designer` to verify recovery.
- If still stale, verify MCP and CLI use the same palace path (`E:\AI_tools\mempalace-palace`).
- If path is correct but data is still stale, restart the MemPalace MCP server and retry search/traverse.
- Only after these steps, report the issue briefly and continue with repository evidence as fallback.
- If MemPalace is temporarily unavailable (e.g., MCP server not yet connected this session), fall back to repository evidence.

## Response style

- Отвечать на русском языке.
- Только суть: без вступлений, вежливости, «отличный вопрос», «как видно из», «стоит отметить».
- Не пересказывать вопрос и не анонсировать что сейчас будет сделано — сразу результат.
- Ссылки на код: `ClassName.method` или `file:line` — без описания что делает функция/переменная.
- Куски кода «было → стало» в чат не отправлять если не просят явно. Изменение описывается одной строкой: `file:line — что и почему (если не очевидно)`.
- Одно предложение на факт/действие. Без воды.
- Do not ask the user to save/update memory manually — handle memory updates internally via MemPalace tools when a stable fact is discovered.

## Browser verification (chrome-devtools MCP)

- The editor server is **always already running** at `http://localhost:8000/index.html` (per `Context_map.md` — never start `python -m http.server`/`npx serve`/`start_Editor.bat` yourself).
- If `chrome-devtools` MCP is unavailable this session, say so explicitly and fall back to static code review.

### Verification tier — choose the lightest tier that covers the change

| Tier | Change type | Steps |
|------|-------------|-------|
| **Skip** | Docs / CHANGELOG / config only | No browser check needed |
| **Lightweight** | Logic / JS fix, no UI change | `evaluate_script` state check → `list_console_messages` (errors only) |
| **Standard** | Behavior change with interaction | `evaluate_script` → trigger interaction → `list_console_messages` |
| **Full** | UI layout / visual / render change | Standard + `take_screenshot` |

**Rules:**
- Start with `evaluate_script` calling `levelEditor`/`stateManager` APIs directly — cheaper than navigating and clicking.
- Only call `navigate_page` if the page needs a specific state that cannot be set via script.
- Never call `take_screenshot`/`take_snapshot` for non-visual changes — adds tokens with no diagnostic value.
- `list_network_requests`/`get_network_request` only when debugging level/asset load issues.
- Re-check `list_console_messages` *after* the interaction, not only on page load — most bugs surface during interaction (drag, undo/redo, dialog open/close).

## Specialist subagents

This project also defines five specialist subagents (`.qwen/agents/`): **CodeMaster** (review), **BugHunter** (defensive/edge-case analysis), **PerformanceOptimizer** (Canvas/DOM performance), **DocCodeSync** (docs sync), **TestGenerator** (browser-console tests). Before delegating, reuse MemPalace context already fetched at session start — only run an additional narrowed `mempalace_search` if the subagent scope differs significantly from what was already loaded. Persist subagent findings back to MemPalace after the task completes. See `.github/copilot-instructions.md` for the full delegation pipeline — it applies the same way here.
