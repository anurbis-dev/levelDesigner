/**
 * Shared form field builders for CanvasHudForm (inline rows, scrub numbers, anchor grid).
 */

import { ANCHOR_OPTIONS } from './CanvasHudModel.js';
import { applyTo, wireScrub } from '../../utils/NumericInput.js';

export const INPUT_CSS = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
export const BTN_CSS = 'background:#374151;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;';

const ANCHOR_ICONS = {
    topLeft: '↖', topCenter: '↑', topRight: '↗',
    middleLeft: '←', middleCenter: '●', middleRight: '→',
    bottomLeft: '↙', bottomCenter: '↓', bottomRight: '↘'
};

export function fieldLabel(text) {
    const el = document.createElement('div');
    el.style.cssText = 'color:#9ca3af;margin:6px 0 2px;';
    el.textContent = text;
    return el;
}

export function mutedText(text) {
    const el = document.createElement('div');
    el.style.color = '#6b7280';
    el.textContent = text;
    return el;
}

/** Label + control on one horizontal row. */
export function inlineRow(label, control, opts = {}) {
    const row = document.createElement('div');
    row.className = 'canvas-hud-form-row';
    row.style.cssText = [
        'display:flex', 'align-items:center', 'gap:8px',
        'margin-bottom:6px', opts.wrap ? 'flex-wrap:wrap' : ''
    ].filter(Boolean).join(';');
    const lab = document.createElement('span');
    lab.className = 'canvas-hud-form-row__label';
    lab.style.cssText = `color:#9ca3af;flex:0 0 ${opts.labelWidth || '72px'};white-space:nowrap;`;
    lab.textContent = label;
    row.appendChild(lab);
    if (control) {
        control.style.flex = control.style.flex || '1';
        control.style.minWidth = control.style.minWidth || '0';
        row.appendChild(control);
    }
    return row;
}

/**
 * @param {{ value: string, placeholder?: string, options: {id:string,label:string}[], onChange: (v:string) => void, listId: string }} opts
 */
export function datalistInput(opts) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-width:0;';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = opts.value || '';
    input.placeholder = opts.placeholder || '';
    input.setAttribute('list', opts.listId);
    input.style.cssText = INPUT_CSS;
    input.addEventListener('change', () => opts.onChange(input.value.trim()));
    wrap.appendChild(input);

    const datalist = document.createElement('datalist');
    datalist.id = opts.listId;
    for (const o of opts.options || []) {
        const opt = document.createElement('option');
        opt.value = o.id;
        datalist.appendChild(opt);
    }
    wrap.appendChild(datalist);
    return wrap;
}

/**
 * Scrub number field (Details-style). Dispatches input while scrubbing, change on release.
 * @param {{ value?: number, optional?: boolean, step?: number, min?: number, onLive?: (v:number|undefined)=>void, onChange: (v:number|undefined)=>void, width?: string }} opts
 */
export function scrubNumberInput(opts) {
    const {
        value, optional = false, step = 1, min, onLive = null, onChange, width = '64px'
    } = opts;
    const parse = (raw) => {
        const s = String(raw ?? '').trim();
        if (s === '') return optional ? undefined : 0;
        const n = Number(s);
        return Number.isFinite(n) ? n : (optional ? undefined : 0);
    };
    const input = document.createElement('input');
    applyTo(input, {
        value: value == null || value === '' ? '' : String(value),
        style: `${INPUT_CSS}width:${width};flex:0 0 ${width};min-width:${width};cursor:ew-resize;`
    });
    if (min != null) input.min = String(min);
    input.step = String(step);
    if (onLive) input.addEventListener('input', () => onLive(parse(input.value)));
    input.addEventListener('change', () => onChange(parse(input.value)));
    wireScrub(input, {
        step,
        min: min != null ? min : undefined,
        decimals: step < 1 ? 1 : 0
    });
    return input;
}

/**
 * Two labeled scrub fields on one row: `Offset X [n] Offset Y [n]`.
 * @param {object} opts
 */
export function numberPairRow(opts) {
    const {
        labelA, labelB, valueA, valueB, onA, onB,
        optional = false, onLiveA = null, onLiveB = null, min
    } = opts;
    const wrap = document.createElement('div');
    wrap.className = 'canvas-hud-form-row';
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;';

    const add = (label, value, onChange, onLive) => {
        const lab = document.createElement('span');
        lab.style.cssText = 'color:#9ca3af;white-space:nowrap;';
        lab.textContent = label;
        wrap.appendChild(lab);
        wrap.appendChild(scrubNumberInput({
            value, optional, min, onLive, onChange, width: '56px'
        }));
    };
    add(labelA, valueA, onA, onLiveA);
    add(labelB, valueB, onB, onLiveB);
    return wrap;
}

/**
 * 3×3 anchor icon buttons (replaces dropdown).
 * @param {string} value
 * @param {(anchor: string) => void} onChange
 */
export function anchorIconPicker(value, onChange) {
    const grid = document.createElement('div');
    grid.className = 'canvas-hud-anchor-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Anchor');
    const current = value || 'topLeft';
    for (const opt of ANCHOR_OPTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = opt.label;
        btn.setAttribute('aria-label', opt.label);
        btn.dataset.anchor = opt.id;
        btn.textContent = ANCHOR_ICONS[opt.id] || '·';
        if (opt.id === current) btn.classList.add('is-selected');
        btn.addEventListener('click', () => onChange(opt.id));
        grid.appendChild(btn);
    }
    return grid;
}
