import { Behavior } from './Behavior.js';

/**
 * Marks an entity as the active scene camera (see docs/RUNTIME_SCHEMA.md `camera`).
 * Not driven by the generic update(dt, scene) loop — GameEngine._updateCamera() looks up
 * `scene.cameraEntity` once per tick and calls computeCamera() directly, since positioning
 * needs the mutable `camera`/`canvas` objects that the standard Behavior signature doesn't carry.
 */
export class CameraBehavior extends Behavior {
    /**
     * Mutates `camera.x`/`camera.y` in place toward the follow target, honoring deadzone and
     * bounds clamp. No-op if the target entity can't be resolved (e.g. no player spawned yet).
     * @param {import('../Scene.js').Scene} scene
     * @param {{x:number,y:number,zoom:number}} camera
     * @param {{width:number,height:number}} canvas
     */
    computeCamera(scene, camera, canvas) {
        const target = this._resolveTarget(scene);
        if (!target) return;

        const zoom = camera.zoom || 1;
        const viewW = canvas.width / zoom;
        const viewH = canvas.height / zoom;
        const targetCenterX = target.x + (target.width || 0) / 2;
        const targetCenterY = target.y + (target.height || 0) / 2;
        const curCenterX = camera.x + viewW / 2;
        const curCenterY = camera.y + viewH / 2;

        const deadW = this.properties.deadzoneWidth || 0;
        const deadH = this.properties.deadzoneHeight || 0;

        let nextX = camera.x;
        let nextY = camera.y;
        if (Math.abs(targetCenterX - curCenterX) > deadW / 2) {
            nextX = targetCenterX - viewW / 2;
        }
        if (Math.abs(targetCenterY - curCenterY) > deadH / 2) {
            nextY = targetCenterY - viewH / 2;
        }

        const bounds = this.properties.bounds;
        if (bounds) {
            const maxX = Math.max(bounds.x, bounds.x + bounds.width - viewW);
            const maxY = Math.max(bounds.y, bounds.y + bounds.height - viewH);
            nextX = Math.min(Math.max(nextX, bounds.x), maxX);
            nextY = Math.min(Math.max(nextY, bounds.y), maxY);
        }

        camera.x = nextX;
        camera.y = nextY;
    }

    /** @returns {import('../Entity.js').Entity|null} followTargetId entity, or scene.player. */
    _resolveTarget(scene) {
        const id = this.properties.followTargetId;
        if (id) {
            const found = scene.getAllEntities().find(entity => entity.id === id);
            if (found) return found;
        }
        return scene.player || null;
    }
}
