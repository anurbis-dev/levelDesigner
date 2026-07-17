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
 * Fit camera so asset (0,0)–(w,h) is centered with padding.
 * @param {number} cw canvas CSS width
 * @param {number} ch canvas CSS height
 * @param {number} aw asset width
 * @param {number} ah asset height
 * @returns {{ x: number, y: number, zoom: number }}
 */
export function fitCameraToAsset(cw, ch, aw, ah) {
    if (cw < 2 || ch < 2) return { x: 0, y: 0, zoom: 1 };
    const w = Math.max(1, aw);
    const h = Math.max(1, ah);
    // Shrink padding on tiny leaves so fit never goes negative → MIN_ZOOM floor.
    const padX = Math.min(PREVIEW_FIT_PADDING, Math.max(4, cw * 0.1));
    const padY = Math.min(PREVIEW_FIT_PADDING, Math.max(4, ch * 0.1));
    const availW = Math.max(8, cw - padX * 2);
    const availH = Math.max(8, ch - padY * 2);
    const zoom = Math.max(
        PREVIEW_MIN_ZOOM,
        Math.min(PREVIEW_MAX_ZOOM, availW / w, availH / h, 4)
    );
    return {
        zoom,
        x: w / 2 - (cw / 2) / zoom,
        y: h / 2 - (ch / 2) / zoom
    };
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
