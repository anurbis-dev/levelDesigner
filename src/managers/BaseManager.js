/**
 * Base class for src/managers/* — minimal lifecycle contract, no editor dependency.
 * Managers (StateManager, ConfigManager, etc.) are created in LevelEditor's constructor
 * before other subsystems exist, so unlike core/BaseModule.js they cannot assume
 * this.editor is available. init()/destroy() are optional hooks subclasses may override;
 * default implementations are no-ops so managers without extra setup/cleanup don't need to.
 */
export class BaseManager {
    init() {}

    destroy() {}
}
