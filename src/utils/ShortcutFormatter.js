/**
 * Formats a shortcut definition object ({key, ctrlKey, altKey, shiftKey, metaKey}) into a
 * display string (e.g. "Ctrl+Alt+N"). Single source of truth for this formatting — used by
 * SettingsPanel's Hotkeys tab, MenuManager labels, and UI element title tooltips (U2).
 */
export class ShortcutFormatter {
    static format(shortcut) {
        if (!shortcut || !shortcut.key) return '';

        const parts = [];
        if (shortcut.ctrlKey) parts.push('Ctrl');
        if (shortcut.altKey) parts.push('Alt');
        if (shortcut.shiftKey) parts.push('Shift');
        if (shortcut.metaKey) parts.push('Cmd');
        parts.push(shortcut.key.toUpperCase());

        return parts.join('+');
    }

    /**
     * Resolve a shortcutKey path (`editor.saveLevel`) via ConfigManager.getShortcuts().
     * @param {object|null|undefined} configManager
     * @param {string} shortcutKey
     * @returns {string}
     */
    static resolveLabel(configManager, shortcutKey) {
        if (!configManager || !shortcutKey) return '';
        const [category, action] = shortcutKey.split('.');
        if (!category || !action) return '';
        const shortcut = configManager.getShortcuts?.()?.[category]?.[action];
        return ShortcutFormatter.format(shortcut);
    }

    /**
     * Tooltip text: base label, optionally appended with live shortcut.
     * @param {string} baseLabel
     * @param {string} shortcutLabel
     * @returns {string}
     */
    static formatTitle(baseLabel, shortcutLabel) {
        if (!baseLabel) return shortcutLabel || '';
        if (!shortcutLabel) return baseLabel;
        return `${baseLabel} (${shortcutLabel})`;
    }
}
