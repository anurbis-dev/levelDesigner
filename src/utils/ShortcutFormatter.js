/**
 * Formats a shortcut definition object ({key, ctrlKey, altKey, shiftKey, metaKey}) into a
 * display string (e.g. "Ctrl+Alt+N"). Single source of truth for this formatting — used by
 * both SettingsPanel's Hotkeys tab and MenuManager's shortcut labels, so a rebind or a new
 * hotkey entry always displays identically everywhere.
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
}
