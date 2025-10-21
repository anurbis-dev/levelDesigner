/**
 * Mobile Interface Manager
 * 
 * Централизованная система для обработки мобильного интерфейса
 * с учетом различий между платформами (Android/iOS)
 * 
 * Features:
 * - Детекция платформ и их специфичных особенностей
 * - Адаптация диалогов и всплывающих окон
 * - Система событий для уведомления компонентов
 * - Платформо-специфичные оптимизации
 * - Централизованное управление мобильными стилями
 * 
 * @author Level Designer
 * @version 3.51.8
 */

import { Logger } from '../utils/Logger.js';

export class MobileInterfaceManager {
    constructor() {
        this.isInitialized = false;
        this.platform = null;
        this.deviceInfo = null;
        this.adaptationStrategies = new Map();
        this.eventListeners = new Map();
        this.dialogRegistry = new Set();
        
        // Platform-specific configurations
        this.platformConfigs = {
            ios: {
                preventZoom: true,
                touchTargetSize: 44,
                safeAreaInsets: true,
                viewportMeta: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
                inputFontSize: 16, // Prevent zoom on iOS
                scrollBehavior: 'smooth'
            },
            android: {
                preventZoom: false,
                touchTargetSize: 48,
                safeAreaInsets: false,
                viewportMeta: 'width=device-width, initial-scale=1.0',
                inputFontSize: 14,
                scrollBehavior: 'auto'
            },
            desktop: {
                preventZoom: false,
                touchTargetSize: 32,
                safeAreaInsets: false,
                viewportMeta: 'width=device-width, initial-scale=1.0',
                inputFontSize: 14,
                scrollBehavior: 'auto'
            }
        };
        
        this.init();
    }
    
    /**
     * Initialize the mobile interface manager
     */
    init() {
        if (this.isInitialized) return;
        
        this.detectPlatform();
        this.setupAdaptationStrategies();
        this.setupEventListeners();
        this.applyInitialAdaptations();
        
        this.isInitialized = true;
        Logger.mobile.info('📱 Mobile Interface Manager initialized', {
            platform: this.platform,
            deviceInfo: this.deviceInfo
        });
    }
    
    /**
     * Detect platform and device characteristics
     */
    detectPlatform() {
        const userAgent = navigator.userAgent;
        const isTouch = 'ontouchstart' in window;
        const screenWidth = window.innerWidth;
        const devicePixelRatio = window.devicePixelRatio || 1;
        
        // Detect platform
        if (/iPad|iPhone|iPod/.test(userAgent)) {
            this.platform = 'ios';
        } else if (/Android/.test(userAgent)) {
            this.platform = 'android';
        } else if (isTouch && screenWidth <= 768) {
            this.platform = 'mobile-unknown';
        } else {
            this.platform = 'desktop';
        }
        
        // Detect device characteristics
        this.deviceInfo = {
            platform: this.platform,
            isTouch,
            screenWidth,
            screenHeight: window.innerHeight,
            devicePixelRatio,
            orientation: this.getOrientation(),
            isRetina: devicePixelRatio >= 2,
            isHighDPI: devicePixelRatio >= 3,
            userAgent
        };
        
        // Add platform-specific classes to body
        document.body.classList.add(`platform-${this.platform}`);
        if (isTouch) document.body.classList.add('touch-device');
        if (this.deviceInfo.isRetina) document.body.classList.add('retina-display');
        if (this.deviceInfo.isHighDPI) document.body.classList.add('high-dpi');
    }
    
    /**
     * Get current orientation
     */
    getOrientation() {
        if (window.screen && window.screen.orientation) {
            return window.screen.orientation.type;
        }
        return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }
    
    /**
     * Setup platform-specific adaptation strategies
     */
    setupAdaptationStrategies() {
        const config = this.platformConfigs[this.platform] || this.platformConfigs.desktop;
        
        // iOS-specific adaptations
        if (this.platform === 'ios') {
            this.adaptationStrategies.set('dialog', this.createIOSDialogStrategy());
            this.adaptationStrategies.set('input', this.createIOSInputStrategy());
            this.adaptationStrategies.set('viewport', this.createIOSViewportStrategy());
        }
        
        // Android-specific adaptations
        else if (this.platform === 'android') {
            this.adaptationStrategies.set('dialog', this.createAndroidDialogStrategy());
            this.adaptationStrategies.set('input', this.createAndroidInputStrategy());
            this.adaptationStrategies.set('viewport', this.createAndroidViewportStrategy());
        }
        
        // Generic mobile adaptations
        if (this.deviceInfo.isTouch) {
            this.adaptationStrategies.set('touch', this.createTouchStrategy());
            this.adaptationStrategies.set('gestures', this.createGestureStrategy());
        }
    }
    
