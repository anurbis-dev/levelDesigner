/**
 * Keyboard input state for the engine. Arrow keys + WASD map to a normalized 2D axis;
 * PlayerMovementBehavior reads this via scene.input (see GameEngine.loadProject()).
 * Target defaults to `window` so it works unmodified in a browser tab; tests inject a
 * plain {addEventListener,removeEventListener} stand-in instead of requiring jsdom.
 *
 * §7 backlog (inputMap, Tier 3): named actions (`isActionDown(name)`) remap onto physical keys
 * via `setInputMap({actions: {name: ['key', ...]}})` — called by GameEngine.loadProject() with
 * `scene.inputMap` (`levelData.inputMap`, a plain level-scope field like `eventGraph`, not a
 * separate catalog asset). Only keyboard bindings — gamepad/touch (the rest of the asset type's
 * "Keyboard/gamepad/touch control layout" description) aren't implemented in this pass, no
 * existing gamepad/touch input plumbing in the engine to remap onto. Actions not present in the
 * map fall back to `DEFAULT_ACTIONS`, not to treating the action name as a literal raw key — a
 * level that only remaps `interact` still gets working WASD/arrow movement.
 */
export class Input {
    /** @type {Record<string, string[]>} action name → lowercase key names, checked in order */
    static DEFAULT_ACTIONS = {
        moveLeft: ['arrowleft', 'a'],
        moveRight: ['arrowright', 'd'],
        moveUp: ['arrowup', 'w'],
        moveDown: ['arrowdown', 's'],
        jump: [' ', 'z', 'x'],
        interact: ['e', 'f', 'c']
    };

    constructor(target = (typeof window !== 'undefined' ? window : null)) {
        this._keys = new Set();
        this._keysPrev = new Set();
        this._consumed = new Set();
        this._target = target;
        this._actions = null;
        this._onKeyDown = (e) => {
            this._keys.add(e.key.toLowerCase());
            const k = e.key.toLowerCase();
            if (k === ' ' || k.startsWith('arrow')) e.preventDefault?.();
        };
        this._onKeyUp = (e) => this._keys.delete(e.key.toLowerCase());
        if (this._target) {
            this._target.addEventListener('keydown', this._onKeyDown);
            this._target.addEventListener('keyup', this._onKeyUp);
        }
    }

    /** Call at the start of a simulation tick (clears consume flags). */
    beginFrame() {
        this._consumed.clear();
    }

    /** Call at the end of a simulation tick (latches held keys as previous). */
    endFrame() {
        this._keysPrev = new Set(this._keys);
    }

    _keysFor(actionName) {
        return this._actions?.get(actionName) || Input.DEFAULT_ACTIONS[actionName];
    }

    /** True on the first tick a bound key went down. Honors consumeAction(). */
    wasActionPressed(actionName) {
        if (this._consumed.has(actionName)) return false;
        const keys = this._keysFor(actionName);
        if (!keys) return this._keys.has(actionName) && !this._keysPrev.has(actionName);
        return keys.some((k) => this._keys.has(k) && !this._keysPrev.has(k));
    }

    consumeAction(actionName) {
        this._consumed.add(actionName);
    }

    isDown(key) {
        return this._keys.has(key.toLowerCase());
    }

    /**
     * @param {object|null} inputMap - `{actions: {name: string[]}}`; null/invalid clears back to
     *   `DEFAULT_ACTIONS`-only behavior.
     */
    setInputMap(inputMap) {
        const actions = inputMap?.actions;
        if (!actions || typeof actions !== 'object') {
            this._actions = null;
            return;
        }
        this._actions = new Map(
            Object.entries(actions)
                .filter(([, keys]) => Array.isArray(keys))
                .map(([name, keys]) => [name, keys.map((k) => String(k).toLowerCase())])
        );
    }

    /** True if any key bound to `actionName` is held — custom map first, else `DEFAULT_ACTIONS`. */
    isActionDown(actionName) {
        const keys = this._actions?.get(actionName) || Input.DEFAULT_ACTIONS[actionName];
        if (!keys) return this.isDown(actionName);
        return keys.some((k) => this.isDown(k));
    }

    /** @returns {{x: number, y: number}} each axis in [-1, 1], not normalized to unit length. */
    getAxis() {
        const right = this.isActionDown('moveRight');
        const left = this.isActionDown('moveLeft');
        const down = this.isActionDown('moveDown');
        const up = this.isActionDown('moveUp');
        return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    }

    destroy() {
        if (this._target) {
            this._target.removeEventListener('keydown', this._onKeyDown);
            this._target.removeEventListener('keyup', this._onKeyUp);
        }
        this._keys.clear();
    }
}
