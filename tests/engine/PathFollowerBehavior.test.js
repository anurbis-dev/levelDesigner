import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { PathFollowerBehavior } from '../../src/engine/behaviors/PathFollowerBehavior.js';

function makeFollower(x, y, props = {}) {
    const entity = new Entity({ id: 'e1', type: 'actor', x, y, width: 10, height: 10 });
    entity.behaviors = [new PathFollowerBehavior(entity, { properties: props })];
    return entity;
}

describe('PathFollowerBehavior', () => {
    it('does nothing with fewer than 2 waypoints', () => {
        const entity = makeFollower(0, 0, { waypoints: [{ x: 0, y: 0 }], speed: 100 });
        entity.behaviors[0].update(1, {});
        expect(entity.x).toBe(0);
        expect(entity.y).toBe(0);
    });

    it('moves toward the next waypoint at the configured speed', () => {
        const entity = makeFollower(0, 0, { waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }], speed: 50 });
        entity.behaviors[0].update(1, {});
        expect(entity.x).toBe(50);
        expect(entity.y).toBe(0);
    });

    it('snaps to the waypoint and advances instead of overshooting', () => {
        const entity = makeFollower(0, 0, { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], speed: 100 });
        const follower = entity.behaviors[0];
        follower.update(1, {});
        expect(entity.x).toBe(10);
        expect(entity.y).toBe(0);
        follower.update(1, {});
        expect(entity.x).toBe(10);
        expect(entity.y).toBe(10);
    });

    it('loop mode wraps back to the first waypoint after the last', () => {
        const entity = makeFollower(0, 0, { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }], speed: 100, mode: 'loop' });
        const follower = entity.behaviors[0];
        follower.update(1, {}); // reach waypoint 1 (10,0), target wraps to 0
        follower.update(1, {}); // heads back to (0,0)
        expect(entity.x).toBe(0);
        expect(entity.y).toBe(0);
    });

    it('once mode stops after reaching the last waypoint', () => {
        const entity = makeFollower(0, 0, { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }], speed: 100, mode: 'once' });
        const follower = entity.behaviors[0];
        follower.update(1, {});
        expect(entity.x).toBe(10);
        follower.update(1, {}); // no more targets, stays put
        expect(entity.x).toBe(10);
    });

    it('pingpong mode reverses direction at the last waypoint', () => {
        const entity = makeFollower(0, 0, { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }], speed: 100, mode: 'pingpong' });
        const follower = entity.behaviors[0];
        follower.update(1, {}); // reach (10,0), reverse toward (0,0)
        follower.update(1, {});
        expect(entity.x).toBe(0);
        follower.update(1, {}); // reverse again toward (10,0)
        expect(entity.x).toBe(10);
    });

    it('pauses at a waypoint for waitAtWaypoint seconds before continuing', () => {
        const entity = makeFollower(0, 0, {
            waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
            speed: 100,
            waitAtWaypoint: 1
        });
        const follower = entity.behaviors[0];
        follower.update(1, {}); // reaches (10,0), starts waiting
        expect(entity.x).toBe(10);
        follower.update(0.5, {}); // still waiting
        expect(entity.x).toBe(10);
        follower.update(0.5, {}); // wait elapsed, but this tick only consumes the wait
        expect(entity.x).toBe(10);
        follower.update(1, {}); // now resumes moving toward (20,0)
        expect(entity.x).toBe(20);
    });

    it('waypoints are offsets from the entity spawn position, not absolute', () => {
        const entity = makeFollower(50, 50, { waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }], speed: 100 });
        entity.behaviors[0].update(1, {});
        expect(entity.x).toBe(60);
        expect(entity.y).toBe(50);
    });
});
