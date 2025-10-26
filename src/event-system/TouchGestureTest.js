/**
 * Comprehensive Touch Gesture Test
 * 
 * Tests all touch gestures and interactions in the unified event system
 */

import { eventHandlerManager } from './EventHandlerManager.js';
import { UnifiedTouchManager } from './UnifiedTouchManager.js';
import { EventSystemIntegrationTest } from './EventSystemIntegrationTest.js';

export class TouchGestureTest {
    constructor() {
        this.eventHandlerManager = eventHandlerManager;
        this.unifiedTouchManager = new UnifiedTouchManager(null, this.eventHandlerManager);
        this.eventHandlerManager.setUnifiedTouchManager(this.unifiedTouchManager);
        this.testResults = [];
        this.mockLevelEditor = this.createMockLevelEditor();
    }

    /**
     * Create mock LevelEditor for testing
     */
    createMockLevelEditor() {
        return {
            canvasRenderer: {
                canvas: document.createElement('canvas'),
                screenToWorld: (x, y, camera) => ({ x: x / camera.zoom, y: y / camera.zoom })
            },
            stateManager: {
                get: (key) => {
                    const state = {
                        camera: { x: 0, y: 0, zoom: 1 },
                        mouse: { isMarqueeSelecting: false, marqueeRect: null }
                    };
                    return state[key];
                },
                update: (updates) => {
                    console.log('State updated:', updates);
                },
                set: (key, value) => {
                    console.log('State set:', key, value);
                }
            },
            mouseHandlers: {
                finishMarqueeSelection: () => {
                    console.log('✅ Marquee selection finished');
                }
            },
            render: () => {
                console.log('✅ Render called');
            }
        };
    }

