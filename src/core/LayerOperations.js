import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

/**
 * LayerOperations - handles layer assignment and movement
 * Centralizes all layer-related operations for better maintainability
 * @extends BaseModule
 * @version 3.41.0
 */
export class LayerOperations extends BaseModule {
    constructor(editor) {
        super(editor);
        Logger.lifecycle.info('LayerOperations initialized');
    }

    /**
     * Move selected objects to next layer (up/down)
     * @param {boolean} moveUp - true to move to upper layer, false to move to lower layer
     * @param {boolean} moveToExtreme - true to move to first/last layer, false to move to adjacent layer
     */
    moveSelectedObjectsToLayer(moveUp, moveToExtreme = false) {
        // Quick check for selected objects
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        if (!selectedObjects || selectedObjects.size === 0) {
            return;
        }

        // Check for active duplication only
        const duplicate = this.editor.stateManager.get('duplicate');
        if (duplicate && duplicate.isActive) {
            Logger.layer.warn('Cannot move objects while duplication is active');
            return;
        }

        // Save state for undo with current group edit mode
        this.editor.historyManager.saveState(
            this.editor.level.objects, 
            this.editor.stateManager.get('selectedObjects'), 
            false, 
            this.editor.stateManager.get('groupEditMode')
        );

        let movedCount = 0;

        // Use improved layer assignment logic
        movedCount = this.assignSelectedObjectsToLayer(selectedObjects, moveUp, moveToExtreme);

        if (movedCount > 0) {
            // Mark level as modified and update UI
            this.editor.stateManager.markDirty();
            this.editor.level.updateModified();

            // Update all panels to reflect changes
            this.editor.updateAllPanels();

            // Notify subscribers about level changes
            // Force level update by creating a deep copy to trigger state manager listeners
            this.editor.stateManager.set('level', JSON.parse(JSON.stringify(this.editor.level)));

            Logger.layer.info(`Moved ${movedCount} objects to ${moveToExtreme ? (moveUp ? 'first' : 'last') : (moveUp ? 'upper' : 'lower')} layer`);
        } else {
            Logger.layer.info('No objects were moved (already in target layer or no valid objects found)');
        }
    }

    /**
     * Assign selected objects to a layer with improved nested object handling
     * @param {Set} selectedObjects - Set of selected object IDs
     * @param {boolean} moveUp - true to move to upper layer, false to move to lower layer
     * @param {boolean} moveToExtreme - true to move to first/last layer, false to move to adjacent layer
     * @returns {number} Number of objects moved
     */
    assignSelectedObjectsToLayer(selectedObjects, moveUp, moveToExtreme) {
        let movedCount = 0;
        const processedGroups = new Set(); // Track groups that have already been processed
        const layersSorted = this.editor.level.getLayersSorted();

        // Система группировки уведомлений для оптимизации производительности
        const batchedNotifications = {
            objectPropertyChanges: new Map(), // property -> [{obj, oldValue, newValue}, ...]
            layerCountChanges: new Map() // layerId -> {oldCount, newCount}
        };

        // Отслеживание измененных объектов и слоев для умной инвалидации кешей
        const changedObjectIds = new Set();
        const affectedLayers = new Set();

        if (moveToExtreme) {
            // Move all selected objects to first/last unlocked layer
            let targetLayerId = null;
            
            if (moveUp) {
                // Find first unlocked layer from the top
                for (let i = 0; i < layersSorted.length; i++) {
                    if (!layersSorted[i].locked) {
                        targetLayerId = layersSorted[i].id;
                        break;
                    }
                }
            } else {
                // Find last unlocked layer from the bottom
                for (let i = layersSorted.length - 1; i >= 0; i--) {
                    if (!layersSorted[i].locked) {
                        targetLayerId = layersSorted[i].id;
                        break;
                    }
                }
            }

            if (!targetLayerId) {
                Logger.layer.warn('No unlocked layer found for extreme move');
                return 0;
            }

            // Batch process objects for better performance
            const batchResults = this.batchProcessLayerAssignment(selectedObjects, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
            movedCount = batchResults.movedCount;

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Batch moved ${movedCount} objects to extreme layer ${targetLayerId}`);
            }
        } else {
            // Move each object/group to adjacent layer based on its current effective layer
            const batchResults = this.batchProcessAdjacentLayerAssignment(selectedObjects, layersSorted, moveUp, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
            movedCount = batchResults.movedCount;

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Batch moved ${movedCount} objects to adjacent layers`);
            }
        }

