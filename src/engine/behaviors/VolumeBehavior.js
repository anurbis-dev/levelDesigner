import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';

/**
 * §7 volume: arbitrary-shape trigger zone that applies a canvas 2D view filter
 * (blur / color / shadow) while the player is inside.
 *
 * Same zone discipline as audioZone / variableModifier: reacts only to
 * `scene.player`, never solid. Filter shape matches `entity.materialPreset`
 * (`Renderer._buildFilterString`). Optional `presetAssetId` merges catalog
 * `materialShaderPreset` (or any asset with filter fields) when component
 * fields are empty.
 *
 * Properties:
 * - shape/offset/width/height/radius/points — AABB via getEntityBounds
 * - blur, brightness, saturate, hueRotate — CSS filter knobs
 * - dropShadow — `{x?,y?,blur?,color?}` JSON
 * - presetAssetId — catalog merge when component field empty
 * - priority — higher wins when multiple volumes overlap (default 0)
 * - enabled (default true)
 *
 * Duck-types:
 * - `getViewFilter()` — active preset object or null (Renderer post-pass)
 * - never solid (`isOverlapping` false)
 */
export class VolumeBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.blur = this.properties.blur ?? 0;
        this.brightness = this.properties.brightness;
        this.saturate = this.properties.saturate;
        this.hueRotate = this.properties.hueRotate ?? 0;
        this.dropShadow = this.properties.dropShadow ?? null;
        this.presetAssetId = this.properties.presetAssetId ?? '';
        this.priority = this.properties.priority ?? 0;
        this.enabled = this.properties.enabled !== false;
        this._playerInside = false;
        this._presetMerged = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    isOverlapping() {
        return false;
    }

    /**
     * Active view filter while player is inside; null otherwise.
     * @returns {object|null}
     */
    getViewFilter() {
        if (!this.enabled || !this._playerInside) return null;
        return this._buildPreset();
    }

    update(_dt, scene) {
        this.ensurePresetResolved(scene);
        if (!this.enabled || !scene?.player) {
            this._playerInside = false;
            return;
        }
        this._playerInside = rectsIntersect(
            this.getBounds(),
            getEntityBounds(scene.player, {})
        );
    }

    /**
     * Merge catalog material/filter asset once (component non-empty wins).
     * @param {import('../Scene.js').Scene|null|undefined} scene
     */
    ensurePresetResolved(scene) {
        if (this._presetMerged || !this.presetAssetId || !scene?.assetsById) return;
        const asset = scene.assetsById.get(this.presetAssetId);
        if (!asset) {
            this._presetMerged = true;
            return;
        }
        const src = VolumeBehavior._assetFilterBag(asset);
        if (!src) {
            this._presetMerged = true;
            return;
        }
        // Component values already applied in ctor; fill only empty/default gaps.
        if (!(this.blur > 0) && src.blur != null) this.blur = src.blur;
        if (this.brightness === undefined && src.brightness !== undefined) {
            this.brightness = src.brightness;
        }
        if (this.saturate === undefined && src.saturate !== undefined) {
            this.saturate = src.saturate;
        }
        if (!(this.hueRotate) && src.hueRotate != null) this.hueRotate = src.hueRotate;
        if (!this.dropShadow && src.dropShadow) this.dropShadow = src.dropShadow;
        this._presetMerged = true;
    }

    /**
     * @param {object} asset
     * @returns {object|null}
     */
    static _assetFilterBag(asset) {
        if (!asset) return null;
        const bag = asset.properties && typeof asset.properties === 'object'
            ? asset.properties
            : asset;
        const has =
            bag.blur != null ||
            bag.brightness !== undefined ||
            bag.saturate !== undefined ||
            bag.hueRotate != null ||
            bag.dropShadow;
        if (!has && bag.materialPreset && typeof bag.materialPreset === 'object') {
            return bag.materialPreset;
        }
        return has ? bag : null;
    }

    /**
     * @returns {object|null} materialPreset-shaped object, or null if empty
     */
    _buildPreset() {
        const preset = {};
        if (this.blur) preset.blur = this.blur;
        if (this.brightness !== undefined) preset.brightness = this.brightness;
        if (this.saturate !== undefined) preset.saturate = this.saturate;
        if (this.hueRotate) preset.hueRotate = this.hueRotate;
        if (this.dropShadow && typeof this.dropShadow === 'object') {
            preset.dropShadow = this.dropShadow;
        }
        return Object.keys(preset).length ? preset : null;
    }
}
