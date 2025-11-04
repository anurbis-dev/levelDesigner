/**
 * Dialog Structures
 * 
 * Defines common dialog configurations and structures for different types of popup windows.
 * These structures can be used with BaseDialog to create consistent dialog layouts.
 * 
 * @author Level Designer
 * @version 3.52.1
 */

/**
 * Standard dialog structure with header, content, and footer
 */
export const StandardDialogStructure = {
    id: 'standard-dialog',
    title: 'Dialog',
    showCloseButton: true,
    showFooter: true,
    footerButtons: [
        {
            id: 'cancel',
            text: 'Cancel',
            class: 'dialog-btn-cancel',
            backgroundColor: '#6b7280',
            textColor: 'white'
        },
        {
            id: 'confirm',
            text: 'OK',
            class: 'dialog-btn-confirm',
            backgroundColor: '#2563eb',
            textColor: 'white'
        }
    ]
};

/**
 * Settings dialog structure (for SettingsPanel)
 */
export const SettingsDialogStructure = {
    id: 'settings-dialog',
    title: 'Settings',
    showCloseButton: true,
    showFooter: true,
    footerButtons: [
        {
            id: 'cancel',
            text: 'Cancel',
            class: 'settings-btn-cancel',
            backgroundColor: '#6b7280',
            textColor: 'white'
        },
        {
            id: 'save',
            text: 'Apply',
            class: 'settings-btn-save',
            backgroundColor: '#2563eb',
            textColor: 'white'
        }
    ]
};

/**
 * Asset properties dialog structure
 */
export const ActorPropertiesDialogStructure = {
    id: 'actor-properties-dialog',
    title: 'Asset Properties',
    showCloseButton: true,
    showFooter: true,
    footerButtons: [
        {
            id: 'cancel',
            text: 'Cancel',
            class: 'settings-btn-cancel',
            backgroundColor: '#6b7280',
            textColor: 'white'
        },
        {
            id: 'apply',
            text: 'Close',
            class: 'settings-btn-save',
            backgroundColor: '#2563eb',
            textColor: 'white'
        }
    ]
};

/**
 * Universal dialog structure (for alert, confirm, prompt)
 */
export const UniversalDialogStructure = {
    id: 'universal-dialog',
    title: 'Dialog',
    showCloseButton: true,
    showFooter: true,
    footerButtons: [
        {
            id: 'cancel',
            text: 'Cancel',
            class: 'dialog-btn-cancel',
            backgroundColor: '#6b7280',
            textColor: 'white'
        },
        {
            id: 'confirm',
            text: 'OK',
            class: 'dialog-btn-confirm',
            backgroundColor: '#2563eb',
            textColor: 'white'
        }
    ]
};

/**
 * Folder picker dialog structure
 */
export const FolderPickerDialogStructure = {
    id: 'folder-picker-dialog',
    title: 'Select Folder',
    showCloseButton: true,
    showFooter: true,
    footerButtons: [
        {
            id: 'cancel',
            text: 'Cancel',
            class: 'dialog-btn-cancel',
            backgroundColor: '#6b7280',
            textColor: 'white'
        },
        {
            id: 'select',
            text: 'Select',
            class: 'dialog-btn-confirm',
            backgroundColor: '#2563eb',
            textColor: 'white'
        }
    ]
};

/**
 * Grid settings dialog structure
 */
export const GridSettingsDialogStructure = {
    id: 'grid-settings-dialog',
    title: 'Grid Settings',
    showCloseButton: true,
    showFooter: true,
    footerButtons: [
        {
            id: 'cancel',
            text: 'Cancel',
            class: 'settings-btn-cancel',
            backgroundColor: '#6b7280',
            textColor: 'white'
        },
        {
            id: 'apply',
            text: 'Apply',
            class: 'settings-btn-save',
            backgroundColor: '#2563eb',
            textColor: 'white'
        }
    ]
};

/**
 * Create dialog structure with custom configuration
 * @param {Object} customConfig - Custom configuration to merge with base structure
 * @param {string} baseStructure - Base structure to use (default: StandardDialogStructure)
 * @returns {Object} - Merged dialog structure
 */
export function createDialogStructure(customConfig = {}, baseStructure = StandardDialogStructure) {
    return {
        ...baseStructure,
        ...customConfig,
        footerButtons: customConfig.footerButtons || baseStructure.footerButtons
    };
}

/**
 * Get dialog structure by type
 * @param {string} type - Dialog type ('settings', 'actor-properties', 'universal', 'folder-picker', 'grid-settings')
 * Note: 'actor-properties' is used for Asset Properties dialog
 * @returns {Object} - Dialog structure
 */
export function getDialogStructure(type) {
    const structures = {
        'settings': SettingsDialogStructure,
        'actor-properties': ActorPropertiesDialogStructure,
        'universal': UniversalDialogStructure,
        'folder-picker': FolderPickerDialogStructure,
        'grid-settings': GridSettingsDialogStructure
    };
    
    return structures[type] || StandardDialogStructure;
}
