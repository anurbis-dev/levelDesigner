import { describe, it, expect, beforeAll } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { DestructibleContainerBehavior } from '../../src/engine/behaviors/DestructibleContainerBehavior.js';
import { DamageHealthBehavior } from '../../src/engine/behaviors/DamageHealthBehavior.js';
import { PickupBehavior } from '../../src/engine/behaviors/PickupBehavior.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

beforeAll(() => {
    registerDefaultBehaviors();
});

function makeContainer(x, y, props = {}) {
    const entity = new Entity({ id: 'container', type: 'actor', x, y, width: 32, height: 32 });
    entity.behaviors = [new DestructibleContainerBehavior(entity, { properties: { maxHealth: 20, ...props } })];
    return entity;
}

function makeDamageSource(x, y, contactDamage = 10) {
    const entity = new Entity({ id: 'source', type: 'actor', x, y, width: 32, height: 32 });
    entity.behaviors = [new DamageHealthBehavior(entity, { properties: { contactDamage, layer: 'hazard' } })];
    return entity;
}

function makeScene(entities = []) {
    return {
        entities,
        getAllEntities() {
            return this.entities;
        },
        destroyEntity(id) {
            this.entities = this.entities.filter(e => e.id !== id);
        }
    };
}

describe('DestructibleContainerBehavior', () => {
    it('is solid while alive (no isOverlapping method, like DamageHealthBehavior)', () => {
        const container = makeContainer(0, 0);
        const behavior = container.behaviors[0];
        expect(typeof behavior.isOverlapping).toBe('undefined');
    });

    it('takes lethal damage from a damageHealth entity and destroys itself', () => {
        const container = makeContainer(0, 0, { maxHealth: 20, collidesWith: ['hazard'] });
        const source = makeDamageSource(5, 5, 30); // lethal: 30 damage > 20 health
        const scene = makeScene([container, source]);

        container.behaviors[0].update(0.1, scene);
        expect(scene.entities).not.toContain(container);
    });

    it('spawns a loot entity with pickup component on death when itemId is set', () => {
        const container = makeContainer(50, 100, {
            maxHealth: 20,
            collidesWith: ['hazard'],
            itemId: 'coin_gold',
            count: 5
        });
        const source = makeDamageSource(55, 105, 30);
        const scene = makeScene([container, source]);

        container.behaviors[0].update(0.1, scene);

        // Container destroyed
        expect(scene.entities).not.toContain(container);

        // Loot entity spawned
        const loot = scene.entities.find(e => e.id === 'container__loot');
        expect(loot).toBeDefined();
        expect(loot.x).toBe(50);
        expect(loot.y).toBe(100);

        // Loot has pickup component data
        const pickupComp = loot.components.find(c => c.type === 'pickup');
        expect(pickupComp).toBeDefined();
        expect(pickupComp.properties.itemId).toBe('coin_gold');
        expect(pickupComp.properties.count).toBe(5);

        // Loot has PickupBehavior instantiated
        const pickupBehavior = loot.behaviors.find(b => b instanceof PickupBehavior);
        expect(pickupBehavior).toBeDefined();
        expect(pickupBehavior.itemId).toBe('coin_gold');
        expect(pickupBehavior.count).toBe(5);
    });

    it('does not spawn loot when itemId is empty or missing', () => {
        const container = makeContainer(50, 100, {
            maxHealth: 20,
            collidesWith: ['hazard'],
            itemId: '', // empty
            count: 5
        });
        const source = makeDamageSource(55, 105, 30);
        const scene = makeScene([container, source]);

        container.behaviors[0].update(0.1, scene);

        // Container destroyed
        expect(scene.entities).not.toContain(container);

        // No loot spawned
        const loot = scene.entities.find(e => e.id === 'container__loot');
        expect(loot).toBeUndefined();
    });

    it('survives sub-lethal damage and does not spawn loot', () => {
        const container = makeContainer(0, 0, {
            maxHealth: 20,
            collidesWith: ['hazard'],
            itemId: 'coin_gold',
            count: 5
        });
        const source = makeDamageSource(5, 5, 10); // sub-lethal: 10 damage < 20 health
        const scene = makeScene([container, source]);

        const behavior = container.behaviors[0];
        behavior.update(0.1, scene);

        // Container survives
        expect(scene.entities).toContain(container);
        expect(behavior.currentHealth).toBe(10);

        // No loot spawned
        const loot = scene.entities.find(e => e.id === 'container__loot');
        expect(loot).toBeUndefined();
    });

    it('respects layer matching: does not take damage from mismatched layer', () => {
        const container = makeContainer(0, 0, {
            maxHealth: 20,
            collidesWith: ['hazard'], // only takes from 'hazard' layer
            itemId: 'coin_gold'
        });
        const source = makeDamageSource(5, 5, 30);
        source.behaviors[0].properties.layer = 'player'; // different layer
        const scene = makeScene([container, source]);

        container.behaviors[0].update(0.1, scene);

        // Container survives because layer doesn't match
        expect(scene.entities).toContain(container);
        expect(container.behaviors[0].currentHealth).toBe(20);
    });

    it('inherits invulnerability timer from DamageHealthBehavior', () => {
        const container = makeContainer(0, 0, {
            maxHealth: 20,
            invulnerabilityDuration: 1.0,
            collidesWith: ['hazard'],
            itemId: 'coin_gold'
        });
        const source = makeDamageSource(5, 5, 10);
        const scene = makeScene([container, source]);

        const behavior = container.behaviors[0];

        // First hit
        behavior.update(0.1, scene);
        expect(behavior.currentHealth).toBe(10);

        // Invulnerability active: cannot take damage
        behavior.update(0.1, scene);
        expect(behavior.currentHealth).toBe(10); // no change

        // Wait out invulnerability
        behavior.update(1.0, scene);
        behavior.update(0.1, scene); // now another hit can land
        expect(behavior.currentHealth).toBe(0);
    });

    it('respects destroyOnDeath flag', () => {
        const container = makeContainer(0, 0, {
            maxHealth: 20,
            collidesWith: ['hazard'],
            destroyOnDeath: false,
            itemId: 'coin_gold'
        });
        const source = makeDamageSource(5, 5, 30);
        const scene = makeScene([container, source]);

        container.behaviors[0].update(0.1, scene);

        // Container still in scene (destroyOnDeath=false)
        expect(scene.entities).toContain(container);
        expect(container.behaviors[0]._dead).toBe(true);

        // But loot was still spawned
        const loot = scene.entities.find(e => e.id === 'container__loot');
        expect(loot).toBeDefined();
    });
});
