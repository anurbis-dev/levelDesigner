import { Entity } from './Entity.js';

/**
 * Converts editor-serialized GameObject/Group data (see docs/RUNTIME_SCHEMA.md) into
 * runtime Entity instances. Single conversion point — validation against RUNTIME_SCHEMA.md
 * belongs here once per-type `properties` contracts are implemented (Фаза 2/3).
 */
export class EntityFactory {
    static fromGameObjectData(data) {
        const entity = new Entity(data);
        if (data.type === 'group' && Array.isArray(data.children)) {
            entity.children = data.children.map(child => EntityFactory.fromGameObjectData(child));
        }
        return entity;
    }
}
