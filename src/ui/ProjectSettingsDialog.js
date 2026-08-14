/**
 * ProjectSettingsDialog - project-scope settings (as opposed to Editor Settings,
 * which are personal/global). Name is stored on Project; the working folder is
 * machine-local (IndexedDB handle, Pixis FSA pattern) and is not serialized.
 */

import { BaseDialog } from './BaseDialog.js';
import { Project } from '../models/Project.js';
import { Logger } from '../utils/Logger.js';
import { FsaStore } from '../utils/FsaStore.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';

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
            onShow: () => this._wireFolderButtons(),
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
        this.contentRendered = false;
        super.show();
    }

    renderProjectSettingsContent() {
        const project = this.levelEditor.project;
        const name = this._escapeHtml(project?.name ?? 'Untitled Project');
        const supported = FsaStore.isSupported();
        const folderName = FsaStore.getWorkingDirectoryName();
        const folderLabel = folderName || (supported ? 'Not set' : 'Not supported in this browser');

        return `
            <div class="project-settings-content" style="padding: 0.5rem 1rem; min-width: 22rem;">
                <div class="settings-form-item" style="margin-bottom: 1rem;">
                    <label for="project-settings-name" style="display: block; margin-bottom: 0.25rem; color: var(--ui-text-color, #d1d5db);">Project Name</label>
                    <input type="text" id="project-settings-name" value="${name}"
                        style="width: 100%; box-sizing: border-box; padding: 0.375rem 0.5rem; background: #111827; border: 1px solid #374151; border-radius: 4px; color: var(--ui-text-color, #d1d5db);">
                </div>
                <div class="settings-form-item" style="margin-bottom: 0.5rem;">
                    <label style="display: block; margin-bottom: 0.25rem; color: var(--ui-text-color, #d1d5db);">Project Folder</label>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span id="project-folder-name" title="${this._escapeHtml(folderName || '')}"
                            style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-text-color, #d1d5db); font-size: 0.875rem;">${this._escapeHtml(folderLabel)}</span>
                        <button type="button" id="project-folder-choose" ${supported ? '' : 'disabled'}
                            style="padding: 0.25rem 0.625rem; background: #2563eb; border: none; border-radius: 4px; color: white; cursor: pointer;">Choose…</button>
                        <button type="button" id="project-folder-clear" ${supported && folderName ? '' : 'disabled'}
                            style="padding: 0.25rem 0.625rem; background: #6b7280; border: none; border-radius: 4px; color: white; cursor: pointer;">Clear</button>
                    </div>
                    <p style="color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin: 0.375rem 0 0;">
                        Grant write access once to the Level Designer folder (or its content/ folder).
                        New and updated content files then write there without a browser save dialog.
                    </p>
                </div>
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
    _wireFolderButtons() {
        const choose = this.container?.querySelector('#project-folder-choose');
        const clear = this.container?.querySelector('#project-folder-clear');
        if (choose) {
            eventHandlerManager.registerElement(choose, {
                click: async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const handle = await FsaStore.pickWorkingDirectory();
                    if (handle) this._refreshFolderUi();
                }
            }, 'project-folder-choose');
        }
        if (clear) {
            eventHandlerManager.registerElement(clear, {
                click: async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await FsaStore.clearWorkingDirectory();
                    this._refreshFolderUi();
                }
            }, 'project-folder-clear');
        }
    }

    /**
     * @private
     */
    _refreshFolderUi() {
        const supported = FsaStore.isSupported();
        const folderName = FsaStore.getWorkingDirectoryName();
        const nameEl = this.container?.querySelector('#project-folder-name');
        const clear = this.container?.querySelector('#project-folder-clear');
        if (nameEl) {
            nameEl.textContent = folderName || (supported ? 'Not set' : 'Not supported in this browser');
            nameEl.title = folderName || '';
        }
        if (clear) clear.disabled = !(supported && folderName);
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
