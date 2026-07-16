import { Behavior } from './Behavior.js';

/**
 * Makes an entity usable via an interact button (radius + hint text). The actual
 * interact input/trigger is Input's job (Фаза 3+) — this behavior only exposes the
 * range query the engine/game code needs to decide whether interaction is possible.
 */
export class InteractableBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.radius = this.properties.radius ?? 32;
        this.hint = this.properties.hint ?? 'Interact';
    }

    isInRange(point) {
        const cx = this.entity.x + this.entity.width / 2;
        const cy = this.entity.y + this.entity.height / 2;
        const dx = point.x - cx;
        const dy = point.y - cy;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
}
