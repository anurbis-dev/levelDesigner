import { BehaviorRegistry } from '../BehaviorRegistry.js';
import { ColliderBehavior } from './ColliderBehavior.js';
import { TriggerBehavior } from './TriggerBehavior.js';
import { InteractableBehavior } from './InteractableBehavior.js';
import { PlayerStartBehavior } from './PlayerStartBehavior.js';
import { SpriteAnimationBehavior } from './SpriteAnimationBehavior.js';
import { DialogueTriggerBehavior } from './DialogueTriggerBehavior.js';
import { CameraBehavior } from './CameraBehavior.js';
import { PickupBehavior } from './PickupBehavior.js';
import { DamageHealthBehavior } from './DamageHealthBehavior.js';
import { MovablePushableBehavior } from './MovablePushableBehavior.js';
import { MountableVehicleSeatBehavior } from './MountableVehicleSeatBehavior.js';
import { PathFollowerBehavior } from './PathFollowerBehavior.js';
import { SpawnerBehavior } from './SpawnerBehavior.js';
import { StateMachineBehavior } from './StateMachineBehavior.js';
import { CheckpointSaveBehavior } from './CheckpointSaveBehavior.js';
import { ClimbableLadderBehavior } from './ClimbableLadderBehavior.js';
import { ConveyorZiplineJumpPadPortalBehavior } from './ConveyorZiplineJumpPadPortalBehavior.js';

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
    BehaviorRegistry.register('spriteUiAnimation', SpriteAnimationBehavior);
    BehaviorRegistry.register('dialogueTrigger', DialogueTriggerBehavior);
    BehaviorRegistry.register('camera', CameraBehavior);
    BehaviorRegistry.register('pickup', PickupBehavior);
    BehaviorRegistry.register('damageHealth', DamageHealthBehavior);
    BehaviorRegistry.register('movablePushable', MovablePushableBehavior);
    BehaviorRegistry.register('mountableVehicleSeat', MountableVehicleSeatBehavior);
    BehaviorRegistry.register('pathFollower', PathFollowerBehavior);
    BehaviorRegistry.register('spawner', SpawnerBehavior);
    BehaviorRegistry.register('stateMachineBehavior', StateMachineBehavior);
    BehaviorRegistry.register('checkpointSavePoint', CheckpointSaveBehavior);
    BehaviorRegistry.register('climbableLadder', ClimbableLadderBehavior);
    BehaviorRegistry.register('conveyorZiplineJumpPadPortal', ConveyorZiplineJumpPadPortalBehavior);
}
