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
import { VariableModifierBehavior } from './VariableModifierBehavior.js';
import { DestructibleContainerBehavior } from './DestructibleContainerBehavior.js';
import { AudioZoneBehavior } from './AudioZoneBehavior.js';
import { TilemapBehavior } from './TilemapBehavior.js';
import { ParticleEffectBehavior } from './ParticleEffectBehavior.js';
import { LightBehavior } from './LightBehavior.js';
import { NineSliceSpriteBehavior } from './NineSliceSpriteBehavior.js';
import { FontTextStyleBehavior } from './FontTextStyleBehavior.js';
import { VolumeBehavior } from './VolumeBehavior.js';

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
    BehaviorRegistry.register('variableModifier', VariableModifierBehavior);
    BehaviorRegistry.register('destructibleContainer', DestructibleContainerBehavior);
    BehaviorRegistry.register('audioZone', AudioZoneBehavior);
    BehaviorRegistry.register('tilemap', TilemapBehavior);
    BehaviorRegistry.register('particleEffect', ParticleEffectBehavior);
    BehaviorRegistry.register('light', LightBehavior);
    BehaviorRegistry.register('nineSliceSprite', NineSliceSpriteBehavior);
    BehaviorRegistry.register('fontTextStyle', FontTextStyleBehavior);
    BehaviorRegistry.register('volume', VolumeBehavior);
}
