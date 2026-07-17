/**
 * Base class for runtime component behaviors. Instantiated by EntityFactory from a
 * component stub {id,type,enabled,properties} (see src/constants/ComponentTypes.js).
 * update(dt, scene) is a no-op by default — most Фаза 2 behaviors are query-based,
 * not time-integrated; the (dt, scene) signature is kept stable for future components
 * (e.g. transformAnimation, pathFollower) that will need it.
 * `type`/`enabled` stay live after construction — Event Graph's SetComponentEnabled
 * (Фаза D) flips `.enabled` at runtime by matching `.type`, distinct from the
 * authoring-time enabled flag EntityFactory already filters on before instantiation.
 */
export class Behavior {
    constructor(entity, componentData = {}) {
        this.entity = entity;
        this.type = componentData.type || null;
        this.properties = componentData.properties || {};
        this.enabled = componentData.enabled !== false;
    }

    update(dt, scene) {}
}
