/**
 * Mobile Scaling Utilities
 * Handles device-specific scaling and DPI adjustments for mobile devices
 */

export class MobileScalingUtils {
    /**
     * Initialize mobile scaling based on device characteristics
     */
    static initializeScaling() {
        const isMobile = this.isMobileDevice();
        const devicePixelRatio = window.devicePixelRatio || 1;
        const screenWidth = window.innerWidth;
        
        // Calculate optimal scale factor
        let scaleFactor = 1.0;
        
        if (isMobile) {
            // Base mobile scaling
            scaleFactor = 0.8;
            
            // Adjust for high DPI
            if (devicePixelRatio >= 3) {
                scaleFactor = 0.7; // Very high DPI (iPhone Retina, etc.)
            } else if (devicePixelRatio >= 2) {
                scaleFactor = 0.75; // High DPI
            }
            
            // Adjust for small screens
            if (screenWidth < 480) {
                scaleFactor *= 0.9; // Extra small screens
            }
        } else if (devicePixelRatio >= 2) {
            // Desktop high DPI scaling
            scaleFactor = 0.9;
        }
        
        // Apply scaling
        this.applyScaling(scaleFactor);
        
        // Store scaling info for debugging
        window.mobileScalingInfo = {
            isMobile,
            devicePixelRatio,
            screenWidth,
            scaleFactor,
            userAgent: navigator.userAgent
        };
        
        console.log('📱 Mobile scaling applied:', window.mobileScalingInfo);
    }
    
    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile device
     */
    static isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768 && 'ontouchstart' in window);
    }
    
    /**
     * Apply scaling to CSS variables
     * @param {number} scaleFactor - Scale factor to apply
     */
    static applyScaling(scaleFactor) {
        const root = document.documentElement;
        
        // Update CSS variables
        root.style.setProperty('--font-scale', scaleFactor);
        root.style.setProperty('--spacing-scale', scaleFactor);
        
        // Update base font size
        const baseFontSize = 16;
        const scaledFontSize = baseFontSize * scaleFactor;
        root.style.fontSize = `${scaledFontSize}px`;
        
        // Add mobile class for additional styling
        if (this.isMobileDevice()) {
            document.body.classList.add('mobile-device');
        }
        
        // Add DPI class for high DPI devices
        if (window.devicePixelRatio >= 2) {
            document.body.classList.add('high-dpi');
        }
        
        if (window.devicePixelRatio >= 3) {
            document.body.classList.add('very-high-dpi');
        }
    }
    
    /**
     * Get optimal touch target size for current device
     * @returns {number} Recommended touch target size in pixels
     */
    static getOptimalTouchSize() {
        if (this.isMobileDevice()) {
            const devicePixelRatio = window.devicePixelRatio || 1;
            if (devicePixelRatio >= 3) {
                return 56; // Larger for very high DPI
            } else if (devicePixelRatio >= 2) {
                return 48; // Standard for high DPI
            }
            return 44; // Standard minimum
        }
        return 44; // Desktop
    }
    
    /**
     * Check if device supports touch
     * @returns {boolean} True if touch supported
     */
    static isTouchSupported() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    /**
     * Get device information for debugging
     * @returns {Object} Device information
     */
    static getDeviceInfo() {
        return {
            isMobile: this.isMobileDevice(),
            isTouch: this.isTouchSupported(),
            devicePixelRatio: window.devicePixelRatio || 1,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            userAgent: navigator.userAgent,
            platform: navigator.platform
        };
    }
    
    /**
     * Handle orientation change for mobile devices
     */
    static handleOrientationChange() {
        // Re-initialize scaling on orientation change
        setTimeout(() => {
            this.initializeScaling();
        }, 100);
    }
    
    /**
     * Setup mobile-specific event listeners
     */
    static setupMobileListeners() {
        if (this.isMobileDevice()) {
            // Handle orientation changes
            window.addEventListener('orientationchange', () => {
                this.handleOrientationChange();
            });
            
            // Handle resize events
            window.addEventListener('resize', () => {
                this.handleOrientationChange();
            });
            
            // Prevent zoom on double tap
            let lastTouchEnd = 0;
            document.addEventListener('touchend', (e) => {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        }
    }
}
