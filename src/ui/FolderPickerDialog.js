/**
 * Folder Picker Dialog
 * Custom dialog for selecting folders, styled to match the editor
 */
export class FolderPickerDialog {
    constructor() {
        this.overlay = null;
        this.dialog = null;
        this.selectedPath = null;
        this.selectedFiles = null;
        this.selectedDirectoryHandle = null;
        this.resolve = null;
        this.reject = null;
    }

    /**
     * Show folder picker dialog
     * @returns {Promise<string|null>} Selected folder name or null
     */
    async show() {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.createDialog();
            this.showDialog();
        });
    }

    /**
     * Create the dialog HTML structure
     */
    createDialog() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'folder-picker-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        `;

        // Create dialog container
        this.dialog = document.createElement('div');
        this.dialog.id = 'folder-picker-dialog';
        this.dialog.style.cssText = `
            background-color: #1f2937;
            border: 1px solid #374151;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            min-width: 500px;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            background-color: #111827;
            border-bottom: 1px solid #374151;
            padding: 1rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        const title = document.createElement('h2');
        title.textContent = 'Select Assets Folder';
        title.style.cssText = `
            color: #f9fafb;
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #9ca3af;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = '#f9fafb';
            closeBtn.style.backgroundColor = '#374151';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = '#9ca3af';
            closeBtn.style.backgroundColor = 'transparent';
        });
        closeBtn.addEventListener('click', () => this.cancel());

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Create content
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 1.5rem;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        `;

        // Description
        const description = document.createElement('div');
        description.innerHTML = `
            <p style="color: #d1d5db; font-size: 0.875rem; line-height: 1.5; margin: 0 0 0.5rem 0;">
                Choose a folder containing your game assets. The folder should contain subfolders for different asset categories (e.g., backgrounds, characters, items).
            </p>
            <p style="color: #9ca3af; font-size: 0.75rem; line-height: 1.4; margin: 0;">
                <strong>Browse...</strong> - Select folder (Chrome/Edge only)<br>
                <strong>Drag & Drop</strong> - Drag folder directly into the area below (all browsers)<br>
                <em>Note: Only folder name and file count will be displayed for security reasons.</em>
            </p>
        `;

        // Path input group
        const pathGroup = document.createElement('div');
        pathGroup.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        `;

        const pathLabel = document.createElement('label');
        pathLabel.textContent = 'Folder Path:';
        pathLabel.style.cssText = `
            color: #f9fafb;
            font-size: 0.875rem;
            font-weight: 500;
        `;

        const pathInputGroup = document.createElement('div');
        pathInputGroup.style.cssText = `
            display: flex;
            gap: 0.5rem;
        `;

        const pathInput = document.createElement('input');
        pathInput.type = 'text';
        pathInput.placeholder = 'Selected folder name will appear here';
        pathInput.id = 'folder-path-input';
        pathInput.style.cssText = `
            flex: 1;
            background-color: #374151;
            border: 1px solid #4b5563;
            border-radius: 4px;
            color: #f9fafb;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            font-family: monospace;
        `;
        pathInput.addEventListener('focus', () => {
            pathInput.style.borderColor = '#3b82f6';
            pathInput.style.outline = 'none';
        });
        pathInput.addEventListener('blur', () => {
            pathInput.style.borderColor = '#4b5563';
        });

        const browseBtn = document.createElement('button');
        browseBtn.textContent = 'Browse...';
        browseBtn.style.cssText = `
            background-color: #3b82f6;
            border: 1px solid #3b82f6;
            border-radius: 4px;
            color: #ffffff;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            cursor: pointer;
            white-space: nowrap;
        `;
        browseBtn.addEventListener('mouseenter', () => {
            browseBtn.style.backgroundColor = '#2563eb';
            browseBtn.style.borderColor = '#2563eb';
        });
        browseBtn.addEventListener('mouseleave', () => {
            browseBtn.style.backgroundColor = '#3b82f6';
            browseBtn.style.borderColor = '#3b82f6';
        });
        browseBtn.addEventListener('click', () => this.browseFolder(pathInput));

        pathInputGroup.appendChild(pathInput);
        pathInputGroup.appendChild(browseBtn);

        pathGroup.appendChild(pathLabel);
        pathGroup.appendChild(pathInputGroup);

        // Note: No hidden input needed as we use File System Access API and Drag & Drop

        // Drag & Drop area
        const dropArea = document.createElement('div');
        dropArea.id = 'folder-drop-area';
        dropArea.style.cssText = `
            border: 2px dashed #4b5563;
            border-radius: 8px;
            padding: 2rem;
            text-align: center;
            background-color: #111827;
            transition: all 0.2s ease;
            cursor: pointer;
        `;
        dropArea.innerHTML = `
            <div style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.5rem;">
                📁 Drag & Drop folder here
            </div>
            <div style="color: #6b7280; font-size: 0.75rem;">
                or click Browse... button above (Chrome/Edge only)
            </div>
        `;

        // Drag & Drop event handlers
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#3b82f6';
            dropArea.style.backgroundColor = '#1e3a8a';
        });

        dropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#4b5563';
            dropArea.style.backgroundColor = '#111827';
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '#4b5563';
            dropArea.style.backgroundColor = '#111827';
            
            const items = e.dataTransfer.items;
            if (items && items.length > 0) {
                this.handleDragDrop(items, pathInput);
            }
        });

        dropArea.addEventListener('click', () => {
            this.browseFolder(pathInput);
        });

        // Summary area
        const summaryArea = document.createElement('div');
        summaryArea.id = 'folder-summary-area';
        summaryArea.style.cssText = `
            background-color: #111827;
            border: 1px solid #374151;
            border-radius: 4px;
            padding: 1rem;
            margin-top: 1rem;
            display: none;
        `;
        summaryArea.innerHTML = `
            <div style="color: #f9fafb; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">
                Import Summary
            </div>
            <div id="summary-content" style="color: #d1d5db; font-size: 0.75rem;">
                No files selected
            </div>
        `;

        content.appendChild(description);
        content.appendChild(pathGroup);
        content.appendChild(dropArea);
        content.appendChild(summaryArea);

        // Create footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            background-color: #111827;
            border-top: 1px solid #374151;
            padding: 1rem 1.5rem;
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background-color: #374151;
            border: 1px solid #4b5563;
            border-radius: 4px;
            color: #f9fafb;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            cursor: pointer;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.backgroundColor = '#4b5563';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.backgroundColor = '#374151';
        });
        cancelBtn.addEventListener('click', () => this.cancel());

        const okBtn = document.createElement('button');
        okBtn.textContent = 'Import Assets';
        okBtn.id = 'import-assets-btn';
        okBtn.style.cssText = `
            background-color: #3b82f6;
            border: 1px solid #3b82f6;
            border-radius: 4px;
            color: #ffffff;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            cursor: pointer;
        `;
        okBtn.addEventListener('mouseenter', () => {
            if (!okBtn.disabled) {
                okBtn.style.backgroundColor = '#2563eb';
                okBtn.style.borderColor = '#2563eb';
            }
        });
        okBtn.addEventListener('mouseleave', () => {
            if (!okBtn.disabled) {
                okBtn.style.backgroundColor = '#3b82f6';
                okBtn.style.borderColor = '#3b82f6';
            }
        });
        okBtn.addEventListener('click', () => this.confirm(pathInput));
        
        // Initially disabled
        okBtn.disabled = true;
        okBtn.style.backgroundColor = '#6b7280';
        okBtn.style.borderColor = '#6b7280';
        okBtn.style.cursor = 'not-allowed';

        footer.appendChild(cancelBtn);
        footer.appendChild(okBtn);

        // Assemble dialog
        this.dialog.appendChild(header);
        this.dialog.appendChild(content);
        this.dialog.appendChild(footer);

        this.overlay.appendChild(this.dialog);
    }

    /**
     * Show the dialog
     */
    showDialog() {
        document.body.appendChild(this.overlay);
        
        // Focus the path input
        setTimeout(() => {
            const pathInput = document.getElementById('folder-path-input');
            if (pathInput) {
                pathInput.focus();
            }
        }, 100);

        // Handle escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.cancel();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);

        // Handle enter key in input
        const pathInput = document.getElementById('folder-path-input');
        if (pathInput) {
            pathInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.confirm(pathInput);
                }
            });
        }
    }

    /**
     * Truncate long path for display
     */
    truncatePath(path, maxLength = 50) {
        if (path.length <= maxLength) return path;
        
        const start = Math.floor(maxLength * 0.4);
        const end = Math.floor(maxLength * 0.6);
        return path.substring(0, start) + '...' + path.substring(path.length - end);
    }

    /**
     * Update path display with truncation
     */
    updatePathDisplay(pathInput, fullPath) {
        // Show full path without truncation
        pathInput.value = fullPath;
        pathInput.title = fullPath; // Show full path on hover
    }

    /**
     * Update import summary
     */
    updateSummary() {
        const summaryArea = this.overlay.querySelector('#folder-summary-area');
        const summaryContent = this.overlay.querySelector('#summary-content');
        
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
            summaryArea.style.display = 'none';
            this.updateImportButton(false);
            return;
        }

        // Group files by category
        const filesByCategory = {};
        this.selectedFiles.forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            const category = pathParts.length > 1 ? pathParts[0] : 'Root';
            if (!filesByCategory[category]) {
                filesByCategory[category] = 0;
            }
            filesByCategory[category]++;
        });

        // Create summary HTML
        const totalFiles = this.selectedFiles.length;
        const categoryCount = Object.keys(filesByCategory).length;
        
        let summaryHTML = `
            <div style="margin-bottom: 0.5rem;">
                <strong>${totalFiles}</strong> files in <strong>${categoryCount}</strong> categories
            </div>
        `;

        // Add category breakdown
        Object.entries(filesByCategory)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([category, count]) => {
                summaryHTML += `
                    <div style="margin: 0.25rem 0; padding-left: 1rem;">
                        • <strong>${category}</strong>: ${count} file${count !== 1 ? 's' : ''}
                    </div>
                `;
            });

        summaryContent.innerHTML = summaryHTML;
        summaryArea.style.display = 'block';
        
        // Enable import button
        this.updateImportButton(true);
    }

    /**
     * Update import button state
     */
    updateImportButton(enabled) {
        const importBtn = this.overlay.querySelector('#import-assets-btn');
        if (!importBtn) return;

        importBtn.disabled = !enabled;
        
        if (enabled) {
            importBtn.style.backgroundColor = '#3b82f6';
            importBtn.style.borderColor = '#3b82f6';
            importBtn.style.cursor = 'pointer';
        } else {
            importBtn.style.backgroundColor = '#6b7280';
            importBtn.style.borderColor = '#6b7280';
            importBtn.style.cursor = 'not-allowed';
        }
    }

    /**
     * Browse for folder - simplified single action
     */
    async browseFolder(pathInput) {
        // Use File System Access API if available (Chrome/Edge)
        if ('showDirectoryPicker' in window) {
            try {
                const directoryHandle = await window.showDirectoryPicker();
                const folderName = directoryHandle.name;
                
                // Get files from directory
                const files = await this.getFilesFromDirectory(directoryHandle);
                this.selectedFiles = files;
                
                // Store directory handle for potential future use
                this.selectedDirectoryHandle = directoryHandle;
                
                // Update path display with folder name only
                this.updatePathDisplay(pathInput, folderName);
                
                // Update summary
                this.updateSummary();
                return;
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.warn('File System Access API failed:', error);
                }
                // User cancelled, do nothing
                return;
            }
        }
        
        // For browsers without File System Access API, use drag & drop only
        // Don't show webkitdirectory dialog as it causes double dialogs
        console.log('File System Access API not supported. Please use drag & drop instead.');
    }

    /**
     * Get files from directory handle (File System Access API)
     */
    async getFilesFromDirectory(directoryHandle, path = '') {
        const files = [];
        
        for await (const [name, handle] of directoryHandle.entries()) {
            if (handle.kind === 'file') {
                const file = await handle.getFile();
                // Create a new object with all file properties and custom webkitRelativePath
                const fileWithPath = {
                    ...file,
                    webkitRelativePath: path ? `${path}/${name}` : name
                };
                files.push(fileWithPath);
            } else if (handle.kind === 'directory') {
                const subPath = path ? `${path}/${name}` : name;
                const subFiles = await this.getFilesFromDirectory(handle, subPath);
                files.push(...subFiles);
            }
        }
        
        return files;
    }

    /**
     * Handle drag & drop of files/folders
     */
    async handleDragDrop(items, pathInput) {
        const files = [];
        let folderName = 'Dropped Items';
        
        // Process each dropped item
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    if (entry.isDirectory) {
                        // Handle directory - use actual folder name
                        folderName = entry.name || 'Dropped Folder';
                        const dirFiles = await this.getFilesFromEntry(entry, '');
                        files.push(...dirFiles);
                    } else {
                        // Handle single file
                        const file = item.getAsFile();
                        // Create a new object with all file properties and custom webkitRelativePath
                        const fileWithPath = {
                            ...file,
                            webkitRelativePath: file.name
                        };
                        files.push(fileWithPath);
                    }
                }
            }
        }
        
        if (files.length > 0) {
            this.selectedFiles = files;
            
            // Update path display with folder name only
            this.updatePathDisplay(pathInput, folderName);
            
            // Update summary
            this.updateSummary();
        }
    }

    /**
     * Get files from FileSystemEntry (for drag & drop)
     */
    async getFilesFromEntry(entry, path) {
        const files = [];
        
        return new Promise((resolve) => {
            if (entry.isFile) {
                entry.file((file) => {
                    // Create a new object with all file properties and custom webkitRelativePath
                    const fileWithPath = {
                        ...file,
                        webkitRelativePath: path ? `${path}/${file.name}` : file.name
                    };
                    files.push(fileWithPath);
                    resolve(files);
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                dirReader.readEntries(async (entries) => {
                    const promises = entries.map(subEntry => 
                        this.getFilesFromEntry(subEntry, path ? `${path}/${entry.name}` : entry.name)
                    );
                    const results = await Promise.all(promises);
                    results.forEach(subFiles => files.push(...subFiles));
                    resolve(files);
                });
            } else {
                resolve(files);
            }
        });
    }

    // Note: handleFolderSelection method removed as we no longer use webkitdirectory

    // Note: showFilePreview method removed - only summary is shown now

    // Note: confirmImport method removed - import happens directly from main dialog

    /**
     * Confirm selection
     */
    confirm(pathInput) {
        if (this.selectedFiles && this.selectedFiles.length > 0) {
            // Return the folder name as path (since we can't get full path from File System Access API)
            const folderName = this.selectedFiles[0]?.webkitRelativePath?.split('/')[0] || 'Selected Folder';
            this.close();
            this.resolve(folderName);
        } else {
            // Show error or focus input
            pathInput.focus();
        }
    }

    /**
     * Cancel selection
     */
    cancel() {
        this.close();
        this.resolve(null);
    }

    /**
     * Close the dialog
     */
    close() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
    }
}
