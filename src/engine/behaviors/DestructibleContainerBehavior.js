import { DamageHealthBehavior } from './DamageHealthBehavior.js';
import { EntityFactory } from '../EntityFactory.js';

/**
 * Breakable crate/vase/chest: subclasses DamageHealthBehavior to reuse its health-pool/
 * contact-damage/invulnerability logic verbatim (and its solid-blocking-while-alive
 * side effect — no isOverlapping() method, same duck-type PlayerMovementBehavior already
 * checks for damageHealth entities). On death, drops `itemId`/`count` as a standalone
 * entity carrying a `pickup` component at this entity's own position (EntityFactory reuse,
 * same pattern as SpawnerBehavior) instead of granting the item directly — the player then
 * walks over it like any other Pickup, matching genre convention for destructible containers.
 */
export class DestructibleContainerBehavior extends DamageHealthBehavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.itemId = this.properties.itemId ?? '';
        this.count = this.properties.count ?? 1;
    }

    _onDeath(scene) {
        if (this.itemId) {
            const loot = EntityFactory.fromGameObjectData({
                id: `${this.entity.id}__loot`,
                x: this.entity.x,
                y: this.entity.y,
                components: [{ type: 'pickup', properties: { itemId: this.itemId, count: this.count } }]
            });
            scene.entities.push(loot);
        }
        super._onDeath(scene);
    }
}