    /**
     * Create iOS-specific dialog strategy
     */
    createIOSDialogStrategy() {
        return {
            apply: (element) => {
                // iOS-specific dialog adaptations
                element.classList.add('ios-dialog');
                
                // Handle safe area insets
                if (this.deviceInfo.safeAreaInsets) {
                    element.style.paddingTop = 'env(safe-area-inset-top)';
                    element.style.paddingBottom = 'env(safe-area-inset-bottom)';
                }
                
                // Prevent zoom on double tap
                element.addEventListener('touchend', (e) => {
                    e.preventDefault();
                }, { passive: false });
            },
            
            getDimensions: () => ({
                maxWidth: 'calc(100vw - 2rem)',
                maxHeight: 'calc(100vh - 2rem)',
                margin: '1rem'
            })
        };
    }
    
    /**
     * Create Android-specific dialog strategy
     */
    createAndroidDialogStrategy() {
        return {
            apply: (element) => {
                // Android-specific dialog adaptations
                element.classList.add('android-dialog');
                
                // Android doesn't need safe area handling
                // But may need different touch handling
            },
            
            getDimensions: () => ({
                maxWidth: 'calc(100vw - 1rem)',
                maxHeight: 'calc(100vh - 1rem)',
                margin: '0.5rem'
            })
        };
    }
    
    /**
     * Create iOS-specific input strategy
     */
    createIOSInputStrategy() {
        return {
            apply: (element) => {
                // Prevent zoom on iOS by setting font-size to 16px
                element.style.fontSize = '16px';
                element.classList.add('ios-input');
            }
        };
    }
    
    /**
     * Create Android-specific input strategy
     */
    createAndroidInputStrategy() {
        return {
            apply: (element) => {
                // Android doesn't need special font-size handling
                element.classList.add('android-input');
            }
        };
    }
    
