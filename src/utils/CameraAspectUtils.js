/**
 * C2/C4: design resolution + letterbox safe-rect + adaptive game-camera pose.
 * Game-source viewports fit the camera design frustum into the canvas (contain),
 * then letterbox bars hide the non-design margins. UI preview only.
 */
import { CAMERA } from '../constants/EditorConstants.js';

/**
 * Design pixel size for a game camera (aspect preset or custom resolution).
 * @param {object|null|undefined} obj - type === 'camera'
 * @returns {{w:number,h:number}}
 */
export function getCameraDesignSize(obj) {
    const props = obj?.properties || {};
    const aspect = props.aspect || CAMERA.DEFAULT_ASPECT;
    if (aspect === 'custom') {
        const w = Number(props.resolutionWidth) > 0 ? Number(props.resolutionWidth) : CAMERA.VIEW_REF_WIDTH;
        const h = Number(props.resolutionHeight) > 0 ? Number(props.resolutionHeight) : CAMERA.VIEW_REF_HEIGHT;
        return { w, h };
    }
    const preset = CAMERA.ASPECT_PRESETS[aspect] || CAMERA.ASPECT_PRESETS[CAMERA.DEFAULT_ASPECT];
    return { w: preset.w, h: preset.h };
}

/**
 * Letterbox/pillarbox safe rect that contains `refW:refH` inside the canvas.
 * @param {number} cw
 * @param {number} ch
 * @param {number} refW
 * @param {number} refH
 * @returns {{safeW:number,safeH:number,ox:number,oy:number}|null}
 */
export function getAspectSafeRect(cw, ch, refW, refH) {
    if (!(cw > 0) || !(ch > 0) || !(refW > 0) || !(refH > 0)) return null;
    const designAspect = refW / refH;
    const canvasAspect = cw / ch;
    let safeW;
    let safeH;
    let ox;
    let oy;
    if (canvasAspect > designAspect) {
        safeH = ch;
        safeW = ch * designAspect;
        ox = (cw - safeW) / 2;
        oy = 0;
    } else {
        safeW = cw;
        safeH = cw / designAspect;
        ox = 0;
        oy = (ch - safeH) / 2;
    }
    return { safeW, safeH, ox, oy };
}

/**
 * Map design-space zoom → editor camera zoom so design frustum fills the safe rect.
 * @param {number} designZoom
 * @param {number} cw
 * @param {number} ch
 * @param {number} refW
 * @param {number} refH
 * @returns {number}
 */
export function designZoomToViewZoom(designZoom, cw, ch, refW, refH) {
    const z = designZoom > 0 ? designZoom : CAMERA.DEFAULT_ZOOM;
    const safe = getAspectSafeRect(cw, ch, refW, refH);
    if (!safe) return z;
    // safeH * z / refH === safeW * z / refW (same aspect)
    return (safe.safeH * z) / refH;
}

/**
 * Inverse of designZoomToViewZoom (user zoom on game viewport → properties.zoom).
 * @param {number} viewZoom
 * @param {number} cw
 * @param {number} ch
 * @param {number} refW
 * @param {number} refH
 * @returns {number}
 */
export function viewZoomToDesignZoom(viewZoom, cw, ch, refW, refH) {
    const vz = viewZoom > 0 ? viewZoom : CAMERA.DEFAULT_ZOOM;
    const safe = getAspectSafeRect(cw, ch, refW, refH);
    if (!safe || !(safe.safeH > 0)) return vz;
    return (vz * refH) / safe.safeH;
}

/**
 * Adaptive game-camera pose for a canvas: center on object, zoom fitted to design.
 * @param {object} obj - type === 'camera'
 * @param {{width?:number,height?:number}|null|undefined} canvas
 * @returns {{x:number,y:number,zoom:number}|null}
 */
export function resolveAdaptiveGameCameraPose(obj, canvas) {
    if (!obj || obj.type !== 'camera') return null;
    const { w: refW, h: refH } = getCameraDesignSize(obj);
    const cw = canvas?.width || 1;
    const ch = canvas?.height || 1;
    let designZoom = obj.properties?.zoom ?? CAMERA.DEFAULT_ZOOM;
    if (!designZoom || designZoom <= 0) designZoom = CAMERA.DEFAULT_ZOOM;

    const viewZoom = designZoomToViewZoom(designZoom, cw, ch, refW, refH);
    const centerX = obj.x + (obj.width || 0) / 2;
    const centerY = obj.y + (obj.height || 0) / 2;
    return {
        zoom: viewZoom,
        x: centerX - cw / (2 * viewZoom),
        y: centerY - ch / (2 * viewZoom)
    };
}
