/**
 * Remap content-relative paths after an asset/folder move.
 * Component *AssetId refs stay (ids do not change); path-like strings do.
 */
export class AssetPathRewriter {
    static sortRemaps(remaps) {
        return [...(remaps || [])]
            .filter((r) => r && r.from && r.to && r.from !== r.to)
            .sort((a, b) => b.from.length - a.from.length);
    }

    static rewriteString(value, remaps) {
        if (typeof value !== 'string' || !value || !remaps?.length) return value;
        const raw = value.replace(/\\/g, '/');
        for (const { from, to } of remaps) {
            const hit = AssetPathRewriter._applyOne(raw, from, to);
            if (hit !== raw) return hit;
        }
        return value;
    }

    static _applyOne(raw, from, to) {
        const prefixes = ['', './content/', 'content/', 'root/'];
        for (const p of prefixes) {
            const src = p + from;
            if (raw === src) return p + to;
            if (raw.startsWith(`${src}/`)) return (p + to) + raw.slice(src.length);
        }
        return raw;
    }

    /**
     * Mutate strings in a plain/object graph. Skips functions and cycles.
     * @returns {boolean} whether any string changed
     */
    static rewriteInPlace(obj, remaps, seen = new WeakSet()) {
        if (!obj || typeof obj !== 'object') return false;
        if (seen.has(obj)) return false;
        seen.add(obj);
        let dirty = false;
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const v = obj[i];
                if (typeof v === 'string') {
                    const n = AssetPathRewriter.rewriteString(v, remaps);
                    if (n !== v) {
                        obj[i] = n;
                        dirty = true;
                    }
                } else if (v && typeof v === 'object') {
                    if (AssetPathRewriter.rewriteInPlace(v, remaps, seen)) dirty = true;
                }
            }
            return dirty;
        }
        for (const key of Object.keys(obj)) {
            const v = obj[key];
            if (typeof v === 'function') continue;
            if (typeof v === 'string') {
                const n = AssetPathRewriter.rewriteString(v, remaps);
                if (n !== v) {
                    obj[key] = n;
                    dirty = true;
                }
            } else if (v && typeof v === 'object') {
                if (AssetPathRewriter.rewriteInPlace(v, remaps, seen)) dirty = true;
            }
        }
        return dirty;
    }

    /**
     * Rewrite every catalog asset + the open level. Returns assets whose data changed.
     * @returns {object[]}
     */
    static rewriteAll(editor, remaps) {
        const sorted = AssetPathRewriter.sortRemaps(remaps);
        if (!sorted.length) return [];
        const dirty = [];
        const am = editor?.assetManager;
        for (const asset of am?.getAllAssets?.() || []) {
            if (AssetPathRewriter.rewriteInPlace(asset, sorted)) dirty.push(asset);
        }
        if (editor?.level) AssetPathRewriter.rewriteInPlace(editor.level, sorted);
        const extra = editor?.levelsManager?.getAllSessions?.()
            || editor?.levelsManager?.sessions
            || [];
        for (const session of extra) {
            const level = session?.level || session;
            if (level && level !== editor.level) AssetPathRewriter.rewriteInPlace(level, sorted);
        }
        return dirty;
    }
}
