import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { NavMeshBehavior } from '../../src/engine/behaviors/NavMeshBehavior.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';

function makeMesh(x, y, props = {}, entityOpts = {}) {
    const entity = new Entity({
        id: 'nav', type: 'navMesh', x, y, width: 80, height: 80, ...entityOpts
    });
    const behavior = new NavMeshBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

describe('NavMeshBehavior', () => {
    it('never solid', () => {
        const { behavior } = makeMesh(0, 0);
        expect(behavior.isOverlapping()).toBe(false);
        expect(typeof behavior.getBounds).toBe('function');
    });

    it('containsWorldPoint is true inside open mesh', () => {
        const { behavior } = makeMesh(0, 0, { cellSize: 10 });
        expect(behavior.containsWorldPoint(10, 10)).toBe(true);
        expect(behavior.containsWorldPoint(200, 200)).toBe(false);
    });

    it('blocked rects are not walkable', () => {
        const { behavior } = makeMesh(0, 0, {
            cellSize: 10,
            blocked: [{ x: 20, y: 20, width: 20, height: 20 }]
        });
        expect(behavior.containsWorldPoint(25, 25)).toBe(false);
        expect(behavior.containsWorldPoint(5, 5)).toBe(true);
    });

    it('findPath returns straight-ish route in open mesh', () => {
        const { behavior } = makeMesh(0, 0, { cellSize: 10 });
        const path = behavior.findPath(5, 5, 75, 5);
        expect(path).toBeTruthy();
        expect(path.length).toBeGreaterThan(0);
        expect(path[path.length - 1].x).toBeCloseTo(75);
        expect(path[path.length - 1].y).toBeCloseTo(5);
    });

    it('findPath routes around blocked obstacle', () => {
        // Full-width vertical wall with a gap at the bottom
        const { behavior } = makeMesh(0, 0, {
            cellSize: 10,
            blocked: [{ x: 30, y: 0, width: 20, height: 60 }]
        });
        const path = behavior.findPath(10, 10, 70, 10);
        expect(path).toBeTruthy();
        // Path must dip below the wall (y >= 60) at some point
        const clearsWall = path.some(p => p.y >= 55);
        expect(clearsWall).toBe(true);
        // Never enter blocked column center
        for (const p of path) {
            if (p.x >= 30 && p.x < 50 && p.y < 60) {
                // cell centers near the wall may graze; require strict interior miss
                expect(p.y).toBeGreaterThanOrEqual(55);
            }
        }
    });

    it('findPath null when start or goal off-mesh', () => {
        const { behavior } = makeMesh(0, 0, { cellSize: 10 });
        expect(behavior.findPath(-10, 5, 40, 40)).toBe(null);
        expect(behavior.findPath(5, 5, 400, 400)).toBe(null);
    });

    it('disabled mesh rejects points and paths', () => {
        const { behavior } = makeMesh(0, 0, { enabled: false });
        expect(behavior.containsWorldPoint(10, 10)).toBe(false);
        expect(behavior.findPath(5, 5, 40, 40)).toBe(null);
    });

    it('merges navMeshAssetId cellSize/blocked when component empty', () => {
        const { behavior } = makeMesh(0, 0, {
            navMeshAssetId: 'mesh_a',
            blocked: []
        });
        const assetsById = new Map([['mesh_a', {
            id: 'mesh_a',
            type: 'navMesh',
            properties: {
                cellSize: 20,
                blocked: [{ x: 0, y: 0, width: 10, height: 10 }]
            }
        }]]);
        behavior.update(0, { assetsById });
        expect(behavior.cellSize).toBe(20);
        expect(behavior.blocked).toEqual([{ x: 0, y: 0, width: 10, height: 10 }]);
        expect(behavior.containsWorldPoint(5, 5)).toBe(false);
    });

    it('findPathInScene picks the mesh covering both endpoints', () => {
        const a = makeMesh(0, 0, { cellSize: 10 });
        const b = makeMesh(200, 0, { cellSize: 10 }, { id: 'nav2', width: 80, height: 80 });
        const scene = { entities: [a.entity, b.entity] };
        const path = NavMeshBehavior.findPathInScene(scene, 5, 5, 70, 70);
        expect(path).toBeTruthy();
        expect(path[path.length - 1].x).toBeCloseTo(70);
        const pathB = NavMeshBehavior.findPathInScene(scene, 210, 10, 260, 60);
        expect(pathB).toBeTruthy();
        expect(NavMeshBehavior.findPathInScene(scene, 5, 5, 210, 10)).toBe(null);
    });

    it('registers via registerDefaultBehaviors', () => {
        registerDefaultBehaviors();
        expect(BehaviorRegistry.get('navMesh')).toBe(NavMeshBehavior);
    });
});
