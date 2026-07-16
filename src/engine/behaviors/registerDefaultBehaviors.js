import { BehaviorRegistry } from '../BehaviorRegistry.js';
import { ColliderBehavior } from './ColliderBehavior.js';
import { TriggerBehavior } from './TriggerBehavior.js';
import { InteractableBehavior } from './InteractableBehavior.js';
import { PlayerStartBehavior } from './PlayerStartBehavior.js';

/**
 * Registers the Фаза 2 MVP component vertical slice (see docs/RUNTIME_SCHEMA.md).
 * Called explicitly from GameEngine's constructor — idempotent (BehaviorRegistry.register
 * overwrites), not relied upon via import side-effects.
 */
export function registerDefaultBehaviors() {
    BehaviorRegistry.register('collider', ColliderBehavior);
    BehaviorRegistry.register('trigger', TriggerBehavior);
    BehaviorRegistry.register('interactable', InteractableBehavior);
    BehaviorRegistry.register('playerStart', PlayerStartBehavior);
}
