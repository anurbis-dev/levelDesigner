/**
 * FolderPickerDialog - Dialog for selecting folders and importing assets
 * Handles both File System Access API and fallback methods
 */

import { Logger } from '../utils/Logger.js';

export class FolderPickerDialog {
    constructor() {
        this.selectedFiles = [];
        this.folderName = '';
        this.isOpen = false;
    }

    /**
     * Show the folder picker dialog
     * @returns {Promise<Object|null>} Selected folder data or null if cancelled
     */
    async show() {
        Logger.ui.info('📁 Opening folder picker dialog');
        
        try {
            // Try File System Access API first
            if ('showDirectoryPicker' in window) {
                return await this.showDirectoryPicker();
            } else {
                // Fallback to input element
                return await this.showInputDialog();
            }
        } catch (error) {
            Logger.ui.error('Folder picker failed:', error);
            return null;
        }
    }

    /**
     * Show directory picker using File System Access API
     * @returns {Promise<Object|null>} Selected folder data
     */
    async showDirectoryPicker() {
        try {
            const directoryHandle = await window.showDirectoryPicker({
                mode: 'read',
                startIn: 'documents'
            });
            
            Logger.ui.info('📁 Directory selected via File System Access API');
            
            // Get files from directory
            const files = await this.getFilesFromDirectory(directoryHandle);
            
            if (files.length === 0) {
                Logger.ui.warn('⚠️ No files found in selected directory');
                return null;
            }
            
            // Get folder name from first file
            const folderName = files[0]?.webkitRelativePath?.split('/')[0] || 'Selected Folder';
            
            return {
                folderName,
                files,
                method: 'directory-picker'
            };
            
        } catch (error) {
            if (error.name === 'AbortError') {
                Logger.ui.info('📁 Directory picker cancelled by user');
                return null;
            }
            throw error;
        }
    }

    /**
     * Show input dialog as fallback
     * @returns {Promise<Object|null>} Selected folder data
     */
    async showInputDialog() {
        return new Promise((resolve) => {
            // Create input element
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.webkitdirectory = true; // Allows directory selection
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            
            // Add to DOM temporarily
            document.body.appendChild(fileInput);
            
            // Handle file selection
            fileInput.addEventListener('change', async (e) => {
                const fileList = e.target.files;
                
                if (fileList.length === 0) {
                    Logger.ui.info('📁 No files selected');
                    resolve(null);
                return;
                }
                
                try {
                    // Get files from input
                    const files = await this.getFilesFromInput(fileList);
                    
                    if (files.length === 0) {
                        Logger.ui.warn('⚠️ No valid files found');
                        resolve(null);
                        return;
                    }
                    
                    // Get folder name from first file
                    const folderName = files[0]?.webkitRelativePath?.split('/')[0] || 'Selected Folder';
                    
                    resolve({
                        folderName,
                        files,
                        method: 'input-dialog'
                    });
                    
                } catch (error) {
                    Logger.ui.error('Error processing selected files:', error);
                    resolve(null);
                } finally {
                    // Clean up
                    document.body.removeChild(fileInput);
                }
            });
            
            // Handle cancellation
            fileInput.addEventListener('cancel', () => {
                Logger.ui.info('📁 File input cancelled by user');
                document.body.removeChild(fileInput);
                resolve(null);
            });
            
            // Trigger file picker
        fileInput.click();
        });
    }

