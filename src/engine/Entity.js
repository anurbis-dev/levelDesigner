/**
 * Runtime entity — engine-side counterpart of editor's GameObject/Group.
 * Deliberately thinner: no `locked` (editor-only), no editor helper methods
 * (getBounds/containsPoint/clone/toJSON — those serve editing, not playback).
 */
export class Entity {
    constructor(data = {}) {
        this.id = data.id;
        this.name = data.name || 'Unnamed Entity';
        this.type = data.type || 'object';
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.width = data.width || 32;
        this.height = data.height || 32;
        this.color = data.color || '#cccccc';
        this.rotation = data.rotation || 0;
        this.imgSrc = data.imgSrc || null;
        this.visible = data.visible !== undefined ? data.visible : true;
        this.layerId = data.layerId || null;
        this.properties = data.properties || {};
        this.components = data.components || [];
        this.children = data.children || null;
    }
}
