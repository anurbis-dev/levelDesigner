/**
 * Shift key watch for dock layout-customize gestures (DK-CUR cursor, mid-drag highlights).
 */

export const DOCK_CUSTOMIZE_CLASS = 'dock-customize';

/**
 * Track Shift keyup/keydown mid-gesture so highlights clear without waiting for pointermove.
 * @param {(shiftDown: boolean) => void} onShift
 * @returns {() => void} cleanup
 */
export function bindDockCustomizeKeyWatch(onShift) {
    const handler = (e) => {
        if (e.key !== 'Shift') return;
        onShift(e.type === 'keydown');
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('keyup', handler);
    return () => {
        document.removeEventListener('keydown', handler);
        document.removeEventListener('keyup', handler);
    };
}

/**
 * DK-CUR: body class while Shift held so leaf header drag-gap shows grab (else pointer).
 * Clears on window blur so the class does not stick after Alt-Tab.
 * @param {Element} [target=document.body]
 * @param {string} [className=DOCK_CUSTOMIZE_CLASS]
 * @returns {() => void} cleanup
 */
export function bindDockCustomizeModeClass(target = document.body, className = DOCK_CUSTOMIZE_CLASS) {
    const set = (on) => {
        if (!target) return;
        target.classList.toggle(className, !!on);
    };
    const onKey = (e) => {
        if (e.key !== 'Shift') return;
        // Ignore auto-repeat keydown — class already on.
        if (e.type === 'keydown' && e.repeat) return;
        set(e.type === 'keydown');
    };
    const clear = () => set(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    window.addEventListener('blur', clear);
    return () => {
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKey);
        window.removeEventListener('blur', clear);
        clear();
    };
}
