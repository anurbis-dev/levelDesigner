/**
 * ProjectSettingsDialog - project-scope settings (as opposed to Editor Settings,
 * which are personal/global). Intentionally a stub for now (plan section 12, item 9):
 * only the project name is editable. Candidate future fields — default asset import
 * path, default grid/snap for new levels in this project, naming convention — are
 * still undecided and were deliberately left out rather than guessed at.
 */

import { BaseDialog } from './BaseDialog.js';
import { Project } from '../models/Project.js';
import { Logger } from '../utils/Logger.js';

export class ProjectSettingsDialog extends BaseDialog {
    constructor(levelEditor) {
        super({
            id: 'project-settings-dialog',
            title: 'Project Settings',
            width: 'auto',
            height: 'auto',
            showCloseButton: true,
            showFooter: true,
            footerButtons: [
                { id: 'cancel', text: 'Cancel', class: 'dialog-btn-cancel', backgroundColor: '#6b7280', textColor: 'white' },
                { id: 'confirm', text: 'Save', class: 'dialog-btn-confirm', backgroundColor: '#2563eb', textColor: 'white' }
            ],
            contentRenderer: () => this.renderProjectSettingsContent(),
            onConfirm: () => this.commitChanges(),
            levelEditor
        });

        this.levelEditor = levelEditor;
    }

    show() {
        // Lazily create the project on first use — the dialog can be opened before
        // the user has ever run New/Open/Save Project.
        if (!this.levelEditor.project) {
            this.levelEditor.project = new Project();
        }
        super.show();
    }

    renderProjectSettingsContent() {
        const project = this.levelEditor.project;
        const name = this._escapeHtml(project?.name ?? 'Untitled Project');

        return `
            <div class="project-settings-content" style="padding: 0.5rem 1rem;">
                <div class="settings-form-item" style="margin-bottom: 1rem;">
                    <label for="project-settings-name" style="display: block; margin-bottom: 0.25rem; color: var(--ui-text-color, #d1d5db);">Project Name</label>
                    <input type="text" id="project-settings-name" value="${name}"
                        style="width: 100%; box-sizing: border-box; padding: 0.375rem 0.5rem; background: #111827; border: 1px solid #374151; border-radius: 4px; color: var(--ui-text-color, #d1d5db);">
                </div>
                <p style="color: var(--ui-text-color, #9ca3af); font-size: 0.875rem; margin: 0;">
                    Additional project-wide settings (default asset import path, default grid/snap
                    for new levels, naming convention) are planned for a future update.
                </p>
            </div>
        `;
    }

    commitChanges() {
        if (!this.levelEditor.project) return;

        const input = this.container?.querySelector('#project-settings-name');
        const newName = input?.value?.trim();
        if (newName) {
            this.levelEditor.project.name = newName;
            this.levelEditor.project.isDirty = true;
        }

        Logger.ui.info('ProjectSettingsDialog: settings saved');
    }

    /**
     * @private
     */
    _escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
