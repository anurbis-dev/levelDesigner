/**
 * Editor Constants
 * Centralized configuration values and magic numbers
 * @version 3.36.0
 */

/**
 * Default object properties
 */
export const DEFAULT_OBJECT = {
    X: 0,
    Y: 0,
    WIDTH: 32,
    HEIGHT: 32,
    COLOR: '#cccccc',
    ROTATION: 0,
    VISIBLE: true,
    LOCKED: false
};

/**
 * Performance and caching settings
 */
export const PERFORMANCE = {
    CACHE_TIMEOUT_MS: 100,
    SPATIAL_GRID_SIZE: 256,
    MAX_HISTORY_SIZE: 100,
    RENDER_THROTTLE_MS: 16,  // ~60 FPS
    MOUSE_MOVE_THROTTLE_MS: 8,  // ~120fps for smoother feel
    WHEEL_THROTTLE_MS: 16,  // ~60 FPS
    RESIZE_DEBOUNCE_MS: 150,  // Wait 150ms after last resize
    INPUT_DEBOUNCE_MS: 300  // Wait 300ms after last input
};

/**
 * Grid settings
 */
export const GRID = {
    DEFAULT_SIZE: 32,
    MIN_SIZE: 4,
    MAX_SIZE: 256,
    SNAP_THRESHOLD: 5
};

/**
 * Camera settings
 */
export const CAMERA = {
    DEFAULT_ZOOM: 1.0,
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 10.0,
    ZOOM_STEP: 0.1,
    PAN_SPEED: 1.0,
    /** C1: default design resolution for game-camera view frame gizmo (world size = ref / zoom) */
    VIEW_REF_WIDTH: 1920,
    VIEW_REF_HEIGHT: 1080,
    FRAME_COLOR: 'rgba(56, 189, 248, 0.75)',
    FRAME_COLOR_SELECTED: 'rgba(14, 165, 233, 1)',
    FRAME_WIDTH: 1.5,
    FRAME_DASH: [6, 4]
};

/**
 * UI settings
 */
export const UI = {
    PANEL_MIN_WIDTH: 200,
    PANEL_DEFAULT_WIDTH: 300,
    TOOLBAR_HEIGHT: 40,
    CONTEXT_MENU_WIDTH: 200
};

/**
 * Selection and interaction
 */
export const SELECTION = {
    HIGHLIGHT_COLOR: '#00bcd4',
    HIGHLIGHT_WIDTH: 2,
    HANDLE_SIZE: 8,
    MIN_DRAG_DISTANCE: 3
};

/**
 * Object transform gestures (Ctrl+drag rotate, Ctrl+Alt+drag scale)
 */
export const TRANSFORM = {
    ROTATION_SNAP_DEGREES: 15,  // Fallback if selection.rotationSnapDegrees is unset; user-configurable in Settings → Selection
    SCALE_SNAP_FACTOR: 0.1,     // Fallback if selection.scaleSnapFactor is unset; user-configurable in Settings → Selection
    MIN_SCALE_FACTOR: 0.05,
    MAX_SCALE_FACTOR: 20,
    DRAG_THRESHOLD_PX: 4
};

/**
 * Parallax settings
 */
export const PARALLAX = {
    DEFAULT_FACTOR: 0.5,
    MIN_FACTOR: 0.0,
    MAX_FACTOR: 2.0
};
