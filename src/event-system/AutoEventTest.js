/**
 * Automatic Event System Test Runner
 * 
 * This test runs automatically and reports results to the agent
 * No user interaction required
 */

import { eventHandlerManager } from './EventHandlerManager.js';
import { UnifiedTouchManager } from './UnifiedTouchManager.js';

export class AutoEventTest {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0,
            details: [],
            errors: []
        };
        this.startTime = Date.now();
    }

    /**
     * Run all automatic tests
     * Returns results object for agent analysis
     */
    async runAllTests() {
        console.log('🤖 Starting Automatic Event System Tests...');
        
        try {
            // Test 1: Core system availability
            await this.testCoreSystemAvailability();
            
            // Test 2: EventHandlerManager functionality
            await this.testEventHandlerManagerFunctionality();
            
            // Test 3: UnifiedTouchManager functionality
            await this.testUnifiedTouchManagerFunctionality();
            
            // Test 4: Integration between systems
            await this.testSystemIntegration();
            
            // Test 5: Memory leak prevention
            await this.testMemoryLeakPrevention();
            
            // Calculate final results
            this.calculateResults();
            
            // Return results for agent
            return this.getResultsForAgent();
            
        } catch (error) {
            this.testResults.errors.push(`Critical test failure: ${error.message}`);
            return this.getResultsForAgent();
        }
    }

    /**
     * Test 1: Core system availability
     */
    async testCoreSystemAvailability() {
        const testName = 'Core System Availability';
        
        try {
            // Check if we're in browser environment
            if (typeof window === 'undefined') {
                this.addTestResult(testName, 'SKIP', 'Not in browser environment');
                return;
            }

            // Check if editor exists
            if (!window.editor) {
                this.addTestResult(testName, 'FAIL', 'LevelEditor not found');
                return;
            }

            // Check if eventHandlerManager exists
            if (!window.editor.eventHandlerManager) {
                this.addTestResult(testName, 'FAIL', 'EventHandlerManager not found');
                return;
            }

            // Check if unifiedTouchManager exists
            if (!window.editor.unifiedTouchManager) {
                this.addTestResult(testName, 'FAIL', 'UnifiedTouchManager not found');
                return;
            }

            this.addTestResult(testName, 'PASS', 'All core systems available');

        } catch (error) {
            this.addTestResult(testName, 'FAIL', error.message);
        }
    }

    /**
     * Test 2: EventHandlerManager functionality
     */
    async testEventHandlerManagerFunctionality() {
        const testName = 'EventHandlerManager Functionality';
        
        try {
            const eventManager = window.editor.eventHandlerManager;
            
            // Test basic element registration
            const testElement = document.createElement('div');
            testElement.id = 'auto-test-element';
            
            // Register element
            eventManager.registerElement(testElement, {
                click: (e) => console.log('Auto test click')
            }, 'auto-test-element');
            
            // Check registration
            const isRegistered = eventManager.isElementRegistered(testElement);
            if (!isRegistered) {
                this.addTestResult(testName, 'FAIL', 'Element registration failed');
                return;
            }
            
            // Test unregistration
            eventManager.unregisterElement(testElement);
            const isUnregistered = !eventManager.isElementRegistered(testElement);
            if (!isUnregistered) {
                this.addTestResult(testName, 'FAIL', 'Element unregistration failed');
                return;
            }
            
            this.addTestResult(testName, 'PASS', 'Registration and unregistration working');

        } catch (error) {
            this.addTestResult(testName, 'FAIL', error.message);
        }
    }

    /**
     * Test 3: UnifiedTouchManager functionality
     */
    async testUnifiedTouchManagerFunctionality() {
        const testName = 'UnifiedTouchManager Functionality';
        
        try {
            const touchManager = window.editor.unifiedTouchManager;
            
            if (!touchManager) {
                this.addTestResult(testName, 'FAIL', 'UnifiedTouchManager not available');
                return;
            }
            
            // Test touch element registration
            const testElement = document.createElement('div');
            testElement.id = 'auto-test-touch-element';
            
            // Register touch element
            touchManager.registerElement(testElement, 'button', {
                onTap: () => console.log('Auto test tap')
            }, 'auto-test-touch-element');
            
            // Check if element is registered in touch manager
            const registeredElements = touchManager.registeredElements;
            const isRegistered = registeredElements && registeredElements.has(testElement);
            
            if (!isRegistered) {
                this.addTestResult(testName, 'FAIL', 'Touch element registration failed');
                return;
            }
            
            // Test unregistration
            touchManager.unregisterElement(testElement);
            const isUnregistered = !registeredElements.has(testElement);
            
            if (!isUnregistered) {
                this.addTestResult(testName, 'FAIL', 'Touch element unregistration failed');
                return;
            }
            
            this.addTestResult(testName, 'PASS', 'Touch registration and unregistration working');

        } catch (error) {
            this.addTestResult(testName, 'FAIL', error.message);
        }
    }

    /**
     * Test 4: Integration between systems
     */
    async testSystemIntegration() {
        const testName = 'System Integration';
        
        try {
            const eventManager = window.editor.eventHandlerManager;
            const touchManager = window.editor.unifiedTouchManager;
            
            // Test touch element registration through EventHandlerManager
            const testElement = document.createElement('div');
            testElement.id = 'auto-test-integration-element';
            
            // Register through EventHandlerManager (should integrate with UnifiedTouchManager)
            eventManager.registerTouchElement(testElement, 'panelResizer', {
                direction: 'horizontal',
                onResize: () => console.log('Auto test resize')
            }, 'auto-test-integration-element');
            
            // Check if element is registered in both systems
            const isRegisteredInEventManager = eventManager.isElementRegistered(testElement);
            const isRegisteredInTouchManager = touchManager.registeredElements.has(testElement);
            
            if (!isRegisteredInEventManager || !isRegisteredInTouchManager) {
                this.addTestResult(testName, 'FAIL', 'Integration registration failed');
                return;
            }
            
            // Test cleanup through EventHandlerManager
            eventManager.unregisterTouchElement(testElement);
            
            const isUnregisteredInEventManager = !eventManager.isElementRegistered(testElement);
            const isUnregisteredInTouchManager = !touchManager.registeredElements.has(testElement);
            
            if (!isUnregisteredInEventManager || !isUnregisteredInTouchManager) {
                this.addTestResult(testName, 'FAIL', 'Integration cleanup failed');
                return;
            }
            
            this.addTestResult(testName, 'PASS', 'System integration working correctly');

        } catch (error) {
            this.addTestResult(testName, 'FAIL', error.message);
        }
    }

    /**
     * Test 5: Memory leak prevention
     */
    async testMemoryLeakPrevention() {
        const testName = 'Memory Leak Prevention';
        
        try {
            const eventManager = window.editor.eventHandlerManager;
            const touchManager = window.editor.unifiedTouchManager;
            
            // Create multiple elements
            const elements = [];
            for (let i = 0; i < 10; i++) {
                const element = document.createElement('div');
                element.id = `auto-test-memory-${i}`;
                elements.push(element);
                
                // Register in both systems
                eventManager.registerElement(element, {
                    click: () => console.log(`Click ${i}`)
                }, `auto-test-memory-${i}`);
                
                touchManager.registerElement(element, 'button', {
                    onTap: () => console.log(`Tap ${i}`)
                }, `auto-test-memory-${i}`);
            }
            
            // Check all are registered
            const allRegistered = elements.every(el => 
                eventManager.isElementRegistered(el) && 
                touchManager.registeredElements.has(el)
            );
            
            if (!allRegistered) {
                this.addTestResult(testName, 'FAIL', 'Not all elements registered');
                return;
            }
            
            // Clean up all elements
            elements.forEach(element => {
                eventManager.unregisterElement(element);
                touchManager.unregisterElement(element);
            });
            
            // Check all are unregistered
            const allUnregistered = elements.every(el => 
                !eventManager.isElementRegistered(el) && 
                !touchManager.registeredElements.has(el)
            );
            
            if (!allUnregistered) {
                this.addTestResult(testName, 'FAIL', 'Not all elements cleaned up');
                return;
            }
            
            this.addTestResult(testName, 'PASS', 'Memory leak prevention working');

        } catch (error) {
            this.addTestResult(testName, 'FAIL', error.message);
        }
    }

    /**
     * Add test result
     */
    addTestResult(testName, status, message) {
        this.testResults.details.push({
            test: testName,
            status: status,
            message: message,
            timestamp: Date.now()
        });
        
        if (status === 'PASS') {
            this.testResults.passed++;
        } else if (status === 'FAIL') {
            this.testResults.failed++;
            this.testResults.errors.push(`${testName}: ${message}`);
        } else {
            this.testResults.skipped++;
        }
        
        this.testResults.total++;
        
        // Log to console for debugging
        const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
        console.log(`${emoji} ${testName}: ${message}`);
    }

    /**
     * Calculate final results
     */
    calculateResults() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        this.testResults.duration = duration;
        this.testResults.successRate = this.testResults.total > 0 ? 
            (this.testResults.passed / this.testResults.total * 100).toFixed(1) : 0;
        
        console.log(`\n📊 Auto Test Results:`);
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`⏭️ Skipped: ${this.testResults.skipped}`);
        console.log(`📊 Total: ${this.testResults.total}`);
        console.log(`⏱️ Duration: ${duration}ms`);
        console.log(`📈 Success Rate: ${this.testResults.successRate}%`);
    }

    /**
     * Get results formatted for agent analysis
     */
    getResultsForAgent() {
        return {
            summary: {
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                skipped: this.testResults.skipped,
                total: this.testResults.total,
                successRate: this.testResults.successRate,
                duration: this.testResults.duration
            },
            details: this.testResults.details,
            errors: this.testResults.errors,
            status: this.testResults.failed === 0 ? 'SUCCESS' : 'FAILED',
            recommendation: this.getRecommendation()
        };
    }

    /**
     * Get recommendation based on results
     */
    getRecommendation() {
        if (this.testResults.failed === 0) {
            return 'All tests passed. Event system is working correctly.';
        } else if (this.testResults.failed <= 2) {
            return 'Most tests passed. Minor issues detected. Check failed tests.';
        } else {
            return 'Multiple test failures. Event system needs attention.';
        }
    }
}

// Auto-export for agent access
if (typeof window !== 'undefined') {
    window.AutoEventTest = AutoEventTest;
    
    // Auto-run when loaded (for agent)
    console.log('🤖 AutoEventTest loaded. Agent can run: new AutoEventTest().runAllTests()');
}
