/**
 * Pure helpers for CanvasHudRenderer — anchor→CSS position and data-binding resolution,
 * split out from the DOM-building class so they're unit-testable without jsdom.
 */

const ANCHOR_PARTS = {
    topLeft: { v: 'top', h: 'left' },
    topCenter: { v: 'top', h: 'center' },
    topRight: { v: 'top', h: 'right' },
    middleLeft: { v: 'middle', h: 'left' },
    middleCenter: { v: 'middle', h: 'center' },
    middleRight: { v: 'middle', h: 'right' },
    bottomLeft: { v: 'bottom', h: 'left' },
    bottomCenter: { v: 'bottom', h: 'center' },
    bottomRight: { v: 'bottom', h: 'right' }
};

/**
 * CSS absolute-position style for a widget anchored to one of the 9 overlay points.
 * offsetX/offsetY are px measured inward from the anchor point.
 * @param {string} anchor - one of ANCHOR_PARTS keys, unknown/missing falls back to topLeft
 * @param {number} [offsetX=0]
 * @param {number} [offsetY=0]
 * @returns {Record<string,string>}
 */
export function resolveAnchorStyle(anchor, offsetX = 0, offsetY = 0) {
    const parts = ANCHOR_PARTS[anchor] || ANCHOR_PARTS.topLeft;
    const style = { position: 'absolute' };

    if (parts.v === 'top') style.top = `${offsetY}px`;
    else if (parts.v === 'bottom') style.bottom = `${offsetY}px`;
    else style.top = '50%';

    if (parts.h === 'left') style.left = `${offsetX}px`;
    else if (parts.h === 'right') style.right = `${offsetX}px`;
    else style.left = '50%';

    const translateX = parts.h === 'center' ? `calc(-50% + ${offsetX}px)` : '0';
    const translateY = parts.v === 'middle' ? `calc(-50% + ${offsetY}px)` : '0';
    if (parts.h === 'center' || parts.v === 'middle') {
        style.transform = `translate(${translateX}, ${translateY})`;
    }
    return style;
}

/**
 * @param {import('./Scene.js').Scene} scene
 * @param {{source:'variable'|'inventoryCount', name?:string, itemId?:string}|null|undefined} binding
 * @returns {*} null when unbound/unresolvable
 */
export function resolveBindingValue(scene, binding) {
    if (!binding) return null;
    if (binding.source === 'variable') {
        return scene?.eventGraphRuntime?.getVariable(binding.name) ?? null;
    }
    if (binding.source === 'inventoryCount') {
        return scene?.inventory?.count(binding.itemId) ?? 0;
    }
    return null;
}

/**
 * Resolves a progressBar widget's fill fraction: bound value / binding.max, clamped to [0,1].
 * @param {import('./Scene.js').Scene} scene
 * @param {{max?: number}|null|undefined} binding
 * @returns {number}
 */
export function resolveProgressFraction(scene, binding) {
    if (!binding) return 0;
    const max = Number(binding.max) || 1;
    if (max <= 0) return 0;
    const value = Number(resolveBindingValue(scene, binding)) || 0;
    return Math.min(1, Math.max(0, value / max));
}

/**
 * Image widget texture URL: catalog Image asset via `imageAssetId` (preferred).
 * Legacy `imgSrc` path is only used when no asset id is set (old levels).
 * Disk paths belong on type=image assets, not on widgets/components.
 * @param {{imageAssetId?: string, imgSrc?: string}|null|undefined} widget
 * @param {Map<string, {imgSrc?: string, type?: string}>|Record<string, {imgSrc?: string}>|null|undefined} assetsById
 * @returns {string|null}
 */
export function resolveWidgetImageSrc(widget, assetsById) {
    if (!widget) return null;
    const id = widget.imageAssetId;
    if (id && assetsById) {
        const asset = typeof assetsById.get === 'function'
            ? assetsById.get(id)
            : assetsById[id];
        const src = asset?.imgSrc;
        if (typeof src === 'string' && src) return src;
    }
    if (!id && typeof widget.imgSrc === 'string' && widget.imgSrc) return widget.imgSrc;
    return null;
}

/**
 * Widget display text: binding value (if bound and resolvable) else the static `text` field.
 * @param {import('./Scene.js').Scene} scene
 * @param {{text?: string, binding?: object}} widget
 * @returns {string}
 */
export function resolveDisplayText(scene, widget) {
    if (widget.binding) {
        const value = resolveBindingValue(scene, widget.binding);
        if (value !== null && value !== undefined) return String(value);
    }
    return widget.text || '';
}