    /**
     * Create iOS viewport strategy
     */
    createIOSViewportStrategy() {
        return {
            apply: () => {
                // Update viewport meta tag for iOS
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    viewport.content = this.platformConfigs.ios.viewportMeta;
                }
            }
        };
    }
    
    /**
     * Create Android viewport strategy
     */
    createAndroidViewportStrategy() {
        return {
            apply: () => {
                // Update viewport meta tag for Android
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    viewport.content = this.platformConfigs.android.viewportMeta;
                }
            }
        };
    }
    
    /**
     * Create touch strategy
     */
    createTouchStrategy() {
        return {
            apply: (element) => {
                element.classList.add('touch-optimized');
                
                // Ensure minimum touch target size
                const minSize = this.platformConfigs[this.platform]?.touchTargetSize || 44;
                element.style.minHeight = `${minSize}px`;
            }
        };
    }
    
    /**
     * Create gesture strategy
     */
    createGestureStrategy() {
        return {
            apply: (element) => {
                // Prevent default touch behaviors that interfere with app
                element.addEventListener('touchstart', (e) => {
                    if (e.touches.length > 1) {
                        e.preventDefault(); // Prevent pinch zoom
                    }
                }, { passive: false });
                
                element.addEventListener('touchend', (e) => {
                    e.preventDefault(); // Prevent double-tap zoom
                }, { passive: false });
            }
        };
    }
    
    /**
     * Setup event listeners for orientation changes and resize
     */
    setupEventListeners() {
        // Orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        // Window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
        
        // Dialog creation observer
        this.setupDialogObserver();
    }
    
    /**
     * Setup MutationObserver for dialog creation
     */
    setupDialogObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.handleNewElement(node);
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Handle new elements (dialogs, panels, etc.)
     */
    handleNewElement(element) {
        // Check if it's a dialog or panel
        if (this.isDialog(element) || this.isPanel(element)) {
            this.adaptElement(element);
            this.registerDialog(element);
        }
    }
    
    /**
     * Check if element is a dialog
     */
    isDialog(element) {
        const dialogIds = ['universal-dialog-overlay', 'actor-properties-overlay', 'settings-overlay'];
        return dialogIds.includes(element.id) || 
               element.querySelector && dialogIds.some(id => element.querySelector(`#${id}`));
    }
    
    /**
     * Check if element is a panel
     */
    isPanel(element) {
        return element.classList.contains('panel') || 
               element.classList.contains('settings-panel-container') ||
               element.classList.contains('base-context-menu');
    }
    
    /**
     * Adapt element for mobile interface
     */
    adaptElement(element) {
        // Don't adapt hidden elements
        if (element.style.display === 'none' || element.classList.contains('hidden')) {
            return;
        }
        
        // Apply platform-specific strategies
        this.adaptationStrategies.forEach((strategy, key) => {
            if (strategy.apply) {
                strategy.apply(element);
            }
        });
        
        // Apply mobile classes
        element.classList.add('mobile-adapted');
        
        // Emit adaptation event
        this.emit('elementAdapted', { element, platform: this.platform });
        
        Logger.mobile.debug('📱 Element adapted for mobile', {
            element: element.id || element.className,
            platform: this.platform
        });
    }
    
    /**
     * Register dialog for tracking
     */
    registerDialog(element) {
        this.dialogRegistry.add(element);
        
        // Clean up when dialog is removed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === element) {
                        this.dialogRegistry.delete(element);
                        observer.disconnect();
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Apply initial adaptations
     */
    applyInitialAdaptations() {
        // Apply viewport strategy
        const viewportStrategy = this.adaptationStrategies.get('viewport');
        if (viewportStrategy) {
            viewportStrategy.apply();
        }
        
        // Apply to existing dialogs
        const existingDialogs = document.querySelectorAll('[id$="-overlay"], .settings-panel-container, .base-context-menu');
        existingDialogs.forEach(dialog => this.adaptElement(dialog));
    }
    
    /**
     * Handle orientation change
     */
    handleOrientationChange() {
        this.deviceInfo.orientation = this.getOrientation();
        
        // Update body classes
        document.body.classList.remove('orientation-portrait', 'orientation-landscape');
        document.body.classList.add(`orientation-${this.deviceInfo.orientation}`);
        
        // Re-adapt all dialogs
        this.dialogRegistry.forEach(dialog => {
            this.adaptElement(dialog);
        });
        
        this.emit('orientationChanged', this.deviceInfo.orientation);
        
        Logger.mobile.info('📱 Orientation changed', { orientation: this.deviceInfo.orientation });
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        // Update device info
        this.deviceInfo.screenWidth = newWidth;
        this.deviceInfo.screenHeight = newHeight;
        
        // Update mobile classes based on screen size
        document.body.classList.remove('screen-small', 'screen-medium', 'screen-large');
        if (newWidth <= 480) {
            document.body.classList.add('screen-small');
        } else if (newWidth <= 768) {
            document.body.classList.add('screen-medium');
        } else {
            document.body.classList.add('screen-large');
        }
        
        // Re-adapt all dialogs
        this.dialogRegistry.forEach(dialog => {
            this.adaptElement(dialog);
        });
        
        this.emit('resize', { width: newWidth, height: newHeight });
        
        Logger.mobile.debug('📱 Window resized', { width: newWidth, height: newHeight });
    }
    
    /**
     * Get optimal dimensions for dialog
     */
    getDialogDimensions() {
        const dialogStrategy = this.adaptationStrategies.get('dialog');
        if (dialogStrategy && dialogStrategy.getDimensions) {
            return dialogStrategy.getDimensions();
        }
        
        // Default dimensions
        return {
            maxWidth: 'calc(100vw - 1rem)',
            maxHeight: 'calc(100vh - 1rem)',
            margin: '0.5rem'
        };
    }
    
    /**
     * Apply mobile styles to element
     */
    applyMobileStyles(element, type = 'dialog') {
        const dimensions = this.getDialogDimensions();
        
        Object.assign(element.style, {
            maxWidth: dimensions.maxWidth,
            maxHeight: dimensions.maxHeight,
            margin: dimensions.margin,
            width: 'auto',
            minWidth: 'unset'
        });
        
        // Add mobile-adapted class to mark element as mobile-adapted
        element.classList.add('mobile-adapted');
        
        // Apply platform-specific styles
        const inputStrategy = this.adaptationStrategies.get('input');
        if (inputStrategy) {
            const inputs = element.querySelectorAll('input, textarea, select');
            inputs.forEach(input => inputStrategy.apply(input));
        }
    }
    
    /**
     * Event system
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    Logger.mobile.error('Event callback error:', error);
                }
            });
        }
    }
    
    /**
     * Get current platform info
     */
    getPlatformInfo() {
        return {
            platform: this.platform,
            deviceInfo: this.deviceInfo,
            isMobile: this.deviceInfo.isTouch,
            isIOS: this.platform === 'ios',
            isAndroid: this.platform === 'android'
        };
    }
    
    /**
     * Check if current device is mobile
     */
    isMobile() {
        return this.deviceInfo.isTouch;
    }
    
    /**
     * Check if current platform is iOS
     */
    isIOS() {
        return this.platform === 'ios';
    }
    
    /**
     * Check if current platform is Android
     */
    isAndroid() {
        return this.platform === 'android';
    }
    
    /**
     * Destroy the manager
     */
    destroy() {
        this.eventListeners.clear();
        this.dialogRegistry.clear();
        this.adaptationStrategies.clear();
        this.isInitialized = false;
        
        Logger.mobile.info('📱 Mobile Interface Manager destroyed');
    }
}

// Global instance
export const mobileInterfaceManager = new MobileInterfaceManager();
