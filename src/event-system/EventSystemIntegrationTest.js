/**
 * Test script for EventHandlerManager and UnifiedTouchManager integration
 * 
 * This script tests the integration between the unified event system
 * and touch support without affecting the main application
 */

import { eventHandlerManager } from './EventHandlerManager.js';
import { UnifiedTouchManager } from './UnifiedTouchManager.js';

export class EventSystemIntegrationTest {
    constructor() {
        this.eventHandlerManager = eventHandlerManager;
        this.unifiedTouchManager = null;
        this.testResults = [];
    }

    /**
     * Run all integration tests
     */
    async runTests() {
        console.log('🧪 Starting Event System Integration Tests...');
        
        try {
            // Initialize UnifiedTouchManager
            this.unifiedTouchManager = new UnifiedTouchManager(null, this.eventHandlerManager);
            this.eventHandlerManager.setUnifiedTouchManager(this.unifiedTouchManager);
            this.testResults.push({ test: 'UnifiedTouchManager initialization', status: 'PASS' });
            
            // Test element registration
            await this.testElementRegistration();
            
            // Test canvas registration
            await this.testCanvasRegistration();
            
            // Test cleanup
            await this.testCleanup();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            this.testResults.push({ test: 'Integration test', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test element registration with UnifiedTouchManager
     */
    async testElementRegistration() {
        try {
            // Create a mock element
            const mockElement = document.createElement('div');
            mockElement.id = 'test-resizer';
            mockElement.className = 'resizer';
            
            // Mock configuration
            const config = {
                direction: 'horizontal',
                minSize: 100,
                maxSize: 800,
                onResizeStart: (element, targetPanel, touch) => {
                    console.log('✅ Resize start handler called');
                },
                onResize: (element, targetPanel, newSize, touch) => {
                    console.log('✅ Resize handler called with size:', newSize);
                },
                onResizeEnd: (element, targetPanel, currentSize) => {
                    console.log('✅ Resize end handler called with size:', currentSize);
                }
            };
            
            // Register element through EventHandlerManager
            this.eventHandlerManager.registerTouchElement(mockElement, 'panelResizer', config, 'test-resizer');
            
            // Check if element is registered
            const isRegistered = this.eventHandlerManager.isElementRegistered(mockElement);
            
            if (isRegistered) {
                this.testResults.push({ test: 'Touch element registration', status: 'PASS' });
            } else {
                this.testResults.push({ test: 'Touch element registration', status: 'FAIL' });
            }
            
        } catch (error) {
            this.testResults.push({ test: 'Touch element registration', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test canvas registration with unified handlers
     */
    async testCanvasRegistration() {
        try {
            // Create a mock canvas
            const mockCanvas = document.createElement('canvas');
            mockCanvas.id = 'test-canvas';
            
            // Mock configuration
            const config = {
                onMouseDown: (e) => console.log('✅ Mouse down handler called'),
                onMouseMove: (e) => console.log('✅ Mouse move handler called'),
                onMouseUp: (e) => console.log('✅ Mouse up handler called'),
                onTouchStart: (e) => console.log('✅ Touch start handler called'),
                onTouchMove: (e) => console.log('✅ Touch move handler called'),
                onTouchEnd: (e) => console.log('✅ Touch end handler called')
            };
            
            // Register canvas
            this.eventHandlerManager.registerCanvas(mockCanvas, config, 'test-canvas');
            
            // Check if canvas is registered
            const isRegistered = this.eventHandlerManager.isElementRegistered(mockCanvas);
            
            if (isRegistered) {
                this.testResults.push({ test: 'Canvas registration', status: 'PASS' });
            } else {
                this.testResults.push({ test: 'Canvas registration', status: 'FAIL' });
            }
            
        } catch (error) {
            this.testResults.push({ test: 'Canvas registration', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test cleanup functionality
     */
    async testCleanup() {
        try {
            // Get all registered elements
            const elements = this.eventHandlerManager.getAllRegisteredElements();
            
            // Unregister all elements
            elements.forEach(element => {
                this.eventHandlerManager.unregisterElement(element);
            });
            
            // Check if all elements are unregistered
            const remainingElements = this.eventHandlerManager.getAllRegisteredElements();
            
            if (remainingElements.length === 0) {
                this.testResults.push({ test: 'Cleanup', status: 'PASS' });
            } else {
                this.testResults.push({ test: 'Cleanup', status: 'FAIL', error: `${remainingElements.length} elements still registered` });
            }
            
        } catch (error) {
            this.testResults.push({ test: 'Cleanup', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n📊 Test Results:');
        console.log('================');
        
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
            console.log('\n🎉 All tests passed! Integration is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Check the errors above.');
        }
    }

    /**
     * Cleanup test resources
     */
    cleanup() {
        if (this.unifiedTouchManager) {
            this.unifiedTouchManager.destroy();
        }
        console.log('🧹 Test cleanup completed');
    }
}

// Export for use in browser console or other tests
if (typeof window !== 'undefined') {
    window.EventSystemIntegrationTest = EventSystemIntegrationTest;
}
