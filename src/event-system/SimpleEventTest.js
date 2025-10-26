/**
 * Simple Event System Test
 * 
 * Basic test that can be run in browser console to verify the event system works
 */

export class SimpleEventTest {
    constructor() {
        this.testResults = [];
    }

    /**
     * Run basic tests
     */
    async runBasicTests() {
        console.log('🧪 Starting Simple Event System Tests...');
        
        try {
            // Test 1: Check if EventHandlerManager exists
            await this.testEventHandlerManagerExists();
            
            // Test 2: Check if UnifiedTouchManager can be created
            await this.testUnifiedTouchManagerCreation();
            
            // Test 3: Test basic element registration
            await this.testBasicElementRegistration();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            this.testResults.push({ test: 'Basic test', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test if EventHandlerManager exists and is accessible
     */
    async testEventHandlerManagerExists() {
        try {
            if (typeof window !== 'undefined' && window.editor && window.editor.eventHandlerManager) {
                this.testResults.push({ test: 'EventHandlerManager exists', status: 'PASS' });
            } else {
                this.testResults.push({ test: 'EventHandlerManager exists', status: 'FAIL', error: 'EventHandlerManager not found' });
            }
        } catch (error) {
            this.testResults.push({ test: 'EventHandlerManager exists', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test if UnifiedTouchManager can be created
     */
    async testUnifiedTouchManagerCreation() {
        try {
            if (typeof window !== 'undefined' && window.editor && window.editor.unifiedTouchManager) {
                this.testResults.push({ test: 'UnifiedTouchManager exists', status: 'PASS' });
            } else {
                this.testResults.push({ test: 'UnifiedTouchManager exists', status: 'FAIL', error: 'UnifiedTouchManager not found' });
            }
        } catch (error) {
            this.testResults.push({ test: 'UnifiedTouchManager exists', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Test basic element registration
     */
    async testBasicElementRegistration() {
        try {
            if (typeof window !== 'undefined' && window.editor && window.editor.eventHandlerManager) {
                // Create a mock element
                const mockElement = document.createElement('div');
                mockElement.id = 'test-element';
                
                // Try to register it
                window.editor.eventHandlerManager.registerElement(mockElement, {
                    click: (e) => console.log('✅ Click handler called')
                }, 'test-element');
                
                // Check if it's registered
                const isRegistered = window.editor.eventHandlerManager.isElementRegistered(mockElement);
                
                if (isRegistered) {
                    this.testResults.push({ test: 'Basic element registration', status: 'PASS' });
                    
                    // Clean up
                    window.editor.eventHandlerManager.unregisterElement(mockElement);
                } else {
                    this.testResults.push({ test: 'Basic element registration', status: 'FAIL', error: 'Element not registered' });
                }
            } else {
                this.testResults.push({ test: 'Basic element registration', status: 'SKIP', error: 'EventHandlerManager not available' });
            }
        } catch (error) {
            this.testResults.push({ test: 'Basic element registration', status: 'FAIL', error: error.message });
        }
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n📊 Simple Test Results:');
        console.log('========================');
        
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        
        this.testResults.forEach(result => {
            let status;
            if (result.status === 'PASS') {
                status = '✅';
                passed++;
            } else if (result.status === 'FAIL') {
                status = '❌';
                failed++;
            } else {
                status = '⏭️';
                skipped++;
            }
            
            console.log(`${status} ${result.test}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log('\n📈 Summary:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏭️ Skipped: ${skipped}`);
        console.log(`📊 Total: ${this.testResults.length}`);
        
        if (failed === 0) {
            console.log('\n🎉 All tests passed! Event system is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Check the errors above.');
        }
    }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    window.SimpleEventTest = SimpleEventTest;
    
    // Auto-run test when loaded
    console.log('🚀 SimpleEventTest loaded. Run: new SimpleEventTest().runBasicTests()');
}
