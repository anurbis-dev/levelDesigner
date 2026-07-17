/**
 * Local camera math for Asset Preview mini-viewport (matches CanvasRenderer camera model).
 */

export const PREVIEW_MIN_ZOOM = 0.1;
export const PREVIEW_MAX_ZOOM = 10;
export const PREVIEW_FIT_PADDING = 40;
export const PREVIEW_ZOOM_WHEEL = 0.1;
export const PREVIEW_ZOOM_MMB = 0.01;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ x: number, y: number, zoom: number }} cam
 * @returns {{ x: number, y: number }}
 */
export function clientToWorld(canvas, clientX, clientY, cam) {
    const rect = canvas.getBoundingClientRect();
    const zoom = cam.zoom > 0 ? cam.zoom : 1;
    return {
        x: (clientX - rect.left) / zoom + cam.x,
        y: (clientY - rect.top) / zoom + cam.y
    };
}

/**
 * Fit camera to a world AABB (same model as ViewportOperations.focusOnBounds).
 * @param {number} cw
 * @param {number} ch
 * @param {number} minX
 * @param {number} minY
 * @param {number} maxX
 * @param {number} maxY
 * @returns {{ x: number, y: number, zoom: number }}
 */
export function fitCameraToBounds(cw, ch, minX, minY, maxX, maxY) {
    if (cw < 2 || ch < 2) return { x: 0, y: 0, zoom: 1 };
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const padX = Math.min(PREVIEW_FIT_PADDING, Math.max(4, cw * 0.1));
    const padY = Math.min(PREVIEW_FIT_PADDING, Math.max(4, ch * 0.1));
    const availW = Math.max(8, cw - padX * 2);
    const availH = Math.max(8, ch - padY * 2);
    const zoom = Math.max(
        PREVIEW_MIN_ZOOM,
        Math.min(PREVIEW_MAX_ZOOM, availW / w, availH / h, 4)
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return {
        zoom,
        x: cx - (cw / 2) / zoom,
        y: cy - (ch / 2) / zoom
    };
}

/**
 * Fit camera so asset (0,0)–(w,h) is centered with padding.
 * @param {number} cw canvas CSS width
 * @param {number} ch canvas CSS height
 * @param {number} aw asset width
 * @param {number} ah asset height
 * @returns {{ x: number, y: number, zoom: number }}
 */
export function fitCameraToAsset(cw, ch, aw, ah) {
    return fitCameraToBounds(cw, ch, 0, 0, Math.max(1, aw), Math.max(1, ah));
}

/**
 * World AABB for a component overlay (collider/trigger AABB, interactable circle, else asset).
 * @param {object|null|undefined} comp
 * @param {number} aw
 * @param {number} ah
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function getComponentBounds(comp, aw, ah) {
    const w = Math.max(1, aw);
    const h = Math.max(1, ah);
    if (!comp || comp.enabled === false) {
        return { minX: 0, minY: 0, maxX: w, maxY: h };
    }
    const p = comp.properties || {};
    const type = comp.type;
    if (type === 'collider' || type === 'trigger') {
        const ox = Number(p.offsetX) || 0;
        const oy = Number(p.offsetY) || 0;
        const bw = p.width != null && p.width !== '' ? Number(p.width) : w;
        const bh = p.height != null && p.height !== '' ? Number(p.height) : h;
        return {
            minX: ox,
            minY: oy,
            maxX: ox + Math.max(1, bw),
            maxY: oy + Math.max(1, bh)
        };
    }
    if (type === 'interactable') {
        const r = Number(p.radius) || 32;
        const cx = w / 2;
        const cy = h / 2;
        return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
    }
    return { minX: 0, minY: 0, maxX: w, maxY: h };
}

/**
 * Zoom keeping world point under (clientX, clientY) fixed.
 * @param {{ x: number, y: number, zoom: number }} camera
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} newZoom
 * @returns {{ x: number, y: number, zoom: number }}
 */
export function zoomAtClient(camera, canvas, clientX, clientY, newZoom) {
    const z = Math.max(PREVIEW_MIN_ZOOM, Math.min(PREVIEW_MAX_ZOOM, newZoom));
    const before = clientToWorld(canvas, clientX, clientY, camera);
    const temp = { ...camera, zoom: z };
    const after = clientToWorld(canvas, clientX, clientY, temp);
    return {
        zoom: z,
        x: camera.x + before.x - after.x,
        y: camera.y + before.y - after.y
    };
}

/**
 * @param {{ x: number, y: number, zoom: number }} camera
 * @param {number} dx client pixels
 * @param {number} dy client pixels
 * @returns {{ x: number, y: number, zoom: number }}
 */
export function panCamera(camera, dx, dy) {
    const z = camera.zoom || 1;
    return {
        zoom: camera.zoom,
        x: camera.x - dx / z,
        y: camera.y - dy / z
    };
}