    /**
     * Get files from input element
     * @param {FileList} fileList - Files from input element
     * @returns {Promise<Array>} Array of processed files
     */
    async getFilesFromInput(fileList) {
        const files = [];

        // Check if we have access to webkitRelativePath (modern browsers)
        const hasRelativePath = Array.from(fileList).some(file => file.webkitRelativePath);

        if (hasRelativePath) {
            // Use standard webkitdirectory approach - preserve original File objects
            for (const file of fileList) {
                // File already has webkitRelativePath, use as is
                files.push(file);
            }
        } else {
            // Fallback: try to reconstruct paths - create File-like objects
            for (const file of fileList) {
                // Create a File-like object that preserves Blob nature but allows webkitRelativePath modification
                const fileWithPath = Object.assign(Object.create(null), file);
                Object.defineProperty(fileWithPath, 'webkitRelativePath', {
                    value: file.name,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
                files.push(fileWithPath);
            }
        }

        return files;
    }

    /**
     * Get files from directory handle (File System Access API)
     * @param {FileSystemDirectoryHandle} directoryHandle - Directory handle
     * @param {string} path - Current path
     * @returns {Promise<Array>} Array of files
     */
    async getFilesFromDirectory(directoryHandle, path = '') {
        const files = [];
        
        for await (const [name, handle] of directoryHandle.entries()) {
            if (handle.kind === 'file') {
                const file = await handle.getFile();
                
                // Create a new object that preserves Blob nature but allows webkitRelativePath modification
                const fileWithPath = new Blob([file], { type: file.type });

                // Add properties to make it file-like
                fileWithPath.name = file.name;
                fileWithPath.lastModified = file.lastModified;

                // Add webkitRelativePath using Object.defineProperty
                Object.defineProperty(fileWithPath, 'webkitRelativePath', {
                    value: path ? `${path}/${name}` : name,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });

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
                        
                        // Create a new object that preserves Blob nature but allows webkitRelativePath modification
                        const fileWithPath = new Blob([file], { type: file.type });
                        
                        // Add properties to make it file-like
                        fileWithPath.name = file.name;
                        fileWithPath.lastModified = file.lastModified;

                        // Add webkitRelativePath using Object.defineProperty
                        Object.defineProperty(fileWithPath, 'webkitRelativePath', {
                            value: file.name,
                            writable: true,
                            enumerable: true,
                            configurable: true
                        });
                        
                        files.push(fileWithPath);
                    }
                }
            }
        }
        
        return {
            folderName,
            files,
            method: 'drag-drop'
        };
    }

    /**
     * Get files from directory entry (drag & drop)
     * @param {FileSystemDirectoryEntry} entry - Directory entry
     * @param {string} path - Current path
     * @returns {Promise<Array>} Array of files
     */
    async getFilesFromEntry(entry, path = '') {
        const files = [];
        
        return new Promise((resolve) => {
            const reader = entry.createReader();
            
            reader.readEntries(async (entries) => {
                for (const subEntry of entries) {
                    if (subEntry.isDirectory) {
                        const subPath = path ? `${path}/${subEntry.name}` : subEntry.name;
                        const subFiles = await this.getFilesFromEntry(subEntry, subPath);
                        files.push(...subFiles);
                    } else {
                        // Get file from entry
                        subEntry.file((file) => {
                            // Create a File-like object that preserves Blob nature but allows webkitRelativePath modification
                            const fileWithPath = Object.assign(Object.create(null), file);
                            Object.defineProperty(fileWithPath, 'webkitRelativePath', {
                                value: path ? `${path}/${file.name}` : file.name,
                                writable: true,
                                enumerable: true,
                                configurable: true
                            });
                            files.push(fileWithPath);
                        });
                    }
                }
                resolve(files);
            });
        });
    }

    /**
     * Get summary of selected files
     * @returns {Object} Summary object
     */
    getSummary() {
        const totalFiles = this.selectedFiles.length;
        const fileTypes = {};
        
        this.selectedFiles.forEach(file => {
            const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        });
        
        return {
            totalFiles,
            fileTypes,
            folderName: this.folderName
        };
    }

    /**
     * Check if File System Access API is supported
     * @returns {boolean} Whether API is supported
     */
    static isSupported() {
        return 'showDirectoryPicker' in window;
    }

    /**
     * Get supported methods
     * @returns {Array<string>} Array of supported methods
     */
    static getSupportedMethods() {
        const methods = [];
        
        if ('showDirectoryPicker' in window) {
            methods.push('directory-picker');
        }
        
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            methods.push('input-dialog');
        }
        
        return methods;
    }
}
