import { Behavior } from './Behavior.js';
import { EntityFactory } from '../EntityFactory.js';

/**
 * Periodic entity spawner: no live asset registry exists yet at runtime (ProjectLoader
 * assetsById stays an empty Map — see ProjectLoader.js), so `template` carries the full
 * GameObject-shaped data (same shape EntityFactory.fromGameObjectData already consumes)
 * inline on the component, same "self-contained, no cross-referencing system" call as
 * pathFollower's inline `waypoints`. Spawn position is this entity's own x/y plus
 * `spawnOffsetX/Y` (asset-local offset convention); template.x/y are ignored so one
 * template can be reused regardless of where it's authored.
 *
 * `spawnOne(scene)` is exposed as a public duck-typed hook (mirrors MovablePushable's
 * tryPush) for a future Event Graph "SpawnObject" action — not wired to any node yet,
 * out of scope for this pass.
 */
export class SpawnerBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.template = this.properties.template && typeof this.properties.template === 'object'
            ? this.properties.template
            : {};
        this.interval = this.properties.interval ?? 3;
        this.maxAlive = this.properties.maxAlive ?? 0;
        this.maxSpawns = this.properties.maxSpawns ?? 0;
        this.spawnOffsetX = this.properties.spawnOffsetX ?? 0;
        this.spawnOffsetY = this.properties.spawnOffsetY ?? 0;
        this._timer = 0;
        this._totalSpawned = 0;
        this._alive = [];
    }

    update(dt, scene) {
        if (this.interval <= 0) return;
        if (this.maxSpawns > 0 && this._totalSpawned >= this.maxSpawns) return;

        this._alive = this._alive.filter(e => scene.entities.includes(e));
        if (this.maxAlive > 0 && this._alive.length >= this.maxAlive) return;

        this._timer += dt;
        if (this._timer < this.interval) return;
        this._timer -= this.interval;
        this.spawnOne(scene);
    }

    /** @returns {import('../Entity.js').Entity} the newly spawned entity. */
    spawnOne(scene) {
        const data = {
            ...this.template,
            id: `${this.entity.id}__spawn${this._totalSpawned}`,
            x: this.entity.x + this.spawnOffsetX,
            y: this.entity.y + this.spawnOffsetY
        };
        const spawned = EntityFactory.fromGameObjectData(data);
        scene.entities.push(spawned);
        this._alive.push(spawned);
        this._totalSpawned++;
        return spawned;
    }
}
