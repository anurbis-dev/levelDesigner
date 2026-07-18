import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';

/**
 * Self-contained item pickup: on AABB overlap with the player entity, adds `itemId`
 * to the player bag (scene.inventory) and removes itself (unless destroyOnPickup is
 * false, e.g. a re-collectible respawn point a future phase might add).
 */
export class PickupBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.itemId = this.properties.itemId ?? '';
        this.count = this.properties.count ?? 1;
        this.destroyOnPickup = this.properties.destroyOnPickup ?? true;
        this._collected = false;
    }

    update(dt, scene) {
        if (this._collected || !this.itemId || !scene.player) return;
        const bounds = getEntityBounds(this.entity, this.properties);
        const playerBounds = getEntityBounds(scene.player, {});
        if (!rectsIntersect(bounds, playerBounds)) return;

        scene.inventory.add(this.itemId, this.count);
        this._collected = true;
        if (this.destroyOnPickup) {
            scene.destroyEntity(this.entity.id);
        }
    }
}
