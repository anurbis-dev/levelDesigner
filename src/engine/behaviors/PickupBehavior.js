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
        this.mode = this.properties.mode ?? 'collect';
        this.healAmount = this.properties.healAmount ?? 0;
        this.requireInteract = this.properties.requireInteract ?? false;
        this.throwSpeedX = this.properties.throwSpeedX ?? 155;
        this.throwSpeedY = this.properties.throwSpeedY ?? -135;
        this._collected = false;
        this._held = false;
        this._thrown = false;
        this._vx = 0;
        this._vy = 0;
    }

    update(dt, scene) {
        if (!scene.player) return;
        if (this._held) {
            this._followHolder(scene);
            if (scene.input?.wasActionPressed?.('interact')) {
                this._throw(scene);
                scene.input.consumeAction?.('interact');
            }
            return;
        }
        if (this._thrown) {
            this._stepThrown(dt, scene);
            return;
        }
        if (this._collected || !this.itemId) return;
        const bounds = getEntityBounds(this.entity, this.properties);
        const playerBounds = getEntityBounds(scene.player, {});
        if (!rectsIntersect(bounds, playerBounds)) return;
        if (this.requireInteract && !scene.input?.wasActionPressed?.('interact')) return;
        if (this.mode === 'hold') {
            if (scene.heldEntity) return;
            this._held = true;
            scene.heldEntity = this.entity;
            scene.input?.consumeAction?.('interact');
            return;
        }
        scene.inventory.add(this.itemId, this.count);
        scene.eventGraphRuntime?.setVariable(this.itemId, scene.inventory.count(this.itemId));
        if (this.healAmount) {
            const dh = scene.player.behaviors?.find((b) => b.currentHealth !== undefined);
            if (dh) {
                dh.currentHealth = Math.min(dh.maxHealth, dh.currentHealth + this.healAmount);
                scene.eventGraphRuntime?.setVariable('hp', dh.currentHealth);
            }
        }
        if (this.properties.onPickupEvent) {
            scene.eventGraphRuntime?.emitCustomEvent(this.properties.onPickupEvent);
        }
        this._collected = true;
        if (this.destroyOnPickup) scene.destroyEntity(this.entity.id);
    }

    _followHolder(scene) {
        const p = scene.player;
        const facing = p.scaleX < 0 ? -1 : 1;
        this.entity.x = p.x + p.width / 2 + facing * 7 - this.entity.width / 2;
        this.entity.y = p.y + 12;
    }

    _throw(scene) {
        const p = scene.player;
        const facing = p.scaleX < 0 ? -1 : 1;
        this._held = false;
        this._thrown = true;
        scene.heldEntity = null;
        this._vx = facing * this.throwSpeedX;
        this._vy = this.throwSpeedY;
        this.entity.x = p.x + p.width / 2 + facing * 7;
        this.entity.y = p.y + 15;
    }

    _stepThrown(dt, scene) {
        this._vy += 760 * dt;
        if (this._vy > 320) this._vy = 320;
        this.entity.x += this._vx * dt;
        this.entity.y += this._vy * dt;
        const tm = scene.getAllEntities()
            .map((e) => e.behaviors?.find((b) => typeof b.rectBlocked === 'function'))
            .find(Boolean);
        if (tm?.rectBlocked(this.entity.x, this.entity.y, this.entity.width || 4, this.entity.height || 8)) {
            this._thrown = false;
            this._vx = 0;
            this._vy = 0;
            return;
        }
        if (Math.abs(this._vx) > 45 || Math.abs(this._vy) > 45) {
            for (const e of scene.getAllEntities()) {
                const dh = e.behaviors?.find((b) => b.contactDamage > 0 && b.enabled);
                if (!dh) continue;
                if (rectsIntersect(
                    { x: this.entity.x, y: this.entity.y, width: 6, height: 10 },
                    getEntityBounds(e, {})
                )) {
                    dh._applyDamage?.(99, scene);
                    this._vy = -60;
                    this._vx *= -0.3;
                    break;
                }
            }
        }
    }
}
