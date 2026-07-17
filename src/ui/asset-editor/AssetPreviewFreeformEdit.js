/**
 * Freeform collider point editing for Asset Preview (add / move / delete).
 */
import {
    resolveColliderShape,
    resolveFreeformPoints,
    defaultFreeformPoints,
    hitTestVertex
} from './AssetColliderGeometry.js';
import {
    getEditingAsset,
    getEditingComponentId,
    patchEditingComponent
} from './AssetEditorContext.js';
import { clientToWorld } from './AssetPreviewCamera.js';

/** World hit radius scales with zoom (screen ~8px). */
export function freeformHitRadius(zoom) {
    const z = zoom > 0 ? zoom : 1;
    return Math.max(2, 8 / z);
}

/**
 * @param {object|null} comp
 * @returns {boolean}
 */
export function isFreeformShapeComponent(comp) {
    if (!comp || (comp.type !== 'collider' && comp.type !== 'trigger')) return false;
    return resolveColliderShape(comp.properties) === 'freeform';
}

/**
 * Ensure points array exists on component properties (seed rectangle if empty).
 * @param {object} levelEditor
 * @param {string} assetId
 * @param {string} componentId
 * @param {number} aw
 * @param {number} ah
 * @returns {{ x: number, y: number }[]}
 */
export function ensureFreeformPoints(levelEditor, assetId, componentId, aw, ah) {
    const asset = getEditingAsset(levelEditor);
    const comp = asset?.components?.find((c) => c.id === componentId);
    if (!comp) return defaultFreeformPoints(aw, ah);
    const existing = resolveFreeformPoints(comp.properties);
    if (existing) return existing.map((p) => ({ ...p }));
    const seeded = defaultFreeformPoints(aw, ah, comp.properties);
    // Seed once into history (user-visible data change)
    patchEditingComponent(levelEditor, assetId, componentId, (c) => {
        c.properties = { ...(c.properties || {}), points: seeded.map((p) => ({ ...p })) };
        return c;
    }, { recordHistory: true });
    return seeded.map((p) => ({ ...p }));
}

/**
 * Mount toolbar on preview host. Returns controller.
 * @param {HTMLElement} host
 * @param {{
 *   getActive: () => boolean,
 *   getTool: () => 'add'|'move'|'delete',
 *   setActive: (v: boolean) => void,
 *   setTool: (t: 'add'|'move'|'delete') => void,
 *   isVisible: () => boolean
 * }} api
 */
export function mountFreeformToolbar(host, api) {
    let bar = host.querySelector(':scope > .ae-freeform-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'ae-freeform-bar';
        bar.style.cssText = [
            'position:absolute',
            'left:8px',
            'top:8px',
            'z-index:5',
            'display:none',
            'flex-direction:column',
            'gap:4px',
            'font:11px system-ui,sans-serif',
            'pointer-events:auto',
            'user-select:none'
        ].join(';');
        bar.innerHTML = `
            <button type="button" data-act="toggle" class="ae-ff-btn"
                style="padding:4px 8px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;cursor:pointer;">
                Edit freeform
            </button>
            <div data-tools style="display:none;gap:4px;align-items:center;">
                <button type="button" data-tool="add" class="ae-ff-btn" style="padding:3px 6px;border-radius:4px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;cursor:pointer;">Add</button>
                <button type="button" data-tool="move" class="ae-ff-btn" style="padding:3px 6px;border-radius:4px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;cursor:pointer;">Move</button>
                <button type="button" data-tool="delete" class="ae-ff-btn" style="padding:3px 6px;border-radius:4px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;cursor:pointer;">Delete</button>
            </div>
            <div data-hint style="display:none;color:#94a3b8;max-width:200px;line-height:1.3;"></div>
        `;
        host.appendChild(bar);
    }

    const toggleBtn = bar.querySelector('[data-act="toggle"]');
    const toolsRow = bar.querySelector('[data-tools]');
    const hint = bar.querySelector('[data-hint]');

    const onClick = (e) => {
        const t = e.target.closest('[data-act],[data-tool]');
        if (!t || !bar.contains(t)) return;
        e.preventDefault();
        e.stopPropagation();
        if (t.dataset.act === 'toggle') {
            api.setActive(!api.getActive());
            refresh();
            return;
        }
        if (t.dataset.tool) {
            api.setTool(/** @type {'add'|'move'|'delete'} */ (t.dataset.tool));
            if (!api.getActive()) api.setActive(true);
            refresh();
        }
    };
    bar.addEventListener('click', onClick);

    function refresh() {
        const vis = api.isVisible();
        bar.style.display = vis ? 'flex' : 'none';
        if (!vis) return;
        const active = api.getActive();
        const tool = api.getTool();
        toggleBtn.textContent = active ? 'Exit edit' : 'Edit freeform';
        toggleBtn.style.background = active ? '#334155' : '#1e293b';
        toolsRow.style.display = active ? 'flex' : 'none';
        hint.style.display = active ? 'block' : 'none';
        if (active) {
            const hints = {
                add: 'LMB empty: add vertex',
                move: 'LMB drag vertex',
                delete: 'LMB vertex: remove'
            };
            hint.textContent = hints[tool] || '';
        }
        bar.querySelectorAll('[data-tool]').forEach((btn) => {
            const on = btn.dataset.tool === tool && active;
            btn.style.background = on ? '#2563eb' : '#0f172a';
            btn.style.borderColor = on ? '#3b82f6' : '#475569';
        });
    }

    return {
        refresh,
        destroy() {
            bar.removeEventListener('click', onClick);
            bar.remove();
        }
    };
}

