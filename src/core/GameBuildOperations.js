import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { FileUtils } from '../utils/FileUtils.js';

/**
 * Game menu "Build..." entry (engine plan §4, tmp/2D_Editor_ENGINE_PLAN.md). The
 * browser editor has no shell/fs access to run esbuild directly — this saves the
 * current project (same file `File > Save Project` produces) and generates a
 * Windows .bat that runs `npm run build:game` for the user. The .bat and the saved
 * project file both need to end up in the project root (next to package.json) —
 * same placement convention as the existing start_Editor.bat.
 */
export class GameBuildOperations extends BaseModule {
    async buildGame() {
        await this.editor.saveProject();
        const fileName = this.editor.project?.fileName;
        if (!fileName) {
            Logger.status.error('Build: could not determine the saved project file name');
            return;
        }

        const batName = this._buildBatFileName(this.editor.project?.name);
        // Plain download (not FileUtils.saveDataDirectly's native save-picker) —
        // the picker's 10s ExtensionErrorUtils.withTimeout race doesn't cancel the
        // underlying showSaveFilePicker() promise on timeout, so a slow pick would
        // fire BOTH the download fallback and (if the user then completes the still-
        // open dialog) the picker's own write, saving the .bat twice.
        FileUtils.downloadData(this._buildBatScript(fileName), batName, FileUtils.TYPES.TEXT, false);

        Logger.status.success(
            `Build: saved "${fileName}" and "${batName}" — put both next to package.json (project root), then run the .bat`
        );
    }

    /** @private */
    _buildBatFileName(projectName) {
        if (!projectName || projectName === 'Untitled Project') return 'build-game.bat';
        const safe = projectName.replace(/[\\/:*?"<>|]/g, '-').trim();
        return safe ? `build-${safe}-game.bat` : 'build-game.bat';
    }

    /** @private */
    _buildBatScript(projectFileName) {
        const safeName = projectFileName.replace(/"/g, '');
        return [
            '@echo off',
            'setlocal',
            'cd /d "%~dp0"',
            'if not exist package.json (',
            '  echo This file must sit in the levelDesigner project root, next to package.json.',
            '  pause',
            '  exit /b 1',
            ')',
            `if not exist "${safeName}" (`,
            `  echo Project file "${safeName}" not found next to this .bat.`,
            '  echo Move your saved project file here and run this again.',
            '  pause',
            '  exit /b 1',
            ')',
            `call npm run build:game -- --project="${safeName}" --out=dist\\game`,
            'pause'
        ].join('\r\n');
    }

    destroy() {
        Logger.lifecycle.info('GameBuildOperations module destroyed.');
    }
}