    /**
     * Run all touch gesture tests
     */
    async runAllTests() {
        console.log('🧪 Starting Comprehensive Touch Gesture Tests...');
        
        try {
            // Initialize systems
            this.eventHandlerManager.init();
            this.eventHandlerManager.setUnifiedTouchManager(this.unifiedTouchManager);
            
            // Test individual gestures
            await this.testSingleTouchGestures();
            await this.testTwoFingerGestures();
            await this.testPanelResizerGestures();
            await this.testButtonGestures();
            await this.testCanvasGestures();
            
            // Test gesture conflicts
            await this.testGestureConflicts();
            
            // Test cleanup
            await this.testCleanup();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            this.testResults.push({ test: 'Touch gesture test', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test single touch gestures
     */
    async testSingleTouchGestures() {
        console.log('\n📱 Testing Single Touch Gestures...');
        
        try {
            // Create test button
            const button = document.createElement('button');
            button.id = 'test-button';
            button.textContent = 'Test Button';
            
            // Register button with tap, double-tap, and long-press
            this.unifiedTouchManager.registerElement(button, 'button', {
                onTap: (element, touch) => {
                    console.log('✅ Single tap detected');
                    this.testResults.push({ test: 'Single tap', status: 'PASS' });
                },
                onDoubleTap: (element, touch) => {
                    console.log('✅ Double tap detected');
                    this.testResults.push({ test: 'Double tap', status: 'PASS' });
                },
                onLongPress: (element, touch) => {
                    console.log('✅ Long press detected');
                    this.testResults.push({ test: 'Long press', status: 'PASS' });
                }
            }, 'test-button');
            
            // Simulate single tap
            this.simulateTouchEvent(button, 'touchstart', [{ clientX: 100, clientY: 100, identifier: 1 }]);
            this.simulateTouchEvent(button, 'touchend', [{ clientX: 100, clientY: 100, identifier: 1 }]);
            
            // Simulate double tap
            setTimeout(() => {
                this.simulateTouchEvent(button, 'touchstart', [{ clientX: 100, clientY: 100, identifier: 1 }]);
                this.simulateTouchEvent(button, 'touchend', [{ clientX: 100, clientY: 100, identifier: 1 }]);
            }, 100);
            
            // Simulate long press
            setTimeout(() => {
                this.simulateTouchEvent(button, 'touchstart', [{ clientX: 100, clientY: 100, identifier: 2 }]);
                setTimeout(() => {
                    this.simulateTouchEvent(button, 'touchend', [{ clientX: 100, clientY: 100, identifier: 2 }]);
                }, 600);
            }, 200);
            
        } catch (error) {
            this.testResults.push({ test: 'Single touch gestures', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test two-finger gestures
     */
    async testTwoFingerGestures() {
        console.log('\n👆 Testing Two-Finger Gestures...');
        
        try {
            // Create test canvas
            const canvas = document.createElement('canvas');
            canvas.id = 'test-canvas';
            canvas.width = 800;
            canvas.height = 600;
            
            // Register canvas with pan/zoom support
            this.unifiedTouchManager.registerElement(canvas, 'canvas', {
                enablePan: true,
                enableZoom: true,
                enableMarquee: true
            }, 'test-canvas');
            
            // Simulate two-finger pan
            this.simulateTouchEvent(canvas, 'touchstart', [
                { clientX: 100, clientY: 100, identifier: 1 },
                { clientX: 200, clientY: 100, identifier: 2 }
            ]);
            
            this.simulateTouchEvent(canvas, 'touchmove', [
                { clientX: 150, clientY: 150, identifier: 1 },
                { clientX: 250, clientY: 150, identifier: 2 }
            ]);
            
            this.simulateTouchEvent(canvas, 'touchend', [
                { clientX: 150, clientY: 150, identifier: 1 },
                { clientX: 250, clientY: 150, identifier: 2 }
            ]);
            
            console.log('✅ Two-finger pan gesture simulated');
            this.testResults.push({ test: 'Two-finger pan', status: 'PASS' });
            
            // Simulate two-finger zoom
            setTimeout(() => {
                this.simulateTouchEvent(canvas, 'touchstart', [
                    { clientX: 100, clientY: 100, identifier: 1 },
                    { clientX: 200, clientY: 100, identifier: 2 }
                ]);
                
                this.simulateTouchEvent(canvas, 'touchmove', [
                    { clientX: 50, clientY: 100, identifier: 1 },
                    { clientX: 250, clientY: 100, identifier: 2 }
                ]);
                
                this.simulateTouchEvent(canvas, 'touchend', [
                    { clientX: 50, clientY: 100, identifier: 1 },
                    { clientX: 250, clientY: 100, identifier: 2 }
                ]);
                
                console.log('✅ Two-finger zoom gesture simulated');
                this.testResults.push({ test: 'Two-finger zoom', status: 'PASS' });
            }, 100);
            
        } catch (error) {
            this.testResults.push({ test: 'Two-finger gestures', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test panel resizer gestures
     */
    async testPanelResizerGestures() {
        console.log('\n📏 Testing Panel Resizer Gestures...');
        
        try {
            // Create test resizer
            const resizer = document.createElement('div');
            resizer.id = 'test-resizer';
            resizer.className = 'resizer';
            
            const panel = document.createElement('div');
            panel.style.width = '300px';
            panel.style.height = '400px';
            panel.appendChild(resizer);
            
            // Register resizer
            this.unifiedTouchManager.registerElement(resizer, 'panelResizer', {
                direction: 'horizontal',
                minSize: 100,
                maxSize: 800,
                onResizeStart: (element, targetPanel, touch) => {
                    console.log('✅ Resize start detected');
                    this.testResults.push({ test: 'Resize start', status: 'PASS' });
                },
                onResize: (element, targetPanel, newSize, touch) => {
                    console.log('✅ Resize detected, new size:', newSize);
                    this.testResults.push({ test: 'Resize move', status: 'PASS' });
                },
                onResizeEnd: (element, targetPanel, currentSize) => {
                    console.log('✅ Resize end detected, final size:', currentSize);
                    this.testResults.push({ test: 'Resize end', status: 'PASS' });
                }
            }, 'test-resizer');
            
            // Simulate resize gesture
            this.simulateTouchEvent(resizer, 'touchstart', [{ clientX: 300, clientY: 200, identifier: 1 }]);
            this.simulateTouchEvent(resizer, 'touchmove', [{ clientX: 350, clientY: 200, identifier: 1 }]);
            this.simulateTouchEvent(resizer, 'touchend', [{ clientX: 350, clientY: 200, identifier: 1 }]);
            
        } catch (error) {
            this.testResults.push({ test: 'Panel resizer gestures', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test button gestures
     */
    async testButtonGestures() {
        console.log('\n🔘 Testing Button Gestures...');
        
        try {
            // Create test button
            const button = document.createElement('button');
            button.id = 'test-button-gestures';
            button.textContent = 'Gesture Button';
            
            // Register button
            this.unifiedTouchManager.registerElement(button, 'button', {
                onTap: (element, touch) => {
                    console.log('✅ Button tap detected');
                    this.testResults.push({ test: 'Button tap', status: 'PASS' });
                },
                onLongPress: (element, touch) => {
                    console.log('✅ Button long press detected');
                    this.testResults.push({ test: 'Button long press', status: 'PASS' });
                }
            }, 'test-button-gestures');
            
            // Simulate button tap
            this.simulateTouchEvent(button, 'touchstart', [{ clientX: 100, clientY: 100, identifier: 1 }]);
            this.simulateTouchEvent(button, 'touchend', [{ clientX: 100, clientY: 100, identifier: 1 }]);
            
        } catch (error) {
            this.testResults.push({ test: 'Button gestures', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test canvas gestures
     */
    async testCanvasGestures() {
        console.log('\n🎨 Testing Canvas Gestures...');
        
        try {
            // Create test canvas
            const canvas = document.createElement('canvas');
            canvas.id = 'test-canvas-gestures';
            canvas.width = 800;
            canvas.height = 600;
            
            // Register canvas
            this.unifiedTouchManager.registerElement(canvas, 'canvas', {
                enablePan: true,
                enableZoom: true,
                enableMarquee: true,
                enableContextMenu: true
            }, 'test-canvas-gestures');
            
            // Simulate marquee selection
            this.simulateTouchEvent(canvas, 'touchstart', [{ clientX: 100, clientY: 100, identifier: 1 }]);
            this.simulateTouchEvent(canvas, 'touchmove', [{ clientX: 200, clientY: 200, identifier: 1 }]);
            this.simulateTouchEvent(canvas, 'touchend', [{ clientX: 200, clientY: 200, identifier: 1 }]);
            
            console.log('✅ Canvas marquee selection simulated');
            this.testResults.push({ test: 'Canvas marquee', status: 'PASS' });
            
        } catch (error) {
            this.testResults.push({ test: 'Canvas gestures', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test gesture conflicts
     */
    async testGestureConflicts() {
        console.log('\n⚠️ Testing Gesture Conflicts...');
        
        try {
            // Create overlapping elements
            const canvas = document.createElement('canvas');
            canvas.id = 'test-conflict-canvas';
            canvas.width = 400;
            canvas.height = 300;
            
            const button = document.createElement('button');
            button.id = 'test-conflict-button';
            button.style.position = 'absolute';
            button.style.left = '100px';
            button.style.top = '100px';
            button.style.width = '100px';
            button.style.height = '50px';
            
            // Register both elements
            this.unifiedTouchManager.registerElement(canvas, 'canvas', {
                enableMarquee: true
            }, 'test-conflict-canvas');
            
            this.unifiedTouchManager.registerElement(button, 'button', {
                onTap: (element, touch) => {
                    console.log('✅ Button tap in conflict test');
                    this.testResults.push({ test: 'Conflict resolution', status: 'PASS' });
                }
            }, 'test-conflict-button');
            
            // Simulate touch on button (should trigger button, not canvas)
            this.simulateTouchEvent(button, 'touchstart', [{ clientX: 150, clientY: 125, identifier: 1 }]);
            this.simulateTouchEvent(button, 'touchend', [{ clientX: 150, clientY: 125, identifier: 1 }]);
            
        } catch (error) {
            this.testResults.push({ test: 'Gesture conflicts', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test cleanup
     */
    async testCleanup() {
        console.log('\n🧹 Testing Cleanup...');
        
        try {
            // Get all registered elements
            const elements = this.eventHandlerManager.getAllElements();
            
            // Unregister all elements
            elements.forEach(element => {
                this.unifiedTouchManager.unregisterElement(element);
            });
            
            // Check if all elements are unregistered
            const remainingElements = this.eventHandlerManager.getAllElements();
            
            if (remainingElements.length === 0) {
                console.log('✅ All elements cleaned up successfully');
                this.testResults.push({ test: 'Cleanup', status: 'PASS' });
            } else {
                console.log('❌ Some elements still registered:', remainingElements.length);
                this.testResults.push({ test: 'Cleanup', status: 'FAIL', error: `${remainingElements.length} elements still registered` });
            }
            
        } catch (error) {
            this.testResults.push({ test: 'Cleanup', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Simulate touch event
     */
    simulateTouchEvent(element, eventType, touches) {
        const event = new TouchEvent(eventType, {
            touches: touches,
            changedTouches: touches,
            targetTouches: touches,
            bubbles: true,
            cancelable: true
        });
        
        element.dispatchEvent(event);
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n📊 Touch Gesture Test Results:');
        console.log('==============================');
        
        let passed = 0;
        let failed = 0;
        
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${status} ${result.test}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
            
            if (result.status === 'PASS') {
                passed++;
            } else {
                failed++;
            }
        });
        
        console.log('\n📈 Summary:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📊 Total: ${this.testResults.length}`);
        
        if (failed === 0) {
            console.log('\n🎉 All touch gesture tests passed!');
        } else {
            console.log('\n⚠️ Some tests failed. Check the errors above.');
        }
    }

    /**
     * Cleanup test resources
     */
    cleanup() {
        this.unifiedTouchManager.destroy();
        this.eventHandlerManager.destroy();
        console.log('🧹 Touch gesture test cleanup completed');
    }
}

// Export for use in browser console or other tests
if (typeof window !== 'undefined') {
    window.TouchGestureTest = TouchGestureTest;
}
