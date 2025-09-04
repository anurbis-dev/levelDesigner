/**
 * Details panel UI component
 */
export class DetailsPanel {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to selection changes
        this.stateManager.subscribe('selectedObjects', () => {
            this.render();
            this.updateTabTitle();
        });
    }

    render() {
        this.container.innerHTML = '';
        
        const selectedObjects = this.getSelectedObjects();
        
        if (selectedObjects.length === 0) {
            this.renderNoSelection();
            return;
        }
        
        if (selectedObjects.length === 1) {
            this.renderSingleObject(selectedObjects[0]);
        } else {
            this.renderMultipleObjects(selectedObjects);
        }
    }

    renderNoSelection() {
        this.container.innerHTML = '<p class="text-gray-400">Select an object to see its properties.</p>';
    }

    renderSingleObject(obj) {
        if (obj.type === 'group') {
            this.renderGroupDetails(obj);
        } else {
            this.renderObjectDetails(obj);
        }
    }

    renderGroupDetails(group) {
        const level = this.levelEditor.getLevel();
        const childAssets = this.getAllChildren(group).filter(o => o.type !== 'group').length;
        const childGroups = this.getAllChildren(group).filter(o => o.type === 'group').length;
        
        this.container.innerHTML = `
            <div class="mb-3">
                <label class="block text-sm font-medium text-gray-300">Group Name</label>
                <input id="group-name-input" type="text" value="${group.name}" 
                       class="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            </div>
            <div class="text-sm text-gray-400">
                <p>Assets: ${childAssets}</p>
                <p>Groups: ${childGroups}</p>
            </div>
        `;
        
        // Add event listener for name change
        const nameInput = this.container.querySelector('#group-name-input');
        nameInput.addEventListener('change', (e) => {
            group.name = e.target.value;
            this.stateManager.markDirty();
            // Trigger outliner update
            this.stateManager.notifyListeners('selectedObjects', this.stateManager.get('selectedObjects'), this.stateManager.get('selectedObjects'));
        });
    }

    renderObjectDetails(obj) {
        const properties = ['name', 'type', 'x', 'y', 'width', 'height', 'color'];
        
        properties.forEach(prop => {
            const propContainer = document.createElement('div');
            propContainer.className = 'mb-3';
            
            const value = obj[prop];
            const displayValue = typeof value === 'number' ? value.toFixed(1) : value;
            
            propContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300 capitalize">${prop}</label>
                <input type="text" value="${displayValue}" 
                       class="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            `;
            
            const input = propContainer.querySelector('input');
            input.addEventListener('change', (e) => {
                let newValue = e.target.value;
                
                // Convert to number if original was number
                if (typeof value === 'number') {
                    newValue = parseFloat(newValue) || 0;
                }
                
                obj[prop] = newValue;
                this.stateManager.markDirty();
                
                // Trigger redraw
                this.stateManager.notifyListeners('selectedObjects', this.stateManager.get('selectedObjects'), this.stateManager.get('selectedObjects'));
            });
            
            this.container.appendChild(propContainer);
        });
        
        // Add custom properties section
        this.renderCustomProperties(obj);
    }

    renderMultipleObjects(objects) {
        this.container.innerHTML = '<h3 class="text-lg font-bold mb-3">Multiple Selection</h3>';
        
        const commonProps = ['x', 'y', 'width', 'height', 'name'];
        
        commonProps.forEach(prop => {
            const firstValue = objects[0][prop];
            const allSame = objects.every(obj => obj[prop] === firstValue);
            const displayValue = allSame ? (typeof firstValue === 'number' ? firstValue.toFixed(1) : firstValue) : '';
            
            const propContainer = document.createElement('div');
            propContainer.className = 'mb-3';
            
            propContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300 capitalize">${prop}</label>
                <input type="text" value="${displayValue}" 
                       placeholder="${allSame ? '' : 'multiple values'}"
                       class="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            `;
            
            const input = propContainer.querySelector('input');
            input.addEventListener('change', (e) => {
                let newValue = e.target.value;
                
                if (typeof firstValue === 'number') {
                    newValue = parseFloat(newValue) || 0;
                }
                
                objects.forEach(obj => {
                    obj[prop] = newValue;
                });
                
                this.stateManager.markDirty();
                
                // Trigger redraw
                this.stateManager.notifyListeners('selectedObjects', this.stateManager.get('selectedObjects'), this.stateManager.get('selectedObjects'));
            });
            
            this.container.appendChild(propContainer);
        });
    }

    renderCustomProperties(obj) {
        if (!obj.properties || Object.keys(obj.properties).length === 0) {
            return;
        }
        
        const section = document.createElement('div');
        section.className = 'mt-4';
        section.innerHTML = '<h4 class="text-md font-bold mb-2">Custom Properties</h4>';
        
        Object.entries(obj.properties).forEach(([key, value]) => {
            const propContainer = document.createElement('div');
            propContainer.className = 'mb-2';
            
            propContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300">${key}</label>
                <input type="text" value="${value}" 
                       class="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            `;
            
            const input = propContainer.querySelector('input');
            input.addEventListener('change', (e) => {
                obj.properties[key] = e.target.value;
                this.stateManager.markDirty();
            });
            
            section.appendChild(propContainer);
        });
        
        this.container.appendChild(section);
    }

    getSelectedObjects() {
        const selectedIds = this.stateManager.get('selectedObjects');
        const level = this.levelEditor.getLevel();
        return Array.from(selectedIds)
            .map(id => level.findObjectById(id))
            .filter(Boolean);
    }

    getAllChildren(group) {
        const result = [];
        const walk = (obj) => {
            for (const child of obj.children) {
                result.push(child);
                if (child.type === 'group') {
                    walk(child);
                }
            }
        };
        walk(group);
        return result;
    }

    updateTabTitle() {
        const detailsTab = document.getElementById('details-tab');
        if (!detailsTab) return;
        
        const selectedObjects = this.getSelectedObjects();
        const count = selectedObjects.length;
        
        if (count === 0) {
            detailsTab.textContent = 'Asset';
        } else if (count === 1) {
            detailsTab.textContent = 'Asset';
        } else {
            detailsTab.textContent = 'Asset(s)';
        }
    }
}
