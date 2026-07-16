/**
 * Parallax offset math — ported 1:1 from src/utils/ParallaxRenderer.js
 * (getCameraOffset/getParallaxOffset) with no editor/stateManager coupling, per
 * tmp/2D_Editor_ENGINE_PLAN.md §1.2. Keep formulas in sync with the editor's
 * ParallaxRenderer — a saved level must look the same in Play-in-editor as in
 * the editor's own parallax preview.
 */
export class ParallaxController {
    /**
     * @param {{x:number,y:number}} camera
     * @param {{parallaxHorizontal:number,parallaxVertical:number}} settings
     * @param {{x:number,y:number}} startPosition - camera pose captured at scene load
     */
    static getCameraOffset(camera, settings, startPosition) {
        const multiplierX = settings.parallaxHorizontal ?? 1;
        const multiplierY = settings.parallaxVertical ?? 1;

        return {
            x: (camera.x - startPosition.x) * multiplierX,
            y: (camera.y - startPosition.y) * multiplierY
        };
    }

    /**
     * @param {number} layerParallaxOffset
     * @param {{x:number,y:number}} cameraOffset
     */
    static getParallaxOffset(layerParallaxOffset, cameraOffset) {
        if (!layerParallaxOffset) return { x: 0, y: 0 };

        return {
            x: cameraOffset.x * (1 + layerParallaxOffset),
            y: cameraOffset.y * (1 + layerParallaxOffset)
        };
    }
}
