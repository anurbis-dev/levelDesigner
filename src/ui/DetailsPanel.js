import { GroupTraversalUtils } from '../utils/GroupTraversalUtils.js';
import { UIFactory } from '../utils/UIFactory.js';
import { ResetRegistry } from '../utils/ResetRegistry.js';
import { DEFAULT_OBJECT, CAMERA } from '../constants/EditorConstants.js';
import { ShortcutFormatter } from '../utils/ShortcutFormatter.js';
import { NumericInput } from '../utils/NumericInput.js';

// Default value per Transform field, keyed by the input's data-property (see
// createTransformsSectionHTML) — used by Backspace-to-reset (ResetRegistry).
const TRANSFORM_DEFAULTS = {
    x: DEFAULT_OBJECT.X,
    y: DEFAULT_OBJECT.Y,
    width: DEFAULT_OBJECT.WIDTH,
    height: DEFAULT_OBJECT.HEIGHT,
    rotation: DEFAULT_OBJECT.ROTATION
};

/**
 * Details panel UI component
 */
export class DetailsPanel {
    /**
     * @param {HTMLElement} container
     * @param {object} stateManager
     * @param {object} levelEditor
     * @param {{ instanceKey?: string, isPrimary?: boolean }} [options]
     */
    constructor(container, stateManager, levelEditor, options = {}) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.instanceKey = options.instanceKey || null;
        this.isPrimary = options.isPrimary !== false && !this.instanceKey;
        this.resetRegistryKey = this.instanceKey
            ? `detailsPanel-${this.instanceKey}`
            : 'detailsPanel';

        // Track subscriptions for cleanup
        this.subscriptions = [];
        // Track event listeners
        this.eventListeners = [];
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to selection changes
        const unsubscribeSelected = this.stateManager.subscribe('selectedObjects', () => {
            this.render();
            this.updateTabTitle();
        });
        this.subscriptions.push(unsubscribeSelected);

        // Subscribe to level changes (for object property updates like layer changes)
        const unsubscribeLevel = this.stateManager.subscribe('level', (newLevel, oldLevel) => {

            // Check if selected objects properties changed (excluding position changes)
            const selectedIds = this.stateManager.get('selectedObjects');
            if (selectedIds && selectedIds.size > 0) {
                const firstId = Array.from(selectedIds)[0];
                const newObj = newLevel.objects?.find(obj => obj.id === firstId);
                const oldObj = oldLevel?.objects?.find(obj => obj.id === firstId);
                
                
                // Only re-render if non-position properties changed
                if (oldObj && newObj) {
                    const positionChanged = (oldObj.x !== newObj.x || oldObj.y !== newObj.y);
                    if (positionChanged) {
                        return;
                    }
                }
            }

            this.render();
            this.updateTabTitle();
        });
        this.subscriptions.push(unsubscribeLevel);

        // Subscribe to level structure changes (object/layer add/remove/reorder) — see
        // Level.setStructureChangeCallback. Needed in
        // particular for the no-selection level-stats view (renderNoSelection/
        // renderLevelContent), which must stay live as objects are added/removed elsewhere.
        const unsubscribeStructure = this.stateManager.subscribe('levelStructureChanged', () => {
            this.render();
            this.updateTabTitle();
        });
        this.subscriptions.push(unsubscribeStructure);

