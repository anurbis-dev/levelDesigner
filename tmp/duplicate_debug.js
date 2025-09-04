/**
 * Debug utility for duplicate object rendering
 * This file contains debugging code for the duplication feature
 */

export class DuplicateDebugger {
    constructor() {
        this.logs = [];
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, message, data };
        this.logs.push(logEntry);
        console.log(`[DUPLICATE DEBUG ${timestamp}] ${message}`, data || '');
    }

    logDuplicateStart(selectedObjects) {
        this.log('=== DUPLICATE DEBUG START ===');
        this.log('Selected objects IDs:', Array.from(selectedObjects));
    }

    logDuplicateEnd() {
        this.log('=== DUPLICATE DEBUG END ===');
    }

    logObjectCloning(obj, cloned, final) {
        this.log('Cloning object:', obj);
        this.log('Deep cloned object:', cloned);
        this.log('After reassignIdsDeep:', final);
    }

    logStateUpdate(isPlacingObjects, placingObjectsCount) {
        this.log('State updated, isPlacingObjects:', isPlacingObjects);
        this.log('Placing objects count:', placingObjectsCount);
    }

    logRender(isPlacingObjects, count) {
        if (isPlacingObjects && count > 0) {
            this.log('RENDER: Drawing placing objects, count:', count);
        } else {
            this.log('RENDER: Not drawing placing objects, isPlacingObjects:', isPlacingObjects, 'count:', count || 0);
        }
    }

    logCanvasRenderer(objects) {
        this.log('CanvasRenderer.drawPlacingObjects called with:', objects);
        if (!objects || objects.length === 0) {
            this.log('CanvasRenderer: No objects to draw, returning');
            return;
        }
        this.log('CanvasRenderer: Drawing', objects.length, 'objects');
    }

    logSingleObjectDraw(obj, x, y) {
        this.log('CanvasRenderer.drawSingleObject called:', obj.id, 'at', x, y, 'visible:', obj.visible);
        
        if (!obj.visible) {
            this.log('CanvasRenderer: Object not visible, returning');
            return;
        }

        if (obj.imgSrc) {
            this.log('CanvasRenderer: Trying to draw image:', obj.imgSrc);
        } else {
            this.log('CanvasRenderer: Drawing colored rectangle at', x, y, 'size:', obj.width, obj.height, 'color:', obj.color);
        }
    }

    getLogs() {
        return this.logs;
    }

    clearLogs() {
        this.logs = [];
    }

    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }
}

// Standalone debug functions for easy integration
export const duplicateDebug = {
    start: (selectedObjects) => {
        console.log('=== DUPLICATE DEBUG START ===');
        console.log('Selected objects IDs:', Array.from(selectedObjects));
    },

    end: () => {
        console.log('=== DUPLICATE DEBUG END ===');
    },

    cloning: (obj, cloned, final) => {
        console.log('Cloning object:', obj);
        console.log('Deep cloned object:', cloned);
        console.log('After reassignIdsDeep:', final);
    },

    stateUpdate: (isPlacingObjects, count) => {
        console.log('State updated, isPlacingObjects:', isPlacingObjects);
        console.log('Placing objects count:', count);
    },

    render: (isPlacingObjects, count) => {
        if (isPlacingObjects && count > 0) {
            console.log('RENDER: Drawing placing objects, count:', count);
        } else {
            console.log('RENDER: Not drawing placing objects, isPlacingObjects:', isPlacingObjects, 'count:', count || 0);
        }
    },

    canvasRenderer: (objects) => {
        console.log('CanvasRenderer.drawPlacingObjects called with:', objects);
        if (!objects || objects.length === 0) {
            console.log('CanvasRenderer: No objects to draw, returning');
            return false;
        }
        console.log('CanvasRenderer: Drawing', objects.length, 'objects');
        return true;
    },

    singleObject: (obj, x, y) => {
        console.log('CanvasRenderer.drawSingleObject called:', obj.id, 'at', x, y, 'visible:', obj.visible);
        
        if (!obj.visible) {
            console.log('CanvasRenderer: Object not visible, returning');
            return false;
        }

        if (obj.imgSrc) {
            console.log('CanvasRenderer: Trying to draw image:', obj.imgSrc);
        } else {
            console.log('CanvasRenderer: Drawing colored rectangle at', x, y, 'size:', obj.width, obj.height, 'color:', obj.color);
        }
        return true;
    }
};

// Current issue analysis
export const issueAnalysis = {
    problem: "Objects don't stick to cursor during duplication",
    
    possibleCauses: [
        "Mouse coordinates not properly initialized in duplicateSelectedObjects",
        "updatePlacingObjectsPosition not being called in handleMouseMove",
        "Position update logic not working correctly",
        "Render not being called after position updates",
        "Canvas coordinate system issues"
    ],
    
    debugSteps: [
        "1. Check if duplicateSelectedObjects is called",
        "2. Check if mouse coordinates are available",
        "3. Check if updatePlacingObjectsPosition is called on mouse move",
        "4. Check if object positions are actually updated",
        "5. Check if render is called after position updates"
    ],
    
    currentCodeIssues: [
        "Mouse coordinates fallback to canvas center instead of actual mouse position",
        "Position update optimization might be preventing updates",
        "Multiple console.log statements might be causing performance issues"
    ]
};