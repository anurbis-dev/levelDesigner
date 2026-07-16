/**
 * Keyboard input state for the engine. Arrow keys + WASD map to a normalized 2D axis;
 * PlayerMovementBehavior reads this via scene.input (see GameEngine.loadProject()).
 * Target defaults to `window` so it works unmodified in a browser tab; tests inject a
 * plain {addEventListener,removeEventListener} stand-in instead of requiring jsdom.
 */
export class Input {
    constructor(target = (typeof window !== 'undefined' ? window : null)) {
        this._keys = new Set();
        this._target = target;
        this._onKeyDown = (e) => this._keys.add(e.key.toLowerCase());
        this._onKeyUp = (e) => this._keys.delete(e.key.toLowerCase());
        if (this._target) {
            this._target.addEventListener('keydown', this._onKeyDown);
            this._target.addEventListener('keyup', this._onKeyUp);
        }
    }

    isDown(key) {
        return this._keys.has(key.toLowerCase());
    }

    /** @returns {{x: number, y: number}} each axis in [-1, 1], not normalized to unit length. */
    getAxis() {
        const right = this.isDown('arrowright') || this.isDown('d');
        const left = this.isDown('arrowleft') || this.isDown('a');
        const down = this.isDown('arrowdown') || this.isDown('s');
        const up = this.isDown('arrowup') || this.isDown('w');
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
