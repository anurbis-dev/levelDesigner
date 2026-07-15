/**
 * Shift key watch for dock layout-customize gestures.
 */

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
