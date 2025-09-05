import { BaseModule } from './BaseModule.js';

/**
 * Group Operations module for LevelEditor
 * Handles all group-related operations
 */
export class GroupOperations extends BaseModule {

    groupSelectedObjects() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        
        // Find all selected objects that are at the top level of the scene hierarchy
        const selectedTopLevelObjects = this.editor.level.objects.filter(obj => selectedObjects.has(obj.id));

        // Grouping makes sense only if there are 2 or more objects selected at the same level
        if (selectedTopLevelObjects.length > 1) {
            this.editor.historyManager.saveState(this.editor.level.objects); // Save the state before making changes

            // Calculate the bounding box of all selected objects to determine the new group's position
            const bounds = this.editor.objectOperations.getSelectionBounds(selectedTopLevelObjects);
            const newGroup = {
                id: this.editor.level.nextObjectId++,
                name: "New Group",
                type: 'group',
                x: bounds.minX,
                y: bounds.minY,
                visible: true,
                locked: false,
                children: []
            };
            
            const idsToRemove = new Set();
            selectedTopLevelObjects.forEach(obj => {
                idsToRemove.add(obj.id);
                // Create a deep copy of the object to place inside the group
                const newChild = this.editor.deepClone(obj);
                // Recalculate the child's coordinates to be relative to the new group's origin
                newChild.x -= newGroup.x;
                newChild.y -= newGroup.y;
                newGroup.children.push(newChild);
            });

            // Remove the original objects from the main level scene
            this.editor.level.objects = this.editor.level.objects.filter(obj => !idsToRemove.has(obj.id));
            
            // Add the newly created group to the scene
            this.editor.level.objects.push(newGroup);
            
            // Clear the old selection and select only the new group
            this.editor.stateManager.set('selectedObjects', new Set([newGroup.id]));
            
            // Refresh all UI panels and redraw the canvas
            this.editor.updateAllPanels();
            this.editor.render();
        }
    }

    /**
     * Open group edit mode
     */
    openGroupEditMode(group) {
        // Simply mark group as "editing" - don't move children
        group._isEditing = true;

        const current = this.editor.stateManager.get('groupEditMode') || { isActive: false, openGroups: [] };
        const openGroups = Array.isArray(current.openGroups) ? [...current.openGroups, group] : [group];

        this.editor.stateManager.set('groupEditMode', {
            isActive: true,
            groupId: group.id,
            group: group,
            originalChildren: [...group.children], // Keep reference to original children
            openGroups
        });

        // Clear selection
        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.updateAllPanels();
        this.editor.render();
    }

    /**
     * Close group edit mode
     */
    closeGroupEditMode() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        if (groupEditMode && groupEditMode.isActive && groupEditMode.group) {
            const group = groupEditMode.group;

            // Simply remove editing flag - children stay where they are
            delete group._isEditing;
        }

        // Pop the last opened group
        const openGroups = Array.isArray(groupEditMode.openGroups) ? [...groupEditMode.openGroups] : [];
        openGroups.pop();
        const nextGroup = openGroups.length > 0 ? openGroups[openGroups.length - 1] : null;

        this.editor.stateManager.set('groupEditMode', {
            isActive: openGroups.length > 0,
            groupId: nextGroup ? nextGroup.id : null,
            group: nextGroup,
            originalChildren: nextGroup ? [...nextGroup.children] : [],
            openGroups
        });

        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.updateAllPanels();
        this.editor.render();
    }

    /**
     * Ungroup selected objects
     */
    ungroupSelectedObjects() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const groupsToUngroup = [];

        // Find selected groups
        selectedObjects.forEach(id => {
            const obj = this.editor.level.findObjectById(id);
            if (obj && obj.type === 'group' && this.editor.level.objects.some(topObj => topObj.id === obj.id)) {
                groupsToUngroup.push(obj);
            }
        });

        if (groupsToUngroup.length === 0) return;

        this.editor.historyManager.saveState(this.editor.level.objects);

        groupsToUngroup.forEach(group => {
            // Convert children back to world coordinates
            group.children.forEach(child => {
                child.x += group.x;
                child.y += group.y;
            });

            // Add children back to main level
            this.editor.level.objects.push(...group.children);

            // Remove the group
            this.editor.level.objects = this.editor.level.objects.filter(obj => obj.id !== group.id);
        });

        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.updateAllPanels();
        this.editor.render();
    }

    // Group edit helpers
    getOpenGroups() {
        const gem = this.editor.stateManager.get('groupEditMode');
        return gem?.openGroups || [];
    }

    getActiveEditedGroup() {
        const open = this.getOpenGroups();
        return open.length > 0 ? open[open.length - 1] : null;
    }
}