/**
 * Handle LMB down for freeform tools. Returns drag state or null.
 * @param {object} opts
 * @returns {{ mode: 'move', index: number }|null} drag or null if handled without drag
 */
export function freeformPointerDown(opts) {
    const {
        levelEditor, canvas, camera, clientX, clientY,
        tool, aw, ah
    } = opts;
    const asset = getEditingAsset(levelEditor);
    const compId = getEditingComponentId(levelEditor);
    if (!asset || !compId) return null;
    const comp = (asset.components || []).find((c) => c.id === compId);
    if (!isFreeformShapeComponent(comp)) return null;

    // Baseline before any freeform mutation / drag
    const hm = levelEditor?.historyManager;
    const am = levelEditor?.assetManager;
    if (hm && am?.snapshotForHistory) {
        hm.ensureAssetBaseline(am.snapshotForHistory());
    }

    const world = clientToWorld(canvas, clientX, clientY, camera);
    const pts = ensureFreeformPoints(levelEditor, asset.id, compId, aw, ah);
    const hitR = freeformHitRadius(camera.zoom);
    const idx = hitTestVertex(pts, world.x, world.y, hitR);

    if (tool === 'add') {
        if (idx >= 0) {
            // Click on existing → start move for convenience
            return { mode: 'move', index: idx };
        }
        const next = [...pts, { x: world.x, y: world.y }];
        patchPoints(levelEditor, asset.id, compId, next, { recordHistory: true });
        return null;
    }

    if (tool === 'delete') {
        if (idx >= 0 && pts.length > 0) {
            const next = pts.filter((_, i) => i !== idx);
            patchPoints(levelEditor, asset.id, compId, next, { recordHistory: true });
        }
        return null;
    }

    // move
    if (idx >= 0) return { mode: 'move', index: idx };
    return null;
}

/**
 * @param {object} levelEditor
 * @param {string} assetId
 * @param {string} componentId
 * @param {number} index
 * @param {number} x
 * @param {number} y
 */
export function freeformMovePoint(levelEditor, assetId, componentId, index, x, y, aw, ah) {
    const asset = getEditingAsset(levelEditor);
    const comp = asset?.components?.find((c) => c.id === componentId);
    if (!comp) return;
    const pts = resolveFreeformPoints(comp.properties)
        || defaultFreeformPoints(aw, ah, comp.properties);
    if (index < 0 || index >= pts.length) return;
    const next = pts.map((p, i) => (i === index ? { x, y } : { ...p }));
    // Drag intermediate: commit history once on pointerup via recordAssetEditorHistory
    patchPoints(levelEditor, assetId, componentId, next, { recordHistory: false });
}

/**
 * @param {object} levelEditor
 * @param {string} assetId
 * @param {string} componentId
 * @param {{ x: number, y: number }[]} points
 */
/**
 * @param {object} levelEditor
 * @param {string} assetId
 * @param {string} componentId
 * @param {{ x: number, y: number }[]} points
 * @param {{ recordHistory?: boolean }} [opts]
 */
function patchPoints(levelEditor, assetId, componentId, points, opts = {}) {
    patchEditingComponent(levelEditor, assetId, componentId, (c) => {
        c.properties = {
            ...(c.properties || {}),
            shape: 'freeform',
            points: points.map((p) => ({ x: p.x, y: p.y }))
        };
        return c;
    }, opts);
}
