/**
 * Public entry point for the standalone engine bundle (engine plan §4.1).
 * `npm run build:game`/`build:addon`/`build:event` bundle this file alone via esbuild —
 * nothing outside src/engine/ is reachable from here (src/engine/ stays self-contained,
 * see Фаза 1 architectural note in tmp/2D_Editor_ENGINE_PLAN.md).
 */
export { GameEngine } from './GameEngine.js';
export { EntityFactory } from './EntityFactory.js';
export { BehaviorRegistry } from './BehaviorRegistry.js';
export { ProjectLoader } from './ProjectLoader.js';
