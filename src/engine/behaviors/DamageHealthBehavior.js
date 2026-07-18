import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect, matchesLayer } from './AABB.js';

/**
 * Self-contained health pool (same discipline as PickupBehavior): every tick, AABB-checks
 * this entity against every other entity that also carries a damageHealth component. An
 * overlap with a `contactDamage > 0` source applies damage once, then this entity ignores
 * further hits for `invulnerabilityDuration` seconds. One component type covers both sides
 * of contact damage — a hazard/enemy sets contactDamage>0 (and typically no health pool use),
 * the player/enemy receiving hits sets maxHealth/currentHealth (and typically contactDamage=0)
 * — `layer`/`collidesWith` (Фаза A convention, AABB.js matchesLayer) decide who can hurt whom.
 */
export class DamageHealthBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.maxHealth = this.properties.maxHealth ?? 100;
        this.currentHealth = this.properties.currentHealth ?? this.maxHealth;
        this.contactDamage = this.properties.contactDamage ?? 0;
        this.invulnerabilityDuration = this.properties.invulnerabilityDuration ?? 0.5;
        this.destroyOnDeath = this.properties.destroyOnDeath ?? true;
        this._invulnTimer = 0;
        this._dead = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    update(dt, scene) {
        if (this._dead) return;
        if (this._invulnTimer > 0) this._invulnTimer -= dt;

        const bounds = this.getBounds();
        for (const other of scene.getAllEntities()) {
            if (other === this.entity) continue;
            const source = other.behaviors?.find(b => b instanceof DamageHealthBehavior && b.enabled);
            if (!source || source.contactDamage <= 0) continue;
            if (this._invulnTimer > 0) continue;
            if (!matchesLayer(this.properties.collidesWith, source.properties.layer)) continue;
            if (!rectsIntersect(bounds, source.getBounds())) continue;

            this._applyDamage(source.contactDamage, scene);
            break;
        }
    }

    _applyDamage(amount, scene) {
        this.currentHealth -= amount;
        this._invulnTimer = this.invulnerabilityDuration;
        if (this.currentHealth > 0) return;

        this._dead = true;
        if (this.destroyOnDeath) {
            scene.destroyEntity(this.entity.id);
        }
    }
}
