/**
 * Base class for PanelPositionManager's sub-controllers (Фаза 4.5 декомпозиции,
 * tmp/2D_Editor_REFACTOR_PLAN.md). Mirrors core/BaseModule's shape but scoped one level
 * deeper — sub-controllers belong to a PanelPositionManager instance, not directly to
 * LevelEditor, so shared state (levelEditor/stateManager/userPrefs/_initializing) is
 * proxied through the owning manager rather than duplicated per controller.
 */
export class PanelSubController {
    constructor(manager) {
        this.manager = manager;
    }

    get levelEditor() { return this.manager.levelEditor; }
    get stateManager() { return this.manager.stateManager; }
    get userPrefs() { return this.manager.userPrefs; }

    get _initializing() { return this.manager._initializing; }
    set _initializing(value) { this.manager._initializing = value; }
}
