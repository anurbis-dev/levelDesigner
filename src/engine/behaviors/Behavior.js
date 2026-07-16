/**
 * Base class for runtime component behaviors. Instantiated by EntityFactory from a
 * component stub {id,type,enabled,properties} (see src/constants/ComponentTypes.js).
 * update(dt, scene) is a no-op by default — most Фаза 2 behaviors are query-based,
 * not time-integrated; the (dt, scene) signature is kept stable for future components
 * (e.g. transformAnimation, pathFollower) that will need it.
 */
export class Behavior {
    constructor(entity, componentData = {}) {
        this.entity = entity;
        this.properties = componentData.properties || {};
        this.enabled = componentData.enabled !== false;
    }

    update(dt, scene) {}
}
