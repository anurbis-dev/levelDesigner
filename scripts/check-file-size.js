#!/usr/bin/env node
/**
 * Фаза 1.2 (tmp/2D_Editor_REFACTOR_PLAN.md) — line-limit guardrail.
 * Fails on any src/**\/*.js file over LINE_LIMIT that isn't in the override
 * allowlist below. The allowlist is a snapshot of files already over the
 * limit when this script was introduced — remove an entry once that file's
 * decomposition phase (see the plan) actually shrinks it back under the
 * limit, don't just raise its number.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const LINE_LIMIT = 400;
const SRC_DIR = new URL('../src', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');

// TODO remove entries as each file's phase in tmp/2D_Editor_REFACTOR_PLAN.md lands.
const OVERRIDES = new Set([
    'ui/AssetPanel.js',              // Фаза 4 done (3099->1154); orchestration layer, still above 400
    'ui/AssetViewRenderer.js',       // Фаза 4.2 extraction from AssetPanel.js — single-responsibility render module, not further split
    'ui/AssetFoldersController.js',  // Фаза 4.1 extraction from AssetPanel.js — folder/tab navigation module, not further split
    'core/LevelEditor.js',           // Фаза 3 done (2399->1583); remainder is backlog, not a named phase
    'ui/panels/TabLayoutController.js',  // Фаза 4.5.1 extraction from PanelPositionManager.js — single-responsibility layout module, not further split
    'ui/panels/TabDragController.js',    // Фаза 4.5.3 extraction from PanelPositionManager.js — single-responsibility drag protocol module, not further split
    'ui/panels/SplitPaneController.js',  // Фаза 4.5.4 extraction from PanelPositionManager.js — single-responsibility split-pane window manager, not further split
    'ui/LayersPanel.js',
    'event-system/MouseHandlers.js',
    'core/RenderOperations.js',
    'ui/SettingsPanel.js',
    'event-system/EventHandlers.js',
    'ui/OutlinerPanel.js',
    'ui/DetailsPanel.js',
    'ui/Toolbar.js',
    'ui/panel-structures/SettingsPanelRenderers.js',
    'utils/SettingsSyncManager.js',
    'ui/BaseContextMenu.js',
    'managers/ConfigManager.js',
    'utils/AssetImporter.js',
    'models/Level.js',
    'ui/AssetTabsManager.js',
    'core/ObjectOperations.js',
    'ui/LevelsPanel.js',
    'ui/FoldersPanel.js',
    'event-system/EventHandlerManager.js',
    'managers/MenuManager.js',
    'core/GroupOperations.js',
    'utils/WorldPositionUtils.js',
    'managers/AssetManager.js',
    'utils/SelectionUtils.js',
    'utils/ErrorHandler.js',
    'event-system/EventHandlerUtils.js',
    'utils/Logger.js',
    'managers/StateManager.js',
    'ui/ActorPropertiesWindow.js',
    'ui/BaseDialog.js',
    'ui/CanvasRenderer.js',
    'core/LayerOperations.js',
    'core/DuplicateOperations.js',
    'ui/UniversalDialog.js'
]);

function walk(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            walk(full, files);
        } else if (entry.endsWith('.js')) {
            files.push(full);
        }
    }
    return files;
}

const violations = [];
const staleOverrides = [];

for (const file of walk(SRC_DIR)) {
    const relPath = relative(SRC_DIR, file).split('\\').join('/');
    const lineCount = readFileSync(file, 'utf8').split('\n').length;

    if (lineCount > LINE_LIMIT) {
        if (!OVERRIDES.has(relPath)) {
            violations.push({ relPath, lineCount });
        }
    } else if (OVERRIDES.has(relPath)) {
        staleOverrides.push({ relPath, lineCount });
    }
}

if (staleOverrides.length > 0) {
    console.log(`Note: ${staleOverrides.length} override(s) are now under the ${LINE_LIMIT}-line limit — remove from OVERRIDES in scripts/check-file-size.js:`);
    staleOverrides.forEach(({ relPath, lineCount }) => console.log(`  ${relPath} (${lineCount} lines)`));
}

if (violations.length > 0) {
    console.error(`\nFile size check FAILED — ${violations.length} file(s) exceed ${LINE_LIMIT} lines and are not in the known-overrides allowlist:`);
    violations.forEach(({ relPath, lineCount }) => console.error(`  ${relPath} (${lineCount} lines)`));
    console.error('\nEither split the file, or if it is a pre-existing God Object being tracked in tmp/2D_Editor_REFACTOR_PLAN.md, add it to OVERRIDES in scripts/check-file-size.js with a TODO referencing the phase that will shrink it.');
    process.exit(1);
}

console.log(`File size check passed (limit ${LINE_LIMIT} lines, ${OVERRIDES.size} tracked overrides).`);
