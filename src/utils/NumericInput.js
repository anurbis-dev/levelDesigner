/**
 * NumericInput — single source of truth for scrub-friendly number fields.
 *
 * Native <input type="number"> spinners are banned. All numeric UI must go through
 * this helper so new settings/Details/Actor fields never reintroduce arrows.
 *
 * Usage:
 *   // HTML templates / factories:
 *   NumericInput.htmlAttrs({ id, value, min, max, step, className, dataSetting })
 *   createSettingsInput({ type: 'number', ... })  // already coerced via factory
 *
 *   // After DOM insert:
 *   NumericInput.wireAll(root)
 *   NumericInput.wireScrub(input, { step, min, max, decimals })
 *
 * Markup contract: type="text" inputmode="decimal" data-num="1" class includes "num-input"
 */

export const NUM_CLASS = 'num-input';
export const NUM_ATTR = 'data-num';

/**
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function isNumericField(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    if (el.dataset?.num === '1') return true;
    if (el.classList?.contains(NUM_CLASS) || el.classList?.contains('details-num-input')) return true;
    if (el.type === 'number') return true;
    if (el.classList?.contains('settings-range-edit')) return true;
    return false;
}

/**
 * Parse a numeric field value (empty/invalid → null).
 * @param {HTMLInputElement|string|number} inputOrValue
 * @returns {number|null}
 */
export function parseNumericValue(inputOrValue) {
    const raw = typeof inputOrValue === 'object' && inputOrValue !== null
        ? inputOrValue.value
        : inputOrValue;
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * Attribute string for template literals (no surrounding quotes on type).
 * Always produces scrub-style text field (never type=number).
 * @param {object} [opts]
 * @returns {string} e.g. `type="text" inputmode="decimal" data-num="1" class="num-input ..." ...`
 */
export function htmlAttrs(opts = {}) {
    const {
        id = '',
        name = '',
        value = '',
        min = '',
        max = '',
        step = '',
        className = '',
        placeholder = '',
        dataSetting = '',
        dataProperty = '',
        nested = false,
        style = '',
        extra = '',
        tabindex = null
    } = opts;

    const classes = [NUM_CLASS, className].filter(Boolean).join(' ').trim();
    const parts = [
        'type="text"',
        'inputmode="decimal"',
        'autocomplete="off"',
        'spellcheck="false"',
        `${NUM_ATTR}="1"`
    ];
    if (classes) parts.push(`class="${classes}"`);
    if (id) parts.push(`id="${id}"`);
    if (name) parts.push(`name="${name}"`);
    if (value !== '' && value !== undefined && value !== null) parts.push(`value="${value}"`);
    if (placeholder) parts.push(`placeholder="${placeholder}"`);
    if (min !== '' && min !== undefined && min !== null) parts.push(`min="${min}"`);
    if (max !== '' && max !== undefined && max !== null) parts.push(`max="${max}"`);
    if (step !== '' && step !== undefined && step !== null) parts.push(`step="${step}"`);
    if (dataSetting) parts.push(`data-setting="${dataSetting}"`);
    if (dataProperty) parts.push(`data-property="${dataProperty}"`);
    if (nested) parts.push('data-nested="1"');
    if (style) parts.push(`style="${style}"`);
    if (tabindex !== null && tabindex !== undefined) parts.push(`tabindex="${tabindex}"`);
    if (extra) parts.push(extra);
    return parts.join(' ');
}

/**
 * Create a wired <input> element.
 * @param {object} [opts] - same as htmlAttrs + onInput/onChange/onBlur
 * @returns {HTMLInputElement}
 */
export function createElement(opts = {}) {
    const input = document.createElement('input');
    applyTo(input, opts);
    if (opts.onInput) input.addEventListener('input', opts.onInput);
    if (opts.onChange) input.addEventListener('change', opts.onChange);
    if (opts.onBlur) input.addEventListener('blur', opts.onBlur);
    wireScrub(input, {
        step: opts.step !== '' && opts.step !== undefined ? Number(opts.step) : undefined,
        min: opts.min !== '' && opts.min !== undefined ? Number(opts.min) : undefined,
        max: opts.max !== '' && opts.max !== undefined ? Number(opts.max) : undefined,
        decimals: opts.decimals
    });
    return input;
}

/**
 * Mutate an existing input into scrub-style numeric (idempotent).
 * @param {HTMLInputElement} input
 * @param {object} [opts]
 */
export function applyTo(input, opts = {}) {
    if (!input) return;
    if (input.type === 'number' || opts.forceTypeText !== false) {
        input.type = 'text';
    }
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.num = '1';
    input.classList.add(NUM_CLASS);

    if (opts.id) input.id = opts.id;
    if (opts.name) input.name = opts.name;
    if (opts.value !== undefined && opts.value !== null) input.value = String(opts.value);
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.min !== '' && opts.min !== undefined && opts.min !== null) input.min = String(opts.min);
    if (opts.max !== '' && opts.max !== undefined && opts.max !== null) input.max = String(opts.max);
    if (opts.step !== '' && opts.step !== undefined && opts.step !== null) input.step = String(opts.step);
    if (opts.dataSetting) input.dataset.setting = opts.dataSetting;
    if (opts.dataProperty) input.dataset.property = opts.dataProperty;
    if (opts.className) {
        opts.className.split(/\s+/).filter(Boolean).forEach((c) => input.classList.add(c));
    }
    if (opts.style) input.style.cssText = opts.style;
}

