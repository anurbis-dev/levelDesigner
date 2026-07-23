/**
 * Shared Image/catalog asset ref control: &lt;select&gt; + drag-drop from Assets panel.
 * Disk paths stay only on type=image assets; consumers store asset id (e.g. imageAssetId).
 */

/**
 * @param {object|null|undefined} assetManager
 * @param {string[]} [assetTypes]
 * @returns {{id:string,label:string}[]}
 */
export function listCatalogAssetOptions(assetManager, assetTypes = ['image']) {
    const types = new Set(assetTypes || ['image']);
    const list = assetManager?.getAllAssets?.() || [];
    return list
        .filter((a) => a && types.has(a.type))
        .map((a) => ({ id: a.id, label: a.name || a.id }));
}

/**
 * Map asset id → persisted asset (same shape runtime scene.assetsById uses).
 * @param {object|null|undefined} assetManager
 * @returns {Map<string, object>}
 */
export function assetsByIdFromManager(assetManager) {
    const map = new Map();
    for (const a of assetManager?.getAllAssets?.() || []) {
        if (a?.id) map.set(a.id, typeof a.toJSON === 'function' ? a.toJSON() : a);
    }
    return map;
}

/**
 * Parse Assets-panel drag payload (`application/json` array of asset ids).
 * @param {DataTransfer|null|undefined} dt
 * @returns {string[]}
 */
export function parseAssetDragIds(dt) {
    if (!dt) return [];
    try {
        const raw = dt.getData('application/json');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (parsed && typeof parsed === 'object' && parsed.id) return [String(parsed.id)];
    } catch {
        /* ignore */
    }
    return [];
}

/**
 * Accept Assets-panel drop of allowed types onto an element; calls onAssetId.
 * @param {HTMLElement} el
 * @param {{
 *   assetManager?: object|null,
 *   assetTypes?: string[],
 *   onAssetId: (id: string) => void
 * }} opts
 */
export function wireAssetDropTarget(el, opts) {
    if (!el || typeof opts?.onAssetId !== 'function') return;
    const types = new Set(opts.assetTypes || ['image']);
    const am = opts.assetManager;

    const allow = (e) => {
        if (!e.dataTransfer?.types?.includes?.('application/json')) return false;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        el.classList.add('asset-ref-drop--active');
        return true;
    };

    el.addEventListener('dragenter', (e) => { allow(e); });
    el.addEventListener('dragover', (e) => { allow(e); });
    el.addEventListener('dragleave', () => {
        el.classList.remove('asset-ref-drop--active');
    });
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('asset-ref-drop--active');
        const ids = parseAssetDragIds(e.dataTransfer);
        for (const id of ids) {
            const asset = am?.getAsset?.(id) || am?.getAssetById?.(id);
            if (asset && types.has(asset.type)) {
                opts.onAssetId(id);
                return;
            }
            // Drop without manager: still accept first id (caller may validate)
            if (!am && id) {
                opts.onAssetId(id);
                return;
            }
        }
    });
}

/**
 * Select of catalog assets + drop zone (from Assets panel).
 * @param {{
 *   value?: string,
 *   assetManager?: object|null,
 *   assetTypes?: string[],
 *   emptyLabel?: string,
 *   onChange: (id: string) => void
 * }} opts
 * @returns {HTMLElement}
 */
export function createAssetRefControl(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'asset-ref-control asset-ref-drop';
    wrap.title = 'Pick or drop an asset from Assets panel';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;width:100%;';

    const select = document.createElement('select');
    select.style.cssText = [
        'width:100%', 'box-sizing:border-box',
        'background:#1f2937', 'color:#e5e7eb',
        'border:1px solid #4b5563', 'border-radius:4px', 'padding:3px 6px'
    ].join(';');

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = opts.emptyLabel || '— none —';
    select.appendChild(empty);

    const options = listCatalogAssetOptions(opts.assetManager, opts.assetTypes || ['image']);
    let hasCurrent = !opts.value;
    for (const opt of options) {
        const o = document.createElement('option');
        o.value = opt.id;
        o.textContent = opt.label;
        if (String(opts.value) === String(opt.id)) {
            o.selected = true;
            hasCurrent = true;
        }
        select.appendChild(o);
    }
    if (opts.value && !hasCurrent) {
        const o = document.createElement('option');
        o.value = String(opts.value);
        o.textContent = `${opts.value} (missing)`;
        o.selected = true;
        select.appendChild(o);
    }

    select.addEventListener('change', () => {
        opts.onChange(select.value);
    });
    wrap.appendChild(select);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:10px;color:#6b7280;';
    hint.textContent = 'drop image asset here';
    wrap.appendChild(hint);

    wireAssetDropTarget(wrap, {
        assetManager: opts.assetManager,
        assetTypes: opts.assetTypes || ['image'],
        onAssetId: (id) => {
            select.value = id;
            if (![...select.options].some((o) => o.value === id)) {
                const o = document.createElement('option');
                o.value = id;
                const asset = opts.assetManager?.getAsset?.(id) || opts.assetManager?.getAssetById?.(id);
                o.textContent = asset?.name || id;
                select.appendChild(o);
                select.value = id;
            }
            opts.onChange(id);
        }
    });

    return wrap;
}
