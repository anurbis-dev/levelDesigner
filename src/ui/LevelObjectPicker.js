/**
 * Shared object/dialogue pickers for level-scope authoring (Event Graph, Dialogues).
 */

/**
 * Flatten level objects for &lt;select&gt; options.
 * @param {object|null|undefined} level
 * @returns {{ id: string, label: string }[]}
 */
export function listLevelObjectOptions(level) {
    if (!level) return [];
    const all = typeof level.getAllObjects === 'function'
        ? level.getAllObjects()
        : (level.objects || []);
    return all.map((o) => {
        const id = String(o.id);
        const name = o.name || o.type || o.constructor?.name || 'object';
        return { id, label: `${name} (${id})` };
    });
}

/**
 * @param {object|null|undefined} level
 * @returns {{ id: string, label: string }[]}
 */
export function listDialogueOptions(level) {
    const list = level?.dialogues || [];
    return list.map((d) => ({
        id: String(d.id),
        label: d.id
    }));
}

/**
 * Build a &lt;select&gt; with optional empty row + free-text fallback via datalist-like empty.
 * @param {{
 *   value: string,
 *   options: { id: string, label: string }[],
 *   emptyLabel?: string,
 *   onChange: (value: string) => void
 * }} opts
 * @returns {HTMLSelectElement}
 */
export function createIdSelect(opts) {
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = opts.emptyLabel || '— none —';
    select.appendChild(empty);

    let hasCurrent = !opts.value;
    for (const opt of opts.options || []) {
        const o = document.createElement('option');
        o.value = opt.id;
        o.textContent = opt.label;
        if (String(opts.value) === String(opt.id)) {
            o.selected = true;
            hasCurrent = true;
        }
        select.appendChild(o);
    }
    // Preserve unknown/orphan id so save doesn't wipe authoring typos
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
    return select;
}
