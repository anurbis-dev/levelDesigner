import { EntityFactory } from './EntityFactory.js';

/**
 * Runtime scene — one loaded level's worth of entities/layers/settings/camera.
 * Engine-side counterpart of editor's Level, stripped to what playback needs
 * (no undo/index caches/notify callbacks — those serve editing, not playback).
 */
export class Scene {
    constructor(levelData = {}) {
        this.entities = (levelData.objects || []).map(obj => EntityFactory.fromGameObjectData(obj));
        this.layers = levelData.layers || [];
        this.settings = {
            backgroundColor: levelData.settings?.backgroundColor || '#4B5563',
            parallaxHorizontal: levelData.settings?.parallaxHorizontal ?? 1,
            parallaxVertical: levelData.settings?.parallaxVertical ?? 1
        };
        this.camera = {
            x: levelData.camera?.x || 0,
            y: levelData.camera?.y || 0,
            zoom: levelData.camera?.zoom || 1
        };
    }

    getLayersSorted() {
        return [...this.layers].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    getLayerById(layerId) {
        return this.layers.find(layer => layer.id === layerId);
    }

    getVisibleLayerIds() {
        return new Set(this.layers.filter(layer => layer.visible !== false).map(layer => layer.id));
    }
}
