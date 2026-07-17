import { Behavior } from './Behavior.js';

/**
 * Design-time reference to a Dialogue Graph (Фаза E) — pure data holder, no enter/exit or
 * range logic of its own (docs/ASSET_TYPES_CATALOG.md: "fired via Interactable/Trigger").
 * The Event Graph's StartDialogue action still carries its own `dialogueId` param
 * (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md Фаза E schema) — this component exists so the level
 * format/property panel has somewhere to store which Dialogue Graph an object represents,
 * same role `layer` plays for `trigger`/`collider`.
 */
export class DialogueTriggerBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.dialogueId = this.properties.dialogueId ?? null;
        this.layer = this.properties.layer ?? null;
    }
}
