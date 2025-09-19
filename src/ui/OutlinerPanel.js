/**
 * Outliner panel UI component
 */
export class OutlinerPanel {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to selection changes
        this.stateManager.subscribe('selectedObjects', () => this.render());
    }

    render() {
        this.container.innerHTML = '';

        const level = this.levelEditor.getLevel();
        // Show only top-level objects in outliner
        const topLevelObjects = level.objects;
        const groupedByType = this.groupObjectsByType(topLevelObjects);
        
        Object.keys(groupedByType).sort().forEach(type => {
            this.renderTypeGroup(type, groupedByType[type]);
        });
    }

    groupObjectsByType(objects) {
        return objects.reduce((acc, obj) => {
            const type = obj.type === 'group' ? 'Groups' : obj.type || 'Untyped';
            if (!acc[type]) acc[type] = [];
            acc[type].push(obj);
            return acc;
        }, {});
    }

    renderTypeGroup(type, objects) {
        const header = document.createElement('h4');
        header.className = 'outliner-group-header mt-2';
        
        const isCollapsed = this.stateManager.get('outliner').collapsedTypes.has(type);
        if (isCollapsed) header.classList.add('collapsed');
        
        header.textContent = type;
        
        const itemsContainer = document.createElement('div');
        if (isCollapsed) itemsContainer.classList.add('hidden');
        
        // Toggle collapse on double click
        header.addEventListener('dblclick', () => {
            const collapsedTypes = new Set(this.stateManager.get('outliner').collapsedTypes);
            
            if (collapsedTypes.has(type)) {
                collapsedTypes.delete(type);
            } else {
                collapsedTypes.add(type);
            }
            
            this.stateManager.update({
                'outliner.collapsedTypes': collapsedTypes
            });
            
            this.render();
        });
        
        this.container.appendChild(header);
        this.container.appendChild(itemsContainer);
        
        if (type === 'Groups') {
            // Render groups hierarchically
            const level = this.levelEditor.getLevel();
            const topLevelGroups = level.objects.filter(obj => obj.type === 'group');
            topLevelGroups.forEach(group => {
                this.renderGroupNode(group, 0, itemsContainer);
            });
        } else {
            // Render regular objects
            objects.forEach(obj => {
                this.renderObjectNode(obj, 0, itemsContainer);
            });
        }
    }

    renderGroupNode(group, depth, container) {
        const item = document.createElement('div');
        item.className = 'outliner-item';
        item.style.paddingLeft = `${5 + depth * 15}px`;
        item.textContent = group.name || `[${group.type}]`;
        item.dataset.id = group.id;
        
        // Check if object is in a locked layer
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(group) :
            (group.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        
        if (layer && layer.locked) {
            item.classList.add('locked');
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
            item.title = 'Object is in locked layer';
        }
        
        if (this.stateManager.get('selectedObjects').has(group.id)) {
            item.classList.add('selected');
        }
        
        item.addEventListener('click', (e) => this.handleObjectClick(e, group));
        
        container.appendChild(item);
        
        // Render children
        group.children.forEach(child => {
            if (child.type === 'group') {
                this.renderGroupNode(child, depth + 1, container);
            } else {
                this.renderObjectNode(child, depth + 1, container);
            }
        });
    }

    renderObjectNode(obj, depth, container) {
        const item = document.createElement('div');
        item.className = 'outliner-item';
        item.style.paddingLeft = `${5 + depth * 15}px`;
        item.textContent = obj.name || `[${obj.type}]`;
        item.dataset.id = obj.id;
        
        // Check if object is in a locked layer
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
            (obj.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        
        if (layer && layer.locked) {
            item.classList.add('locked');
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
            item.title = 'Object is in locked layer';
        }
        
        if (this.stateManager.get('selectedObjects').has(obj.id)) {
            item.classList.add('selected');
        }
        
        item.addEventListener('click', (e) => this.handleObjectClick(e, obj));
        
        container.appendChild(item);
    }

    handleObjectClick(e, obj) {
        // Check if object is in a locked layer
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
            (obj.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        
        if (layer && layer.locked) {
            // Don't allow selection of objects in locked layers
            return;
        }
        
        const selectedObjects = new Set(this.stateManager.get('selectedObjects'));
        
        if (e.shiftKey) {
            // Add to selection
            selectedObjects.add(obj.id);
        } else {
            // Replace selection
            selectedObjects.clear();
            selectedObjects.add(obj.id);
        }
        
        this.stateManager.set('selectedObjects', selectedObjects);
    }
}
