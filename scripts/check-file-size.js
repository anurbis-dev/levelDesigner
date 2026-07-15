#!/usr/bin/env node
/**
 * Line-limit guardrail (400 lines).
 * Fails on any src/**\/*.js file over LINE_LIMIT that isn't in OVERRIDES.
 * Remove an entry only when the file is actually under the limit — do not raise limits.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const LINE_LIMIT = 400;
const SRC_DIR = new URL('../src', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');

// Known files still over LINE_LIMIT (legacy size / intentional dense modules).
const OVERRIDES = new Set([
    'ui/AssetPanel.js',
    'ui/AssetViewRenderer.js',
    'ui/AssetFoldersController.js',
    'core/LevelEditor.js',
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
    'ui/UniversalDialog.js',
    'utils/ScrollUtils.js',
    'ui/dock/DockContentRegistry.js',
    'ui/dock/DockRenderer.js',
    'core/ViewportViewManager.js'
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
    console.error('\nEither split the file, or add it to OVERRIDES in scripts/check-file-size.js with a short reason if intentional.');
    process.exit(1);
}

console.log(`File size check passed (limit ${LINE_LIMIT} lines, ${OVERRIDES.size} tracked overrides).`);