        // Отправляем сгруппированные уведомления для оптимизации производительности
        this.flushBatchedNotifications(batchedNotifications);

        // Умная инвалидация кешей только для измененных объектов и слоев
        this.editor.invalidateAfterLayerChanges(changedObjectIds, affectedLayers);

        // При массовых изменениях слоев перестраиваем пространственный индекс
        if (changedObjectIds.size > 10) {
            setTimeout(() => {
                if (this.editor.renderOperations) {
                    this.editor.renderOperations.buildSpatialIndex();
                }
            }, 0);
        }

        // Mark state as dirty and force immediate re-render to apply zIndex changes
        this.editor.stateManager.markDirty();
        this.editor.render();

        return movedCount;
    }

    /**
     * Batch process layer assignment for multiple objects
     * @param {Set} selectedObjects - Set of object IDs
     * @param {string} targetLayerId - Target layer ID
     * @param {Set} processedGroups - Set of processed groups
     * @param {Object} batchedNotifications - Batched notifications structure
     * @param {Set} changedObjectIds - Set of changed object IDs
     * @param {Set} affectedLayers - Set of affected layer IDs
     * @returns {Object} Results with movedCount
     */
    batchProcessLayerAssignment(selectedObjects, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers) {
        let movedCount = 0;
        const objectsToProcess = [];

        // Pre-filter objects that need processing
        selectedObjects.forEach(objId => {
            const targetObj = this.editor.getCachedObject(objId);
            if (!targetObj) return;

            // Check if object is already in target layer
            const currentEffectiveLayerId = this.editor.getCachedEffectiveLayerId(targetObj);
            if (currentEffectiveLayerId !== targetLayerId) {
                objectsToProcess.push(objId);
            }
        });

        // Process objects in batch
        objectsToProcess.forEach(objId => {
            const result = this.processObjectForLayerAssignment(objId, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
            if (result.moved) {
                movedCount++;
            }
        });

        return { movedCount };
    }

    /**
     * Find next unlocked layer in the specified direction
     * @param {Array} layersSorted - Sorted layers array
     * @param {string} currentLayerId - Current layer ID
     * @param {boolean} moveUp - Direction to move
     * @returns {string|null} Next unlocked layer ID or null if not found
     */
    findNextUnlockedLayer(layersSorted, currentLayerId, moveUp) {
        const currentLayerIndex = layersSorted.findIndex(layer => layer.id === currentLayerId);
        if (currentLayerIndex === -1) return null;

        const direction = moveUp ? -1 : 1;
        let targetIndex = currentLayerIndex + direction;

        // Search for next unlocked layer
        while (targetIndex >= 0 && targetIndex < layersSorted.length) {
            const targetLayer = layersSorted[targetIndex];
            if (!targetLayer.locked) {
                return targetLayer.id;
            }
            targetIndex += direction;
        }

        return null;
    }

    /**
     * Batch process adjacent layer assignment
     * @param {Set} selectedObjects - Set of object IDs
     * @param {Array} layersSorted - Sorted layers array
     * @param {boolean} moveUp - Direction to move
     * @param {Set} processedGroups - Set of processed groups
     * @param {Object} batchedNotifications - Batched notifications structure
     * @param {Set} changedObjectIds - Set of changed object IDs
     * @param {Set} affectedLayers - Set of affected layer IDs
     * @returns {Object} Results with movedCount
     */
    batchProcessAdjacentLayerAssignment(selectedObjects, layersSorted, moveUp, processedGroups, batchedNotifications, changedObjectIds, affectedLayers) {
        let movedCount = 0;
        const objectsByTargetLayer = new Map();

        // Group objects by their target layer for batch processing
        selectedObjects.forEach(objId => {
            const targetObj = this.editor.getCachedObject(objId);
            if (!targetObj) return;

            const currentEffectiveLayerId = this.editor.getCachedEffectiveLayerId(targetObj);
            const currentLayerIndex = layersSorted.findIndex(layer => layer.id === currentEffectiveLayerId);
            if (currentLayerIndex === -1) return;

            // Find next unlocked layer instead of just adjacent layer
            const targetLayerId = this.findNextUnlockedLayer(layersSorted, currentEffectiveLayerId, moveUp);
            if (!targetLayerId) return; // No unlocked layer found in this direction

            if (!objectsByTargetLayer.has(targetLayerId)) {
                objectsByTargetLayer.set(targetLayerId, []);
            }
            objectsByTargetLayer.get(targetLayerId).push(objId);
        });

        // Process each group of objects going to the same layer
        objectsByTargetLayer.forEach((objIds, targetLayerId) => {
            objIds.forEach(objId => {
                const result = this.processObjectForLayerAssignment(objId, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
                if (result.moved) {
                    movedCount++;
                }
            });
        });

        return { movedCount };
    }

    /**
     * Process single object for layer assignment
     * @param {string} objId - Object ID to process
     * @param {string} targetLayerId - Target layer ID
     * @param {Set} processedGroups - Set of already processed groups
     * @param {Object} batchedNotifications - Batched notifications structure
     * @param {Set} changedObjectIds - Set of changed object IDs
     * @param {Set} affectedLayers - Set of affected layer IDs
     * @returns {Object} Result with moved flag and target object info
     */
    processObjectForLayerAssignment(objId, targetLayerId, processedGroups, batchedNotifications = null, changedObjectIds = null, affectedLayers = null) {
        // Use cached object lookup
        const targetObj = this.editor.getCachedObject(objId);
        if (!targetObj) {
            return { moved: false };
        }

        // Use cached effective layer ID
        const currentEffectiveLayerId = this.editor.getCachedEffectiveLayerId(targetObj);
        if (currentEffectiveLayerId === targetLayerId) {
            return { moved: false };
        }

        // Use cached top-level object lookup
        const topLevelObj = this.editor.getCachedTopLevelObject(objId);
        if (!topLevelObj) {
            return { moved: false };
        }

        // If we've already processed this top-level object, skip it
        if (processedGroups.has(topLevelObj.id)) {
            return { moved: false };
        }

        processedGroups.add(topLevelObj.id);

        // Get the old effective layer ID for notifications (use cache)
        const oldEffectiveLayerId = this.editor.getCachedEffectiveLayerId(topLevelObj);

        // Change layerId of the top-level object using Level.assignObjectToLayer for proper zIndex handling
        const oldLayerId = topLevelObj.layerId;
        this.editor.level.assignObjectToLayer(topLevelObj.id, targetLayerId);

        // Log object layer change with zIndex information
        if (Logger.currentLevel <= Logger.LEVELS.INFO) {
            const oldLayer = oldLayerId ? this.editor.level.getLayerById(oldLayerId) : null;
            const newLayer = this.editor.level.getLayerById(targetLayerId);
            const oldLayerIndex = oldLayer ? oldLayer.getIndex() : 'none';
            const newLayerIndex = newLayer ? newLayer.getIndex() : 'none';
            const objectIndex = topLevelObj.zIndex !== undefined ? Math.floor((topLevelObj.zIndex % 1) * 1000) : 'none';

            Logger.layer.info(`Object ${topLevelObj.name || topLevelObj.id} moved from layer "${oldLayer?.name || 'none'}" (index: ${oldLayerIndex}) to layer "${newLayer?.name || 'none'}" (index: ${newLayerIndex}), object index: ${objectIndex}`);
        }

        // FORCED INHERITANCE: Propagate layerId to all children if this is a group
        if (topLevelObj.type === 'group' && topLevelObj.children) {
            topLevelObj.propagateLayerIdToChildren();

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Propagated layerId ${targetLayerId} to all children of group ${topLevelObj.id}`);
            }
        }

        // Отслеживаем измененные объекты и слои для умной инвалидации кешей
        if (changedObjectIds) {
            changedObjectIds.add(topLevelObj.id);
        }
        if (affectedLayers && oldLayerId) {
            affectedLayers.add(oldLayerId);
        }
        if (affectedLayers && targetLayerId) {
            affectedLayers.add(targetLayerId);
        }

        // Invalidate cache for this object since layerId changed
        this.editor.invalidateObjectCaches(topLevelObj.id);

        // Группируем уведомления или отправляем сразу для обратной совместимости
        if (batchedNotifications) {
            // Группируем уведомления для оптимизации производительности
            this.batchNotifyObjectPropertyChanged(batchedNotifications, topLevelObj, 'layerId', oldLayerId, targetLayerId);

            if (oldEffectiveLayerId && oldEffectiveLayerId !== targetLayerId) {
                this.batchNotifyLayerCountChanged(batchedNotifications, oldEffectiveLayerId, targetLayerId);
            }
        } else {
            // Отправляем уведомления сразу (обратная совместимость)
            this.editor.stateManager.notifyListeners('objectPropertyChanged', topLevelObj, {
                property: 'layerId',
                oldValue: oldLayerId,
                newValue: targetLayerId
            });

            // Notify about layer objects count changes
            if (oldEffectiveLayerId && oldEffectiveLayerId !== targetLayerId) {
                const oldCount = this.editor.level.getLayerObjectsCount(oldEffectiveLayerId);
                this.editor.level.notifyLayerObjectsCountChange(oldEffectiveLayerId, oldCount, oldCount + 1);

                const newCount = this.editor.level.getLayerObjectsCount(targetLayerId);
                this.editor.level.notifyLayerObjectsCountChange(targetLayerId, newCount, newCount - 1);
            }
        }

        return { moved: true, targetObj: topLevelObj };
    }

    /**
     * Batch notify object property changed
     * @param {Object} batchedNotifications - Batched notifications structure
     * @param {Object} obj - Object that changed
     * @param {string} property - Property name
     * @param {*} oldValue - Old value
     * @param {*} newValue - New value
     */
    batchNotifyObjectPropertyChanged(batchedNotifications, obj, property, oldValue, newValue) {
        if (!batchedNotifications.objectPropertyChanges.has(property)) {
            batchedNotifications.objectPropertyChanges.set(property, []);
        }

        batchedNotifications.objectPropertyChanges.get(property).push({
            obj,
            oldValue,
            newValue
        });
    }

    /**
     * Batch notify layer count changed
     * @param {Object} batchedNotifications - Batched notifications structure
     * @param {string} oldLayerId - Old layer ID
     * @param {string} newLayerId - New layer ID
     */
    batchNotifyLayerCountChanged(batchedNotifications, oldLayerId, newLayerId) {
        // Группируем изменения счетчиков слоев
        if (!batchedNotifications.layerCountChanges.has(oldLayerId)) {
            const oldCount = this.editor.level.getLayerObjectsCount(oldLayerId);
            batchedNotifications.layerCountChanges.set(oldLayerId, {
                oldCount,
                newCount: oldCount - 1 // Уменьшаем счетчик для старого слоя
            });
        }

        if (!batchedNotifications.layerCountChanges.has(newLayerId)) {
            const newCount = this.editor.level.getLayerObjectsCount(newLayerId);
            batchedNotifications.layerCountChanges.set(newLayerId, {
                oldCount: newCount + 1, // Старый счетчик был на 1 больше
                newCount
            });
        }
    }

    /**
     * Flush all batched notifications
     * @param {Object} batchedNotifications - Batched notifications structure
     */
    flushBatchedNotifications(batchedNotifications) {
        // Отправляем уведомления об изменении свойств объектов
        for (const [property, changes] of batchedNotifications.objectPropertyChanges) {
            // Отправляем сводное уведомление для каждого свойства
            this.editor.stateManager.notifyListeners('objectsPropertyChanged', changes, {
                property,
                count: changes.length
            });

            // Для обратной совместимости отправляем отдельные уведомления
            changes.forEach(change => {
                this.editor.stateManager.notifyListeners('objectPropertyChanged', change.obj, {
                    property,
                    oldValue: change.oldValue,
                    newValue: change.newValue
                });
            });
        }

        // Отправляем уведомления об изменении счетчиков слоев
        for (const [layerId, countInfo] of batchedNotifications.layerCountChanges) {
            this.editor.level.notifyLayerObjectsCountChange(layerId, countInfo.newCount, countInfo.oldCount);
        }
    }

    /**
     * Check if objects can be moved to another layer
     * @returns {boolean} true if all conditions are met
     */
    canMoveObjectsToLayer() {
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug('canMoveObjectsToLayer called');
        }

        // Condition 1: Selected objects list is not empty
        const selectedObjects = this.editor.stateManager.get('selectedObjects');

        if (!selectedObjects || selectedObjects.size === 0) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug('Condition 1 failed: No selected objects');
            }
            return false;
        }

        // Condition 2: No active duplication (the only action we check for)
        const duplicate = this.editor.stateManager.get('duplicate');

        if (duplicate && duplicate.isActive) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug('Condition 2 failed: Duplication active');
            }
            Logger.layer.warn('Cannot move objects while duplication is active');
            return false;
        }

        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug('All conditions passed');
        }
        return true;
    }

    /**
     * Cleanup method
     */
    destroy() {
        Logger.lifecycle.info('LayerOperations destroyed');
    }
}