/**
 * Horizontal click-drag scrub (Blender-style).
 * Click without move → focus + select for typing. Drag → continuous value change.
 * @param {HTMLInputElement} input
 * @param {{ step?: number, min?: number, max?: number, decimals?: number }} [opts]
 */
export function wireScrub(input, opts = {}) {
    if (!input || input._numScrubWired) return;
    input._numScrubWired = true;
    applyTo(input, { forceTypeText: true });

    const readStep = () => {
        if (opts.step !== undefined && Number.isFinite(opts.step)) return opts.step;
        const s = parseFloat(input.step);
        return Number.isFinite(s) && s > 0 ? s : 1;
    };
    const readMin = () => {
        if (opts.min !== undefined && Number.isFinite(opts.min)) return opts.min;
        const m = parseFloat(input.min);
        return Number.isFinite(m) ? m : undefined;
    };
    const readMax = () => {
        if (opts.max !== undefined && Number.isFinite(opts.max)) return opts.max;
        const m = parseFloat(input.max);
        return Number.isFinite(m) ? m : undefined;
    };
    const readDecimals = () => {
        if (opts.decimals !== undefined) return opts.decimals;
        const step = readStep();
        return step < 1 ? 2 : (Number.isInteger(step) ? 0 : 1);
    };

    let pointerId = null;
    let startX = 0;
    let startVal = 0;
    let moved = false;
    let scrubbing = false;

    const clamp = (v) => {
        let n = v;
        const min = readMin();
        const max = readMax();
        if (min !== undefined) n = Math.max(min, n);
        if (max !== undefined) n = Math.min(max, n);
        return n;
    };

    input.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (document.activeElement === input) return;
        pointerId = e.pointerId;
        startX = e.clientX;
        startVal = parseFloat(input.value);
        if (!Number.isFinite(startVal)) startVal = 0;
        moved = false;
        scrubbing = true;
        try { input.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        e.preventDefault();
    });

    input.addEventListener('pointermove', (e) => {
        if (!scrubbing || e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) < 3) return;
        moved = true;
        const step = readStep();
        const sens = e.shiftKey ? 0.1 : 1;
        let value = clamp(startVal + dx * step * sens);
        value = Math.round(value / step) * step;
        const decimals = readDecimals();
        input.value = decimals === 0
            ? String(Math.round(value))
            : Number(value).toFixed(decimals);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const endScrub = (e) => {
        if (!scrubbing || (e && e.pointerId !== pointerId)) return;
        scrubbing = false;
        try { input.releasePointerCapture(pointerId); } catch (_) { /* ignore */ }
        pointerId = null;
        if (!moved) {
            input.focus();
            input.select();
            return;
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
    };

    input.addEventListener('pointerup', endScrub);
    input.addEventListener('pointercancel', endScrub);
}

/**
 * Convert + wire every numeric field under root (safe to call repeatedly).
 * Catches leftovers: type=number, .num-input, [data-num], .details-num-input, .settings-range-edit
 * @param {ParentNode|null} [root=document]
 */
export function wireAll(root = document) {
    if (!root?.querySelectorAll) return;
    const nodes = root.querySelectorAll(
        'input[type="number"], input.num-input, input[data-num="1"], input.details-num-input, input.settings-range-edit'
    );
    nodes.forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;
        applyTo(el);
        wireScrub(el);
    });
}

/** Namespace export for convenience */
export const NumericInput = {
    NUM_CLASS,
    NUM_ATTR,
    isNumericField,
    parseNumericValue,
    htmlAttrs,
    createElement,
    applyTo,
    wireScrub,
    wireAll
};

export default NumericInput;
