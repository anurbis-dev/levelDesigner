import { Entity } from './Entity.js';
import { BehaviorRegistry } from './BehaviorRegistry.js';

/**
 * Converts editor-serialized GameObject/Group data (see docs/RUNTIME_SCHEMA.md) into
 * runtime Entity instances. Single conversion point — validation against RUNTIME_SCHEMA.md
 * belongs here once per-type `properties` contracts are implemented (Фаза 2/3).
 */
export class EntityFactory {
    static fromGameObjectData(data) {
        const entity = new Entity(data);
        entity.behaviors = (entity.components || [])
            .filter(component => component.enabled !== false)
            .map(component => EntityFactory._instantiateBehavior(entity, component))
            .filter(Boolean);
        if (data.type === 'group' && Array.isArray(data.children)) {
            entity.children = data.children.map(child => EntityFactory.fromGameObjectData(child));
        }
        return entity;
    }

    static _instantiateBehavior(entity, componentData) {
        const BehaviorClass = BehaviorRegistry.get(componentData.type);
        if (!BehaviorClass) {
            console.warn(`[engine] component type '${componentData.type}' not implemented, skipped`);
            return null;
        }
        return new BehaviorClass(entity, componentData);
    }
}
