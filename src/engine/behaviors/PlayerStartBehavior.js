import { Behavior } from './Behavior.js';

/** Marks an entity as the player spawn point (see docs/RUNTIME_SCHEMA.md `playerStart`). */
export class PlayerStartBehavior extends Behavior {
    getSpawnPosition() {
        return { x: this.entity.x, y: this.entity.y };
    }
}
