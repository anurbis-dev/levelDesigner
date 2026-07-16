import { describe, it, expect } from 'vitest';
import { TriggerBehavior } from '../../src/engine/behaviors/TriggerBehavior.js';
import { ColliderBehavior } from '../../src/engine/behaviors/ColliderBehavior.js';

function entityWithCollider(id, x, y, width = 10, height = 10) {
    const entity = { id, x, y, width, height, behaviors: [] };
    entity.behaviors.push(new ColliderBehavior(entity, { properties: {} }));
    return entity;
}

describe('TriggerBehavior.checkEntities', () => {
    it('reports entered on the frame an entity starts overlapping', () => {
        const zoneEntity = { id: 'zone', x: 0, y: 0, width: 20, height: 20, behaviors: [] };
        const trigger = new TriggerBehavior(zoneEntity, { properties: {} });
        const player = entityWithCollider('player', 5, 5);

        const result = trigger.checkEntities([player]);
        expect(result.entered).toEqual(['player']);
        expect(result.exited).toEqual([]);
    });

    it('reports neither entered nor exited while the entity stays overlapping', () => {
        const zoneEntity = { id: 'zone', x: 0, y: 0, width: 20, height: 20, behaviors: [] };
        const trigger = new TriggerBehavior(zoneEntity, { properties: {} });
        const player = entityWithCollider('player', 5, 5);

        trigger.checkEntities([player]);
        const second = trigger.checkEntities([player]);
        expect(second.entered).toEqual([]);
        expect(second.exited).toEqual([]);
    });

    it('reports exited on the frame an entity stops overlapping', () => {
        const zoneEntity = { id: 'zone', x: 0, y: 0, width: 20, height: 20, behaviors: [] };
        const trigger = new TriggerBehavior(zoneEntity, { properties: {} });
        const player = entityWithCollider('player', 5, 5);

        trigger.checkEntities([player]);
        player.x = 500;
        const result = trigger.checkEntities([player]);
        expect(result.entered).toEqual([]);
        expect(result.exited).toEqual(['player']);
    });

    it('ignores candidates without a getBounds-capable behavior', () => {
        const zoneEntity = { id: 'zone', x: 0, y: 0, width: 20, height: 20, behaviors: [] };
        const trigger = new TriggerBehavior(zoneEntity, { properties: {} });
        const decorative = { id: 'decor', x: 5, y: 5, width: 10, height: 10, behaviors: [] };

        const result = trigger.checkEntities([decorative]);
        expect(result.entered).toEqual([]);
    });

    it('isOverlapping() reflects the last checkEntities() call', () => {
        const zoneEntity = { id: 'zone', x: 0, y: 0, width: 20, height: 20, behaviors: [] };
        const trigger = new TriggerBehavior(zoneEntity, { properties: {} });
        const player = entityWithCollider('player', 5, 5);

        expect(trigger.isOverlapping('player')).toBe(false);
        trigger.checkEntities([player]);
        expect(trigger.isOverlapping('player')).toBe(true);
    });

    it('ignores itself even if present in the candidate list', () => {
        const zoneEntity = { id: 'zone', x: 0, y: 0, width: 20, height: 20, behaviors: [] };
        const trigger = new TriggerBehavior(zoneEntity, { properties: {} });
        zoneEntity.behaviors.push(trigger);

        const result = trigger.checkEntities([zoneEntity]);
        expect(result.entered).toEqual([]);
    });
});