        // Subscribe to object property changes (for immediate updates like layer changes)
        const unsubscribeProperty = this.stateManager.subscribe('objectPropertyChanged', (changedObject, changeData) => {
            const selectedIds = this.stateManager.get('selectedObjects');
            if (!selectedIds || !selectedIds.has(changedObject?.id)) return;

            const prop = changeData?.property;
            // Transform / camera pose: cheap field refresh (no DOM rebuild — preserves focus/scrub)
            if (prop === 'x' || prop === 'y' || prop === 'width' || prop === 'height'
                || prop === 'rotation' || prop === 'properties.zoom' || prop === 'zoom') {
                this.refreshTransformFieldsLive();
                return;
            }

            // Structural / non-numeric: full re-render
            this.render();
            this.updateTabTitle();
        });
        this.subscriptions.push(unsubscribeProperty);
    }

    render() {
        this.container.innerHTML = '';
        // Rebuilt on every render by renderVisualProperties/setupTransformsListeners (and their
        // multi-select variants) via registerResettable(); committed to ResetRegistry below so
        // Backspace-to-reset (see ResetRegistry.js) always reflects what's currently on screen.
        this._resettableFields = [];

        const selectedObjects = this.getSelectedObjects();

        if (selectedObjects.length === 0) {
            this.renderNoSelection();
            ResetRegistry.setFields(this.resetRegistryKey, this._resettableFields);
            return;
        }

        if (selectedObjects.length === 1) {
            this.renderSingleObject(selectedObjects[0]);
        } else {
            this.renderMultipleObjects(selectedObjects);
        }

        ResetRegistry.setFields(this.resetRegistryKey, this._resettableFields);

        // Catch any numeric fields (scrub wiring; converts leftover type=number)
        NumericInput.wireAll(this.container);

        // Update tab title after rendering content
        this.updateTabTitle();
    }

    /**
     * Register an input as resettable-to-default via the Backspace hover gesture.
     * @param {HTMLElement} element - The actual input/select element
     * @param {*|Function} defaultValueOrReset - Value to restore when reset, or (if a
     *   function) a custom reset callback for fields whose default isn't a single static
     *   value — e.g. width/height, whose "default" is the size of the specific asset the
     *   object was created from, which can differ per object in a multi-selection.
     */
    registerResettable(element, defaultValueOrReset) {
        if (!element) return;
        if (typeof defaultValueOrReset === 'function') {
            this._resettableFields.push({ element, reset: defaultValueOrReset });
        } else {
            this._resettableFields.push({ element, defaultValue: defaultValueOrReset });
        }
    }

    /**
     * Default width/height for an object. Falls back to the generic DEFAULT_OBJECT size
     * unless the object was instantiated from an asset (matched by imgSrc) — each asset can
     * have its own natural size, which is the real "default" to reset back to.
     * @param {Object} obj
     * @returns {{width: number, height: number}}
     */
    getObjectDefaultSize(obj) {
        const assets = this.levelEditor?.assetManager?.getAllAssets?.() || [];
        const asset = obj.imgSrc ? assets.find(a => a.imgSrc === obj.imgSrc) : null;
        return {
            width: asset ? asset.width : DEFAULT_OBJECT.WIDTH,
            height: asset ? asset.height : DEFAULT_OBJECT.HEIGHT
        };
    }

    renderNoSelection() {
        // Show level content when no object is selected
        if (this.levelEditor && this.levelEditor.cachedLevelStats) {
            this.renderLevelContent();
        } else {
            this.container.innerHTML = '<p style="color: var(--ui-text-color, #9ca3af);">Select an object to see its properties.</p>';
        }
        // Update tab title (Level / Details)
        this.updateTabTitle();
    }

    renderSingleObject(obj) {

        if (obj.type === 'group') {
            this.renderGroupDetails(obj);
        } else {
            this.renderObjectDetails(obj);
        }
    }

    renderGroupDetails(group) {
        this.container.innerHTML = '';

        // Create compact layout with sections (same as for objects)
        this.renderCompactObjectDetails(group);

        // Add statistics section for groups
        this.renderGroupStatistics(group);

        // Add layer information section for groups
        this.renderLayerInfo(group);
    }

    /**
     * Render group statistics section
     * @param {Object} group - Group object
     */
    renderGroupStatistics(group) {
        const section = this.createSection('Group Contents');
        
        const childAssets = this.getAllChildren(group).filter(o => o.type !== 'group').length;
        const childGroups = this.getAllChildren(group).filter(o => o.type === 'group').length;
        
        section._content.innerHTML += `
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="text-center">
                    <div class="text-lg font-bold text-blue-400">${childAssets}</div>
                    <div style="color: var(--ui-text-color, #9ca3af);">Assets</div>
                </div>
                <div class="text-center">
                    <div class="text-lg font-bold text-green-400">${childGroups}</div>
                    <div style="color: var(--ui-text-color, #9ca3af);">Groups</div>
                </div>
            </div>
        `;
        
        this.container.appendChild(section);
    }

    /**
     * Render compact object details with sections
     * @param {Object} obj - Object to render details for
     */
    renderCompactObjectDetails(obj) {
        // Basic Properties Section
        this.renderBasicProperties(obj);
        
        // Transforms Section (Position & Size)
        this.renderTransformsSection(obj);

        // Camera Section (zoom, matching the editor's working camera shape) — camera-type only
        if (obj.type === 'camera') {
            this.renderCameraObjectProperties(obj);
        }

        // Visual Properties Section
        this.renderVisualProperties(obj);
        
        // Advanced Properties Section
        this.renderAdvancedProperties(obj);
        
        // Custom Properties Section
        this.renderCustomProperties(obj);
    }

    /**
     * Render basic properties (name, type)
     */
    renderBasicProperties(obj) {
        const section = this.createSection('Basic Properties');
        
        // Name
        const nameContainer = UIFactory.createLabeledInput({
            label: 'Name',
            type: 'text',
            value: obj.name || '',
            onChange: (e) => obj.name = e.target.value,
            onBlur: () => this.notifyPropertyChange(obj, 'name', obj.name)
        });
        section._content.appendChild(nameContainer);

        // Type (read-only)
        const typeContainer = UIFactory.createLabeledInput({
            label: 'Type',
            type: 'text',
            value: obj.type || 'unknown',
            disabled: true
        });
        section._content.appendChild(typeContainer);

        this.container.appendChild(section);
    }

    /**
     * Render transforms section with compact position and size inputs
     */
    renderTransformsSection(obj) {
        const section = this.createTransformsSectionHTML(obj);
        
        // Set initial values
        const inputs = section.querySelectorAll('input[data-property]');
        inputs.forEach(input => {
            const property = input.dataset.property;
            input.value = (obj[property] || 0).toFixed(1);
        });
        
        // Add event listeners for transforms
        this.setupTransformsListeners(section, obj);
        
        this.container.appendChild(section);
    }

    /**
     * Render camera-object properties (zoom) — mirrors the editor's working viewport
     * camera shape {x, y, zoom}: x/y already come from the Transform/Position row,
     * this adds the missing zoom so ViewportOperations.jumpToCamera() has a real
     * value to apply to the viewport instead of always assuming 1.
     */
    renderCameraObjectProperties(obj) {
        const section = this.createSection('Camera');
        obj.properties = obj.properties || {};

        // C3: exclusive main/default camera for level (engine play + jump fallback)
        const mainRow = document.createElement('div');
        mainRow.className = 'details-field-row';
        mainRow.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;';
        const mainLabel = document.createElement('label');
        mainLabel.textContent = 'Main';
        mainLabel.htmlFor = 'details-camera-main';
        mainLabel.style.cssText = 'flex:0 0 4.5rem;font-size:0.8rem;color:var(--ui-text-color,#9ca3af);';
        const mainCheck = document.createElement('input');
        mainCheck.type = 'checkbox';
        mainCheck.id = 'details-camera-main';
        mainCheck.checked = !!obj.properties.isMain;
        // Implicit main: first camera when none marked — show checked for resolved main
        if (!mainCheck.checked) {
            const main = this.levelEditor?.viewportViewManager?.getMainCameraObject?.();
            if (main && main.id === obj.id) {
                const anyExplicit = (this.levelEditor?.viewportViewManager?.listGameCameraObjects?.() || [])
                    .some((c) => c?.properties?.isMain);
                if (!anyExplicit) mainCheck.checked = true;
            }
        }
        mainCheck.addEventListener('change', () => {
            const vvm = this.levelEditor?.viewportViewManager;
            if (vvm?.setMainCamera) {
                vvm.setMainCamera(obj.id, mainCheck.checked);
            } else {
                obj.properties.isMain = mainCheck.checked;
                this.notifyPropertyChange(obj, 'properties.isMain', mainCheck.checked);
            }
            // Refresh Details so exclusive main unchecks siblings if multi-select rare
            this.render();
            this.levelEditor?.render?.();
        });
        const mainHint = document.createElement('span');
        mainHint.textContent = 'level default';
        mainHint.style.cssText = 'font-size:0.75rem;color:#6b7280;';
        mainRow.appendChild(mainLabel);
        mainRow.appendChild(mainCheck);
        mainRow.appendChild(mainHint);
        section._content.appendChild(mainRow);

        const zoomRow = this.createDualFieldRow('Zoom', [
            { prefix: 'Z', property: 'zoom', id: 'details-camera-zoom', step: '0.05', nested: true }
        ]);
        section._content.appendChild(zoomRow);

        // C2: aspect preset (drives frame gizmo + game-viewport letterbox)
        const aspectRow = document.createElement('div');
        aspectRow.className = 'details-field-row';
        aspectRow.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-top:0.35rem;';
        const aspectLabel = document.createElement('label');
        aspectLabel.textContent = 'Aspect';
        aspectLabel.htmlFor = 'details-camera-aspect';
        aspectLabel.style.cssText = 'flex:0 0 4.5rem;font-size:0.8rem;color:var(--ui-text-color,#9ca3af);';
        const aspectSelect = document.createElement('select');
        aspectSelect.id = 'details-camera-aspect';
        aspectSelect.className = 'details-input';
        aspectSelect.style.cssText = 'flex:1;min-width:0;background:#374151;color:var(--ui-text-color,#d1d5db);border:1px solid #4b5563;border-radius:0.25rem;padding:0.2rem 0.35rem;font-size:0.8rem;';
        const aspects = [
            { v: '16:9', t: '16:9' },
            { v: '4:3', t: '4:3' },
            { v: '1:1', t: '1:1' },
            { v: '3:2', t: '3:2' },
            { v: '21:9', t: '21:9' },
            { v: 'custom', t: 'Custom' }
        ];
        const curAspect = obj.properties.aspect || '16:9';
        aspects.forEach(({ v, t }) => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = t;
            if (v === curAspect) opt.selected = true;
            aspectSelect.appendChild(opt);
        });
        aspectSelect.addEventListener('change', () => {
            obj.properties.aspect = aspectSelect.value;
            this.notifyPropertyChange(obj, 'properties.aspect', aspectSelect.value);
            this.levelEditor?.render?.();
            // Re-render details for custom res fields
            if (aspectSelect.value === 'custom' || curAspect === 'custom') {
                this.render();
            }
        });
        aspectRow.appendChild(aspectLabel);
        aspectRow.appendChild(aspectSelect);
        section._content.appendChild(aspectRow);

        if ((obj.properties.aspect || '16:9') === 'custom') {
            const resRow = this.createDualFieldRow('Resolution', [
                { prefix: 'W', property: 'resolutionWidth', id: 'details-camera-res-w', step: '1', nested: true },
                { prefix: 'H', property: 'resolutionHeight', id: 'details-camera-res-h', step: '1', nested: true }
            ]);
            section._content.appendChild(resRow);
            this.wireCameraNestedNumber(obj, resRow.querySelector('#details-camera-res-w'), {
                key: 'resolutionWidth',
                defaultValue: 1920,
                min: 16,
                integer: true,
                decimals: 0
            });
            this.wireCameraNestedNumber(obj, resRow.querySelector('#details-camera-res-h'), {
                key: 'resolutionHeight',
                defaultValue: 1080,
                min: 16,
                integer: true,
                decimals: 0
            });
        }

        const vigRow = this.createDualFieldRow('Vignette', [
            { prefix: 'V', property: 'vignette', id: 'details-camera-vignette', step: '0.05', nested: true }
        ]);
        section._content.appendChild(vigRow);

        this.container.appendChild(section);

        this.wireCameraNestedNumber(obj, zoomRow.querySelector('#details-camera-zoom'), {
            key: 'zoom',
            defaultValue: 1,
            min: 0.01,
            decimals: 2
        });
        this.wireCameraNestedNumber(obj, vigRow.querySelector('#details-camera-vignette'), {
            key: 'vignette',
            defaultValue: CAMERA.VIGNETTE_STRENGTH,
            min: 0,
            max: 1,
            decimals: 2
        });
    }

    /**
     * Camera nested properties (properties.*) — live viewport on input, history/dirty on blur.
     * @param {object} obj
     * @param {HTMLInputElement|null} input
     * @param {{ key: string, defaultValue: number, min?: number, max?: number, integer?: boolean, decimals?: number }} opts
     */
    wireCameraNestedNumber(obj, input, opts) {
        if (!input) return;
        const decimals = opts.decimals ?? 2;
        const format = (v) => (opts.integer ? String(Math.round(v)) : v.toFixed(decimals));
        const parse = (raw) => {
            let value = opts.integer ? parseInt(raw, 10) : parseFloat(raw);
            if (!Number.isFinite(value)) value = opts.defaultValue;
            if (opts.min !== undefined && value < opts.min) value = opts.min;
            if (opts.max !== undefined && value > opts.max) value = opts.max;
            return value;
        };

        const initial = obj.properties?.[opts.key];
        input.value = format(initial === undefined || initial === null ? opts.defaultValue : Number(initial));
        if (opts.min !== undefined) input.min = String(opts.min);
        if (opts.max !== undefined) input.max = String(opts.max);

        const applyLive = (raw) => {
            const value = parse(raw);
            obj.properties = obj.properties || {};
            obj.properties[opts.key] = value;
            // Immediate multi-viewport feedback (vignette / zoom / res → letterbox)
            this.levelEditor?.render?.();
            return value;
        };

        input.addEventListener('input', (e) => {
            if (e.target.value === '' || e.target.value === '-' || e.target.value === '.') return;
            applyLive(e.target.value);
        });
        input.addEventListener('blur', (e) => {
            const value = applyLive(e.target.value);
            e.target.value = format(value);
            this.notifyPropertyChange(obj, `properties.${opts.key}`, value);
        });

        this.wireNumberScrub(input, {
            decimals,
            min: opts.min,
            max: opts.max,
            step: parseFloat(input.step) || (opts.integer ? 1 : 0.05)
        });
    }

    /**
     * Render visual properties (color)
     */
    renderVisualProperties(obj) {
        const section = this.createSection('Visual');
        
        // Color
        const colorContainer = UIFactory.createLabeledInput({
            label: 'Color',
            type: 'color',
            value: obj.color || '#3B82F6',
            onChange: (e) => {
                obj.color = e.target.value;
                this.notifyPropertyChange(obj, 'color', obj.color);
            }
        });
        this.registerResettable(colorContainer.querySelector('input'), DEFAULT_OBJECT.COLOR);
        section._content.appendChild(colorContainer);

        this.container.appendChild(section);
    }

    /**
     * Render advanced properties (stacking order)
     */
    renderAdvancedProperties(obj) {
        const section = this.createSection('Advanced');
        section._content.appendChild(this.createOrderButtonsRow([obj]));
        this.container.appendChild(section);
    }

    /**
     * Create a row of stacking-order buttons (Bring to Front / Send to Back / Bring Forward /
     * Send Backward — standard Illustrator/Figma naming). Order is just array position within
     * the object's parent container (level.objects or a group's children) — see
     * Level.compareStackOrder / ObjectOperations.bringToFront etc. Shortcuts are defined in
     * config/defaults/shortcuts.json and handled in EventHandlers.handleKeyDown.
     * @param {Array} objects - Objects to reorder when a button is clicked
     * @returns {HTMLElement}
     */
    createOrderButtonsRow(objects) {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-2 gap-2';

        // U2: titles from live shortcuts.json (not hardcoded Ctrl+…)
        const orderShortcut = {
            bringToFront: 'editor.bringToFront',
            sendToBack: 'editor.sendToBack',
            moveForward: 'editor.bringForward',
            moveBackward: 'editor.sendBackward'
        };
        const showTips = this.stateManager?.get?.('ui.showTooltips') !== false;
        const cm = this.levelEditor?.configManager;
        const actions = [
            { text: 'Bring to Front', action: 'bringToFront' },
            { text: 'Send to Back', action: 'sendToBack' },
            { text: 'Bring Forward', action: 'moveForward' },
            { text: 'Send Backward', action: 'moveBackward' }
        ];

        actions.forEach(({ text, action }) => {
            const sc = showTips
                ? ShortcutFormatter.resolveLabel(cm, orderShortcut[action])
                : '';
            row.appendChild(UIFactory.createButton({
                text,
                title: showTips ? ShortcutFormatter.formatTitle(text, sc) : undefined,
                variant: 'secondary',
                onClick: () => this.levelEditor.objectOperations.applyStackOrderActionToSelection(action)
            }));
        });

        return row;
    }

    /**
     * Create a section container with title
     * @param {string} title - Section title
     * @returns {HTMLElement} Section container
     */
    createSection(title) {
        const section = document.createElement('div');
        section.className = 'mb-6';
        
        // Create section header with separator line
        const header = document.createElement('div');
        header.className = 'flex items-center mb-3';
        
        const titleElement = document.createElement('h3');
        titleElement.className = 'text-sm font-semibold mr-3 flex-shrink-0';
        titleElement.style.color = 'var(--ui-text-color, #d1d5db)';
        titleElement.textContent = title;
        
        // Add separator line
        const separator = document.createElement('div');
        separator.className = 'flex-1 h-px bg-gray-700';
        
        header.appendChild(titleElement);
        header.appendChild(separator);
        
        // Create content container with padding
        const content = document.createElement('div');
        content.className = 'px-3';
        
        section.appendChild(header);
        section.appendChild(content);
        
        // Store reference to content container for adding elements
        section._content = content;
        return section;
    }

    /**
     * Create a single-line "label + N number fields" row (label left, fields sharing the rest
     * of the row) — shared by Transform's Position/Size/Rotation rows and the Level panel's
     * Parallax multiplier row, so a label never sits on its own line above its control(s).
     * Number fields: no spinner arrows; value via type or horizontal click-drag scrub.
     * @param {string} label - Row label
     * @param {Array<{prefix: string, property: string, id?: string, step?: string, nested?: boolean}>} fields
     * @returns {HTMLElement}
     */
    createDualFieldRow(label, fields) {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = 'flex: 0 0 40%; text-align: right; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        row.appendChild(labelEl);

        const fieldsWrap = document.createElement('div');
        fieldsWrap.className = 'flex gap-2 flex-1';
        fields.forEach(f => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'flex-1 relative';
            // NumericInput: type=text + scrub; never native type=number spinners
            fieldDiv.innerHTML = `
                <span class="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs pointer-events-none" style="color: var(--ui-text-color, #9ca3af);">${f.prefix}</span>
                <input ${NumericInput.htmlAttrs({
                    id: f.id || '',
                    step: f.step || '',
                    className: 'details-num-input w-full bg-gray-700 border border-gray-600 rounded px-6 py-1 text-sm',
                    placeholder: '0',
                    dataProperty: f.property,
                    nested: !!f.nested
                })}>
            `;
            fieldsWrap.appendChild(fieldDiv);
        });
        row.appendChild(fieldsWrap);

        return row;
    }

    /**
     * @param {HTMLInputElement} input
     * @param {{ step?: number, min?: number, max?: number, decimals?: number }} [opts]
     */
    wireNumberScrub(input, opts = {}) {
        NumericInput.wireScrub(input, opts);
    }

    /**
     * Create transforms section HTML
     * @param {Object|Array} objOrObjects - Single object or array of objects
     * @returns {HTMLElement} Section container
     */
    createTransformsSectionHTML(objOrObjects) {
        const section = this.createSection('Transform');

        const rows = document.createElement('div');
        rows.className = 'space-y-2';

        rows.appendChild(this.createDualFieldRow('Position', [
            { prefix: 'X', property: 'x', id: 'details-position-x' },
            { prefix: 'Y', property: 'y', id: 'details-position-y' }
        ]));

        rows.appendChild(this.createDualFieldRow('Size', [
            { prefix: 'W', property: 'width', id: 'details-size-width' },
            { prefix: 'H', property: 'height', id: 'details-size-height' }
        ]));

        rows.appendChild(this.createDualFieldRow('Rotation', [
            { prefix: '°', property: 'rotation', id: 'details-rotation', step: '1' }
        ]));

        section._content.appendChild(rows);

        return section;
    }

    /**
     * Setup event listeners for transforms section
     * @param {HTMLElement} section - Section container
     * @param {Object} obj - Object being edited
     */
    setupTransformsListeners(section, obj) {
        const inputs = section.querySelectorAll('input[data-property]');
        const sizeDefaults = this.getObjectDefaultSize(obj);

        inputs.forEach(input => {
            const property = input.dataset.property;
            const defaultValue = (property === 'width' || property === 'height')
                ? sizeDefaults[property]
                : TRANSFORM_DEFAULTS[property];
            this.registerResettable(input, defaultValue);

            input.addEventListener('input', (e) => {
                if (e.target.value === '' || e.target.value === '-' || e.target.value === '.') return;
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;

                obj[property] = value;

                // Live canvas feedback while typing / scrubbing.
                // History + full listener notification (markDirty, tab title, etc.)
                // still only fire on blur to avoid flooding undo with per-keystroke entries.
                if (this.levelEditor && this.levelEditor.render) {
                    this.levelEditor.render();
                }
            });

            input.addEventListener('blur', (e) => {
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;

                obj[property] = value;
                e.target.value = value.toFixed(1);
                this.notifyPropertyChange(obj, property, value);
            });

            this.wireNumberScrub(input, {
                step: parseFloat(input.step) || 1,
                decimals: 1,
                min: (property === 'width' || property === 'height') ? 1 : undefined
            });
        });
    }

    /**
     * Notify about property change
     * @param {Object} obj - Object that changed
     * @param {string} property - Property name
     * @param {any} newValue - New value
     */
    notifyPropertyChange(obj, property, newValue) {
        this.stateManager.markDirty();

        // Nested keys like properties.zoom — oldValue from root would be wrong
        let oldValue;
        if (typeof property === 'string' && property.startsWith('properties.')) {
            const key = property.slice('properties.'.length);
            oldValue = obj.properties?.[key];
        } else {
            oldValue = obj[property];
        }

        this.stateManager.notifyListeners('objectPropertyChanged', obj, {
            property,
            oldValue,
            newValue
        });

        // Canvas only — do NOT re-fire selectedObjects (that full-rebuilds Details/Outliner/Layers
        // via EventHandlers and steals focus / breaks live scrub).
        if (this.levelEditor && this.levelEditor.render) {
            this.levelEditor.render();
        }

        // Name/color affect Outliner labels and chrome — refresh lists without Details rebuild
        if (property === 'name' || property === 'color') {
            this.levelEditor?.outlinerPanel?.render?.();
            this.levelEditor?.forEachDockPanelCopy?.('outliner', (p) => p.render?.());
            this.levelEditor?.toolbar?.updateCameraButtons?.();
        }

        this.updateTabTitle();
    }

    renderObjectDetails(obj) {
        this.container.innerHTML = '';

        // Create compact layout with sections
        this.renderCompactObjectDetails(obj);

        // Add layer information section
        this.renderLayerInfo(obj);
    }

    renderMultipleObjects(objects) {
        this.container.innerHTML = '';

        // Create compact layout with sections (same as single object)
        this.renderCompactMultipleObjects(objects);
    }

    /**
     * Render compact multiple objects details with sections
     * @param {Array} objects - Array of objects to render details for
     */
    renderCompactMultipleObjects(objects) {
        // Basic Properties Section
        this.renderMultipleBasicProperties(objects);
        
        // Transforms Section (Position & Size)
        this.renderMultipleTransformsSection(objects);
        
        // Visual Properties Section
        this.renderMultipleVisualProperties(objects);
        
        // Advanced Properties Section
        this.renderMultipleAdvancedProperties(objects);
        
        // Custom Properties Section
        this.renderMultipleCustomProperties(objects);
        
        // Layer Information Section
        this.renderMultipleLayerInfo(objects);
    }

    /**
     * Render basic properties for multiple objects (name)
     */
    renderMultipleBasicProperties(objects) {
        const section = this.createSection('Basic Properties');
        
        // Name - check if all objects have the same name
        const firstName = objects[0].name || '';
        const allSameName = objects.every(obj => (obj.name || '') === firstName);
        
        const nameContainer = UIFactory.createLabeledInput({
            label: 'Name',
            type: 'text',
            value: allSameName ? firstName : '',
            placeholder: allSameName ? '' : 'multiple values',
            onChange: (e) => {
                objects.forEach(obj => obj.name = e.target.value);
            },
            onBlur: () => {
                objects.forEach(obj => this.notifyPropertyChange(obj, 'name', obj.name));
            }
        });
        section._content.appendChild(nameContainer);

        // Type - show if all objects have the same type
        const firstType = objects[0].type || 'unknown';
        const allSameType = objects.every(obj => (obj.type || 'unknown') === firstType);
        
        if (allSameType) {
            const typeContainer = UIFactory.createLabeledInput({
                label: 'Type',
                type: 'text',
                value: firstType,
                disabled: true
            });
            section._content.appendChild(typeContainer);
        }

        this.container.appendChild(section);
    }

    /**
     * Render transforms section for multiple objects with compact position and size inputs
     */
    renderMultipleTransformsSection(objects) {
        const section = this.createTransformsSectionHTML(objects);
        
        // Add event listeners for transforms
        this.setupMultipleTransformsListeners(section, objects);
        
        this.container.appendChild(section);
    }

    /**
     * Render visual properties for multiple objects (color)
     */
    renderMultipleVisualProperties(objects) {
        const section = this.createSection('Visual');
        
        // Color - check if all objects have the same color
        const firstColor = objects[0].color || '#3B82F6';
        const allSameColor = objects.every(obj => (obj.color || '#3B82F6') === firstColor);
        
        const colorContainer = UIFactory.createLabeledInput({
            label: 'Color',
            type: 'color',
            value: allSameColor ? firstColor : '#3B82F6',
            onChange: (e) => {
                objects.forEach(obj => obj.color = e.target.value);
                this.notifyPropertyChange(objects[0], 'color', e.target.value);
            }
        });
        this.registerResettable(colorContainer.querySelector('input'), DEFAULT_OBJECT.COLOR);
        section._content.appendChild(colorContainer);

        this.container.appendChild(section);
    }

    /**
     * Render custom properties for multiple objects
     */
    renderMultipleCustomProperties(objects) {
        const section = this.createSection('Custom Properties');
        
        // Get all unique custom property keys from all objects
        const allCustomKeys = new Set();
                    objects.forEach(obj => {
            // Support both customProperties and properties (legacy)
            const customProps = obj.customProperties || obj.properties || {};
            Object.keys(customProps).forEach(key => allCustomKeys.add(key));
        });
        
        // Show existing custom properties
        if (allCustomKeys.size > 0) {
            allCustomKeys.forEach(key => {
                // Check if all objects have the same value for this custom property
                const firstCustomProps = objects[0].customProperties || objects[0].properties || {};
                const firstValue = firstCustomProps[key] || '';
                const allSameValue = objects.every(obj => {
                    const objCustomProps = obj.customProperties || obj.properties || {};
                    const objValue = objCustomProps[key] || '';
                    return objValue === firstValue;
                });
                
                const propContainer = UIFactory.createLabeledInput({
                    label: key,
                    type: 'text',
                    value: allSameValue ? firstValue : '',
                    placeholder: allSameValue ? '' : 'multiple values',
                    onChange: (e) => {
                        objects.forEach(obj => {
                            if (!obj.customProperties) {
                                obj.customProperties = {};
                            }
                            obj.customProperties[key] = e.target.value;
                        });
                    },
                    onBlur: (e) => {
                        objects.forEach(obj => {
                            if (!obj.customProperties) {
                                obj.customProperties = {};
                            }
                            obj.customProperties[key] = e.target.value;
                            this.notifyPropertyChange(obj, 'customProperties', obj.customProperties);
                        });
                    }
                });
                section._content.appendChild(propContainer);
            });
        } else {
            // Show message when no custom properties exist
            const noPropsMsg = document.createElement('div');
            noPropsMsg.className = 'text-sm italic';
            noPropsMsg.style.color = 'var(--ui-text-color, #9ca3af)';
            noPropsMsg.textContent = 'No custom properties';
            section._content.appendChild(noPropsMsg);
        }
        
        // Add "Add Property" button
        const addButton = document.createElement('button');
        addButton.className = 'mt-2 px-3 py-1 bg-blue-600 text-sm rounded hover:bg-blue-700';
        addButton.style.color = 'var(--ui-active-text-color, #ffffff)';
        addButton.textContent = 'Add Property';
        addButton.addEventListener('click', () => {
            const key = prompt('Enter property name:');
            if (key && key.trim()) {
                // Add the property to all objects
                    objects.forEach(obj => {
                    if (!obj.customProperties) {
                        obj.customProperties = {};
                    }
                    obj.customProperties[key.trim()] = '';
                });
                
                // Re-render the panel to show the new property
                this.render();
            }
        });
        section._content.appendChild(addButton);
        
        this.container.appendChild(section);
    }

    /**
     * Render advanced properties for multiple objects (stacking order)
     */
    renderMultipleAdvancedProperties(objects) {
        const section = this.createSection('Advanced');
        section._content.appendChild(this.createOrderButtonsRow(objects));
        this.container.appendChild(section);
    }

    /**
     * Setup event listeners for multiple objects transforms section
     * @param {HTMLElement} section - Section container
     * @param {Array} objects - Array of objects being edited
     */
    setupMultipleTransformsListeners(section, objects) {
        const inputs = section.querySelectorAll('input[data-property]');
        
        // Set initial values based on common values
        inputs.forEach(input => {
            const property = input.dataset.property;
            const firstValue = objects[0][property] || 0;
            const allSame = objects.every(obj => (obj[property] || 0) === firstValue);
            
            if (allSame) {
                input.value = firstValue.toFixed(1);
            } else {
                input.placeholder = 'multiple values';
            }
        });
        
        inputs.forEach(input => {
            const property = input.dataset.property;

            if (property === 'width' || property === 'height') {
                // Each selected object may come from a different asset with its own natural
                // size, so a single shared default value doesn't work here — reset every
                // object individually to ITS OWN default, mirroring the blur handler below.
                this.registerResettable(input, () => {
                    objects.forEach(obj => {
                        const value = this.getObjectDefaultSize(obj)[property];
                        obj[property] = value;
                        this.notifyPropertyChange(obj, property, value);
                    });
                });
            } else {
                this.registerResettable(input, TRANSFORM_DEFAULTS[property]);
            }

            input.addEventListener('input', (e) => {
                if (e.target.value === '' || e.target.value === '-' || e.target.value === '.') return;
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;

                objects.forEach(obj => obj[property] = value);

                // Live canvas feedback while typing/scrubbing (see setupTransformsListeners).
                if (this.levelEditor && this.levelEditor.render) {
                    this.levelEditor.render();
                }
            });

            input.addEventListener('blur', (e) => {
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;

                e.target.value = value.toFixed(1);
                objects.forEach(obj => {
                    obj[property] = value;
                    this.notifyPropertyChange(obj, property, value);
                });
            });

            this.wireNumberScrub(input, {
                step: parseFloat(input.step) || 1,
                decimals: 1,
                min: (property === 'width' || property === 'height') ? 1 : undefined
            });
        });
    }

    renderLayerInfo(obj) {
        const level = this.levelEditor.getLevel();
        const layerInfo = this.getObjectLayerInfo(obj, level);

        const section = this.createSection('Layer Information');

        const layerContainer = document.createElement('div');
        layerContainer.className = 'flex items-center space-x-2';

        layerContainer.innerHTML = `
            <div class="w-4 h-4 rounded border details-layer-color" data-color="${layerInfo.color}" style="background-color: ${layerInfo.color}"></div>
            <div class="flex-1">
                <div class="text-sm font-medium" style="color: var(--ui-text-color, #e5e7eb);">${layerInfo.name}</div>
                <div class="text-xs" style="color: var(--ui-text-color, #9ca3af);">${layerInfo.objectCount} objects</div>
            </div>
        `;

        section._content.appendChild(layerContainer);
        this.container.appendChild(section);
    }

    getObjectLayerInfo(obj, level) {

        // Get effective layer ID (considering inheritance from parent groups)
        const effectiveLayerId = this.getEffectiveLayerId(obj, level);

        const layer = level.getLayerById(effectiveLayerId);

        if (layer) {
            const objectCount = level.getLayerObjectsCount(effectiveLayerId);
            const result = {
                id: layer.id,
                name: layer.name,
                color: layer.color,
                visible: layer.visible,
                locked: layer.locked,
                objectCount: objectCount
            };
            return result;
        }
        
        // Fallback if layer not found
        return {
            id: 'unknown',
            name: 'Unknown Layer',
            color: '#6B7280',
            visible: true,
            locked: false,
            objectCount: 0
        };
    }

    renderMultipleLayerInfo(objects) {
        const level = this.levelEditor.getLevel();
        const layerAnalysis = this.analyzeMultipleLayers(objects, level);
        
        const section = this.createSection('Layer Information');
        
        if (layerAnalysis.allSameLayer) {
            // All objects are on the same layer
            const layerInfo = layerAnalysis.layers[0];
            const layerContainer = document.createElement('div');
            layerContainer.className = 'flex items-center space-x-2';
            
            layerContainer.innerHTML = `
                <div class="w-4 h-4 rounded border" style="background-color: ${layerInfo.color}"></div>
                <div class="flex-1">
                    <div class="text-sm font-medium" style="color: var(--ui-text-color, #e5e7eb);">${layerInfo.name}</div>
                    <div class="text-xs" style="color: var(--ui-text-color, #9ca3af);">${layerInfo.objectCount} objects, ${objects.length} selected</div>
                </div>
            `;
            
            section._content.appendChild(layerContainer);
        } else {
            // Objects are on different layers
            const layerContainer = document.createElement('div');
            layerContainer.innerHTML = `
                <div class="text-sm font-medium mb-2" style="color: var(--ui-text-color, #d1d5db);">Layers (${layerAnalysis.layers.length} different)</div>
                <div class="space-y-2">
            `;
            
            layerAnalysis.layers.forEach(layerInfo => {
                const layerItem = document.createElement('div');
                layerItem.className = 'flex items-center space-x-2';
                layerItem.innerHTML = `
                    <div class="w-3 h-3 rounded border" style="background-color: ${layerInfo.color}"></div>
                    <div class="flex-1">
                        <div class="text-sm" style="color: var(--ui-text-color, #e5e7eb);">${layerInfo.name}</div>
                        <div class="text-xs" style="color: var(--ui-text-color, #9ca3af);">${layerInfo.selectedCount} selected, ${layerInfo.objectCount} total</div>
                    </div>
                `;
                layerContainer.appendChild(layerItem);
            });
            
            layerContainer.innerHTML += '</div>';
            section._content.appendChild(layerContainer);
        }
        
        this.container.appendChild(section);
    }

    analyzeMultipleLayers(objects, level) {
        const layerMap = new Map();
        
        objects.forEach(obj => {
            const layerId = obj.layerId || level.getMainLayerId();
            const layer = level.getLayerById(layerId);
            
            if (layer) {
                if (!layerMap.has(layerId)) {
                    const objectCount = level.getLayerObjectsCount(layerId);
                    layerMap.set(layerId, {
                        id: layer.id,
                        name: layer.name,
                        color: layer.color,
                        visible: layer.visible,
                        locked: layer.locked,
                        objectCount: objectCount,
                        selectedCount: 0
                    });
                }
                layerMap.get(layerId).selectedCount++;
            }
        });
        
        const layers = Array.from(layerMap.values());
        const allSameLayer = layers.length === 1;
        
        return {
            layers: layers,
            allSameLayer: allSameLayer,
            totalLayers: layers.length
        };
    }

    renderCustomProperties(obj) {
        const section = this.createSection('Custom Properties');
        
        // Use customProperties instead of properties for consistency
        const customProps = obj.customProperties || obj.properties || {};
        
        if (Object.keys(customProps).length > 0) {
            Object.entries(customProps).forEach(([key, value]) => {
                const propContainer = UIFactory.createLabeledInput({
                    label: key,
                    type: 'text',
                    value: value || '',
                    onChange: (e) => {
                        if (!obj.customProperties) {
                            obj.customProperties = {};
                        }
                        obj.customProperties[key] = e.target.value;
                    },
                    onBlur: (e) => {
                        if (!obj.customProperties) {
                            obj.customProperties = {};
                        }
                        const oldValue = customProps[key];
                const newValue = e.target.value;
                        obj.customProperties[key] = newValue;
                        this.notifyPropertyChange(obj, 'customProperties', obj.customProperties);
                    }
                });
                section._content.appendChild(propContainer);
            });
        } else {
            // Show message when no custom properties exist
            const noPropsMsg = document.createElement('div');
            noPropsMsg.className = 'text-sm italic';
            noPropsMsg.style.color = 'var(--ui-text-color, #9ca3af)';
            noPropsMsg.textContent = 'No custom properties';
            section._content.appendChild(noPropsMsg);
        }
        
        // Add "Add Property" button
        const addButton = document.createElement('button');
        addButton.className = 'mt-2 px-3 py-1 bg-blue-600 text-sm rounded hover:bg-blue-700';
        addButton.style.color = 'var(--ui-active-text-color, #ffffff)';
        addButton.textContent = 'Add Property';
        addButton.addEventListener('click', () => {
            const key = prompt('Enter property name:');
            if (key && key.trim()) {
                if (!obj.customProperties) {
                    obj.customProperties = {};
                }
                obj.customProperties[key.trim()] = '';
                
                // Re-render the panel to show the new property
                this.render();
            }
        });
        section._content.appendChild(addButton);
        
        this.container.appendChild(section);
    }

    getSelectedObjects() {
        const selectedIds = this.stateManager.get('selectedObjects');
        const level = this.levelEditor.getLevel();


        const objects = Array.from(selectedIds)
            .map(id => level.findObjectById(id))
            .filter(Boolean);


        return objects;
    }

    getAllChildren(group) {
        return GroupTraversalUtils.getAllChildren(group);
    }

    /**
     * Get effective layer ID for an object, considering inheritance from parent groups
     * @param {GameObject} obj - Object to get layer ID for
     * @param {Level} level - Level containing the object
     * @returns {string} Effective layer ID
     */
    getEffectiveLayerId(obj, level) {
        // If object has its own layerId, use it
        if (obj.layerId) {
            return obj.layerId;
        }

        // Try to find the object in the hierarchy and get parent's layerId
        const findParentLayerId = (currentObj, parentGroup = null) => {
            // If we have a parent group, check if currentObj is its child
            if (parentGroup && parentGroup.children) {
                const childIndex = parentGroup.children.findIndex(child => child.id === currentObj.id);
                if (childIndex !== -1) {
                    // Found the object as child of parentGroup
                    return parentGroup.layerId || level.getMainLayerId();
                }
            }

            // Search recursively in all groups
            for (const topLevelObj of level.objects) {
                if (topLevelObj.type === 'group') {
                    const result = this.searchInGroupForLayerId(topLevelObj, currentObj, level);
                    if (result) {
                        return result;
                    }
                }
            }

            // If not found in any group, use main layer
            return level.getMainLayerId();
        };

        return findParentLayerId(obj);
    }

    /**
     * Recursively search for object in group hierarchy and return parent's layerId
     * @param {Group} group - Group to search in
     * @param {GameObject} targetObj - Object to find
     * @param {Level} level - Level for fallback
     * @returns {string|null} Parent's layerId or null if not found
     */
    searchInGroupForLayerId(group, targetObj, level) {
        if (!group.children) return null;

        for (const child of group.children) {
            if (child.id === targetObj.id) {
                // Found the object - return group's layerId or main layer if group has no layerId
                return group.layerId || level.getMainLayerId();
            }

            // Search recursively in child groups
            if (child.type === 'group') {
                const result = this.searchInGroupForLayerId(child, targetObj, level);
                if (result) return result;
            }
        }

        return null;
    }

    renderLevelContent() {
        this.container.innerHTML = '';

        // Create compact layout with sections
        this.renderCompactLevelDetails();
    }

    /**
     * Render compact level details with sections
     */
    renderCompactLevelDetails() {
        const stats = this.levelEditor.cachedLevelStats;
        
        // Statistics Section
        this.renderLevelStatistics(stats);
        
        // Actions Section
        this.renderLevelActions();
    }

    /**
     * Render level statistics section
     */
    renderLevelStatistics(stats) {
        const section = this.createSection('Stats');
        
        const playerStartCount = stats?.byType?.player_start || 0;

        // Generate Player Start display with color coding
        const playerStartText = playerStartCount === 1 ? 'Player Start: 1' :
                               playerStartCount === 0 ? 'Player Start: 0' :
                               `Player Start: ${playerStartCount}`;
        const playerStartClass = playerStartCount === 1 ? 'text-green-400' :
                                playerStartCount === 0 ? 'text-yellow-400' :
                                'text-red-400 font-bold';

        // Overview stats
        const overviewDiv = document.createElement('div');
        overviewDiv.className = 'grid grid-cols-2 gap-4 mb-4';
        overviewDiv.innerHTML = `
            <div class="text-center">
                <div class="text-lg font-bold text-blue-400">${stats.totalObjects}</div>
                <div class="text-sm" style="color: var(--ui-text-color, #9ca3af);">Total Objects</div>
            </div>
            <div class="text-center">
                <div class="text-lg font-bold text-green-400">${stats.groups}</div>
                <div class="text-sm" style="color: var(--ui-text-color, #9ca3af);">Groups</div>
            </div>
        `;
        section._content.appendChild(overviewDiv);
        
        // By Type breakdown
        const typeDiv = document.createElement('div');
        typeDiv.innerHTML = `
            <div class="text-sm font-medium mb-2" style="color: var(--ui-text-color, #d1d5db);">By Type:</div>
            <div class="space-y-1">
                ${Object.entries(stats.byType || {}).map(([type, count]) => {
                    if (type === 'player_start') {
                        return `<div class="flex justify-between items-center">
                            <span class="text-sm ${playerStartClass}">${playerStartText}</span>
                        </div>`;
                    }
                    return `<div class="flex justify-between items-center">
                        <span class="text-sm" style="color: var(--ui-text-color, #e5e7eb);">${type}</span>
                        <span class="text-sm" style="color: var(--ui-text-color, #9ca3af);">${count}</span>
                    </div>`;
                }).join('')}
            </div>
        `;
        section._content.appendChild(typeDiv);
        
        this.container.appendChild(section);
    }

    /**
     * Render level actions section
     */
    renderLevelActions() {
        const section = this.createSection('Camera');
        const level = this.levelEditor.getLevel();

        const buttonContainer = document.createElement('div');
        buttonContainer.innerHTML = `
                <button id="set-camera-start-position-btn"
                    class="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-medium transition-colors"
                    style="color: var(--ui-active-text-color, #ffffff);">
                    Set Camera Start Position
                </button>
            <div class="text-xs mt-2 text-center" style="color: var(--ui-text-color, #9ca3af);">
                    Sets current camera position as parallax reference point
            </div>
        `;
        section._content.appendChild(buttonContainer);

        // Parallax multiplier row — horizontal and vertical share one line (see createDualFieldRow)
        const parallaxRow = this.createDualFieldRow('Parallax', [
            { prefix: 'H', property: 'parallaxHorizontal', id: 'level-parallax-horizontal', step: '0.1' },
            { prefix: 'V', property: 'parallaxVertical', id: 'level-parallax-vertical', step: '0.1' }
        ]);
        parallaxRow.classList.add('mt-3');
        section._content.appendChild(parallaxRow);

        this.container.appendChild(section);

        // Setup event listeners
        this.setupCameraStartPositionButton();
        this.setupParallaxMultiplierInputs(level);
    }

    /**
     * Wire the level-wide Parallax H/V multiplier inputs (see renderLevelActions). These scale
     * the camera-offset used by ParallaxRenderer.getCameraOffset() independently per axis, on
     * top of each layer's own parallaxOffset — stored in level.settings so they persist with
     * the level file (mirrors gridSize/backgroundColor, not the transient parallax.startPosition
     * runtime state).
     * @param {Level} level
     */
    setupParallaxMultiplierInputs(level) {
        const inputs = this.container.querySelectorAll('#level-parallax-horizontal, #level-parallax-vertical');
        inputs.forEach(input => {
            const property = input.dataset.property;
            input.value = (level.settings[property] ?? 1).toFixed(1);

            const apply = (raw) => {
                let value = parseFloat(raw);
                if (isNaN(value)) value = 1;
                level.settings[property] = value;
                this.levelEditor?.render?.();
                return value;
            };

            input.addEventListener('input', (e) => {
                if (e.target.value === '' || e.target.value === '-' || e.target.value === '.') return;
                apply(e.target.value);
            });
            input.addEventListener('blur', (e) => {
                const value = apply(e.target.value);
                e.target.value = value.toFixed(1);
                this.stateManager.markDirty();
            });
            this.wireNumberScrub(input, { step: 0.1, decimals: 1 });
        });
    }

    setupCameraStartPositionButton() {
        const btn = this.container.querySelector('#set-camera-start-position-btn');
        if (!btn) return;

        // Remove existing listener to avoid duplicates
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            const currentCamera = this.levelEditor.stateManager.get('camera');
            const center = this.levelEditor.renderOperations.parallaxRenderer.getCameraCenter(currentCamera);
            this.levelEditor.stateManager.set('parallax.startPosition', center);
        });
    }

    /**
     * Cheaply refresh Transform + camera numeric fields from the live model,
     * without rebuilding the DOM — safe every mousemove during drag/rotate/scale/pan.
     * Skips inputs the user is actively typing/scrubbing into.
     */
    refreshTransformFieldsLive() {
        if (!this.container) return;

        const selectedObjects = this.getSelectedObjects();
        if (selectedObjects.length === 0) return;

        const inputs = this.container.querySelectorAll('input[data-property]');
        inputs.forEach(input => {
            if (document.activeElement === input) return;
            // Nested camera props (zoom/vignette/res) handled below by id
            if (input.dataset.nested === '1') return;

            const property = input.dataset.property;
            const firstValue = selectedObjects[0][property] || 0;
            const allSame = selectedObjects.every(obj => (obj[property] || 0) === firstValue);

            if (allSame) {
                input.value = Number(firstValue).toFixed(1);
            } else if (selectedObjects.length > 1) {
                input.value = '';
                input.placeholder = 'multiple values';
            }
        });

        // Single camera object: keep zoom/vignette in sync with game-viewport pan/zoom pose
        if (selectedObjects.length === 1 && selectedObjects[0].type === 'camera') {
            const cam = selectedObjects[0];
            const props = cam.properties || {};
            const setIfIdle = (sel, value, decimals) => {
                const el = this.container.querySelector(sel);
                if (!el || document.activeElement === el) return;
                el.value = Number(value).toFixed(decimals);
            };
            setIfIdle('#details-camera-zoom', props.zoom ?? 1, 2);
            if (props.vignette !== undefined && props.vignette !== null) {
                setIfIdle('#details-camera-vignette', props.vignette, 2);
            }
            if ((props.aspect || '16:9') === 'custom') {
                setIfIdle('#details-camera-res-w', props.resolutionWidth ?? 1920, 0);
                setIfIdle('#details-camera-res-h', props.resolutionHeight ?? 1080, 0);
            }
        }
    }

    updateTabTitle() {
        // Tab title is static ("Details") — only panel content changes with selection.
    }
    
    /**
     * Cleanup and destroy panel
     */
    destroy() {
        ResetRegistry.clear(this.resetRegistryKey || 'detailsPanel');

        // Unsubscribe from all state changes
        this.subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                Logger.ui.warn('Failed to unsubscribe:', error);
            }
        });
        this.subscriptions = [];
        
        // Remove all event listeners
        this.eventListeners.forEach(({ target, event, handler }) => {
            try {
                target.removeEventListener(event, handler);
            } catch (error) {
                Logger.ui.warn('Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];
        
        // Clear DOM
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Clear references
        this.levelEditor = null;
        this.stateManager = null;
        this.container = null;
    }

}
