import { Logger } from './Logger.js';
import { ExtensionErrorUtils } from './ExtensionErrorUtils.js';

/**
 * Utility class for common file operations
 * Eliminates file operation duplication and provides consistent API
 */
export class FileUtils {
    /**
     * Supported file types
     */
    static TYPES = {
        JSON: 'application/json',
        TEXT: 'text/plain',
        CSV: 'text/csv',
        XML: 'application/xml'
    };

    /**
     * Download data as a file (fallback method)
     * @param {string|Object} data - Data to download (string or object to JSON stringify)
     * @param {string} filename - Name of the file to download
     * @param {string} mimeType - MIME type of the file (default: application/json)
     * @param {boolean} prettyJson - Whether to pretty-format JSON (default: true)
     * @returns {string} The filename that was used
     */
    static downloadData(data, filename, mimeType = FileUtils.TYPES.JSON, prettyJson = true) {
        let fileData;
        
        if (typeof data === 'string') {
            fileData = data;
        } else {
            // Convert object to JSON
            fileData = prettyJson ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        }

        const blob = new Blob([fileData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } finally {
            URL.revokeObjectURL(url);
        }

        return filename;
    }

    /**
     * Save data directly to file system using File System Access API
     * @param {string|Object} data - Data to save (string or object to JSON stringify)
     * @param {string} filename - Name of the file to save
     * @param {string} mimeType - MIME type of the file (default: application/json)
     * @param {boolean} prettyJson - Whether to pretty-format JSON (default: true)
     * @returns {Promise<string>} The filename that was used
     */
    static async saveDataDirectly(data, filename, mimeType = FileUtils.TYPES.JSON, prettyJson = true) {
        // Check if File System Access API is supported
        if (!('showSaveFilePicker' in window)) {
            Logger.file.warn('File System Access API not supported, falling back to download');
            return this.downloadData(data, filename, mimeType, prettyJson);
        }

        let fileData;
        
        if (typeof data === 'string') {
            fileData = data;
        } else {
            // Convert object to JSON
            fileData = prettyJson ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        }

        try {
            // Create file picker for saving with timeout protection
            const fileHandle = await ExtensionErrorUtils.withTimeout(
                window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'JSON files',
                        accept: {
                            'application/json': ['.json']
                        }
                    }]
                }),
                10000,
                'File picker'
            );

            // Create writable stream with timeout
            const writable = await ExtensionErrorUtils.withTimeout(
                fileHandle.createWritable(),
                5000,
                'File writing'
            );
            
            // Write data to file with timeout
            await ExtensionErrorUtils.withTimeout(
                writable.write(fileData),
                10000,
                'File write operation'
            );
            
            await writable.close();

            Logger.file.info(`✅ File saved directly: ${filename}`);
            return filename;
        } catch (error) {
            return await ExtensionErrorUtils.handleFileSystemError(
                error,
                () => this.downloadData(data, filename, mimeType, prettyJson),
                { logger: Logger.file, operation: 'File save' }
            );
        }
    }


    /**
     * Read file content as text
     * @param {File} file - File object to read
     * @returns {Promise<string>} File content as text
     */
    static readFileAsText(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => {
                Logger.file.warn('FileReader error:', error);
                reject(new Error('Failed to read file'));
            };
            reader.readAsText(file);
        });
    }

    /**
     * Read file content and parse as JSON
     * @param {File} file - File object to read
     * @returns {Promise<Object>} Parsed JSON object
     */
    static readFileAsJSON(file) {
        return this.readFileAsText(file).then(text => {
            try {
                return JSON.parse(text);
            } catch (error) {
                throw new Error('Failed to parse JSON: ' + error.message);
            }
        });
    }

    /**
     * Show file picker dialog and read selected file
     * @param {string|Array} accept - File types to accept (e.g., '.json', ['.json', '.txt'])
     * @param {boolean} multiple - Allow multiple file selection
     * @returns {Promise<File|FileList>} Selected file(s)
     */
    static pickFile(accept = null, multiple = false) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'file-picker-input';
            input.name = 'file-picker-input';
            input.multiple = multiple;
            
            if (accept) {
                if (Array.isArray(accept)) {
                    input.accept = accept.join(',');
                } else {
                    input.accept = accept;
                }
            }

            input.onchange = (e) => {
                try {
                    const files = e.target.files;
                    if (!files || files.length === 0) {
                        reject(new Error('No file selected'));
                        return;
                    }
                    
                    resolve(multiple ? files : files[0]);
                } catch (error) {
                    reject(error);
                } finally {
                    // Ensure cleanup even if error occurs
                    if (document.body.contains(input)) {
                        document.body.removeChild(input);
                    }
                }
            };

            input.oncancel = () => {
                reject(new Error('File selection cancelled'));
            };

            input.click();
        });
    }

    /**
     * Pick and read file as text in one operation
     * @param {string|Array} accept - File types to accept
     * @returns {Promise<{file: File, content: string}>} File and its content
     */
    static async pickAndReadText(accept = null) {
        try {
            const file = await this.pickFile(accept, false);
            const content = await this.readFileAsText(file);
            return { file, content };
        } catch (error) {
            Logger.file.warn('Error in pickAndReadText:', error);
            throw error;
        }
    }

    /**
     * Pick and read file as JSON in one operation
     * @param {string|Array} accept - File types to accept (default: .json)
     * @returns {Promise<{file: File, data: Object}>} File and parsed JSON data
     */
    static async pickAndReadJSON(accept = '.json') {
        try {
            const file = await this.pickFile(accept, false);
            const data = await this.readFileAsJSON(file);
            return { file, data };
        } catch (error) {
            Logger.file.warn('Error in pickAndReadJSON:', error);
            throw error;
        }
    }

    /**
     * Validate file type
     * @param {File} file - File to validate
     * @param {string|Array} allowedExtensions - Allowed extensions (e.g., '.json' or ['.json', '.txt'])
     * @returns {boolean} Whether file type is valid
     */
    static validateFileType(file, allowedExtensions) {
        if (!file || !allowedExtensions) return true;

        const extensions = Array.isArray(allowedExtensions) ? allowedExtensions : [allowedExtensions];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        return extensions.some(ext => ext.toLowerCase() === fileExtension);
    }

    /**
     * Get file extension from filename
     * @param {string} filename - Filename to extract extension from
     * @returns {string} File extension including dot (e.g., '.json')
     */
    static getFileExtension(filename) {
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);
    }

    /**
     * Get filename without extension
     * @param {string} filename - Filename to strip extension from
     * @returns {string} Filename without extension
     */
    static getFileBaseName(filename) {
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
    }

    /**
     * Format file size in human readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size (e.g., '1.5 MB')
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Create a data URL from file
     * @param {File} file - File to convert
     * @returns {Promise<string>} Data URL
     */
    static createDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (error) => {
                Logger.file.warn('FileReader error creating data URL:', error);
                reject(new Error('Failed to create data URL'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Check if browser supports File API
     * @returns {boolean} Whether File API is supported
     */
    static isFileAPISupported() {
        return window.File && window.FileReader && window.FileList && window.Blob;
    }

    /**
     * Batch download multiple files as separate downloads
     * @param {Array} files - Array of {data, filename, mimeType} objects
     * @param {number} delay - Delay between downloads in ms (default: 100)
     */
    static async downloadBatch(files, delay = 100) {
        try {
            for (let i = 0; i < files.length; i++) {
                const { data, filename, mimeType } = files[i];
                this.downloadData(data, filename, mimeType);
                
                if (i < files.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        } catch (error) {
            Logger.file.warn('Error in downloadBatch:', error);
            throw error;
        }
    }

    /**
     * Read multiple files and return their contents
     * @param {FileList} files - Files to read
     * @param {string} format - Format to read as ('text' or 'json')
     * @returns {Promise<Array>} Array of file contents
     */
    static async readMultipleFiles(files, format = 'text') {
        try {
            const promises = Array.from(files).map(file => {
                return format === 'json' ? this.readFileAsJSON(file) : this.readFileAsText(file);
            });

            return Promise.all(promises);
        } catch (error) {
            Logger.file.warn('Error reading multiple files:', error);
            throw error;
        }
    }

    /**
     * Create a backup filename with timestamp
     * @param {string} originalFilename - Original filename
     * @param {string} suffix - Suffix to add (default: 'backup')
     * @returns {string} Backup filename
     */
    static createBackupFilename(originalFilename, suffix = 'backup') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1);
        const baseName = this.getFileBaseName(originalFilename);
        const extension = this.getFileExtension(originalFilename);
        
        return `${baseName}_${suffix}_${timestamp}${extension}`;
    }
}
