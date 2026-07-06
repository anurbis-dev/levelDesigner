/**
 * Backspace-to-reset registry (Blender-style UX): hovering a resettable field resets it to
 * its default; hovering an ancestor container (section/subsection, any nesting level) resets
 * every registered field inside it. Panels register their currently-rendered resettable
 * inputs here on every render (keyed by a scope so panels don't clobber each other).
 *
 * Deliberately does NOT know how to persist/notify anything — applying a default replays the
 * same input/change/blur DOM events each panel already listens to, so history/redraw/sync
 * logic lives in exactly one place (the panel's own listeners), never duplicated here.
 */
class ResetRegistryImpl {
    constructor() {
        this.scopes = new Map(); // scopeKey -> [{element, defaultValue} | {element, reset}]
    }

    /**
     * Replace all resettable fields for a given scope (e.g. 'detailsPanel', 'settingsPanel').
     * Each field is either `{element, defaultValue}` (generic: set .value/.checked and replay
     * input/change/blur) or `{element, reset}` (custom: called instead, for fields whose
     * "default" can't be expressed as one static value — e.g. per-object asset size).
     * @param {string} scopeKey
     * @param {Array<{element: HTMLElement, defaultValue?: any, reset?: Function}>} fields
     */
    setFields(scopeKey, fields) {
        this.scopes.set(scopeKey, fields);
    }

    clear(scopeKey) {
        this.scopes.delete(scopeKey);
    }

    getAllFields() {
        const all = [];
        for (const fields of this.scopes.values()) {
            all.push(...fields);
        }
        return all;
    }

    getHoveredElement() {
        const hovered = document.querySelectorAll(':hover');
        return hovered.length ? hovered[hovered.length - 1] : null;
    }

    /**
     * Walk up from the hovered element to find reset targets: an exact field match (single
     * field), or the nearest ancestor that contains one or more registered fields (section,
     * at any nesting level). Stops before document.body/documentElement — those structurally
     * "contain" every field on the page, so treating them as a valid scope would reset
     * everything no matter where the mouse actually is (that was a real bug: Backspace fired
     * from anywhere in the UI, not just while hovering a panel).
     */
    findTargets(hoveredEl) {
        const fields = this.getAllFields();
        let node = hoveredEl;

        while (node && node !== document.body && node !== document.documentElement) {
            const exact = fields.find(f => f.element === node);
            if (exact) return [exact];

            const contained = fields.filter(f => node.contains(f.element));
            if (contained.length > 0) return contained;

            node = node.parentElement;
        }

        return [];
    }

    applyDefault(field) {
        if (typeof field.reset === 'function') {
            field.reset();
            return;
        }

        const { element, defaultValue } = field;
        if (element.type === 'checkbox') {
            element.checked = !!defaultValue;
        } else {
            element.value = defaultValue;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    /**
     * Handle a Backspace keydown globally.
     * @returns {boolean} true if consumed (caller should stop further processing)
     */
    handleBackspace() {
        const hovered = this.getHoveredElement();
        if (!hovered) return false;

        const activeEl = document.activeElement;
        const isTextLikeInput = activeEl && (
            activeEl.tagName === 'TEXTAREA' ||
            (activeEl.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'color'].includes(activeEl.type))
        );

        const fields = this.getAllFields();

        // Typing inside a plain text field that isn't itself a registered resettable
        // parameter (e.g. the settings-panel search box) must always just delete a
        // character, no matter what resettable fields happen to live in an ancestor
        // container that's being hovered (e.g. the search input sits inside the settings
        // panel, which "contains" every field on the active tab).
        if (isTextLikeInput && hovered === activeEl && !fields.some(f => f.element === activeEl)) {
            return false;
        }

        const targets = this.findTargets(hovered);
        if (targets.length === 0) return false;

        // Don't hijack active text editing: if exactly one field matched and the user is
        // currently typing inside that exact element, let native Backspace delete a character.
        if (isTextLikeInput && targets.length === 1 && targets[0].element === activeEl) {
            return false;
        }

        targets.forEach(t => this.applyDefault(t));
        return true;
    }
}

export const ResetRegistry = new ResetRegistryImpl();
