/**
 * Color conversion utilities
 */
export class ColorUtils {
    /**
     * Convert hex color to rgba format
     * @param {string} hex - Hex color string (e.g., "#ffffff" or "ffffff")
     * @param {number} alpha - Alpha value (0-1), defaults to 1
     * @returns {string} RGBA color string (e.g., "rgba(255, 255, 255, 1)")
     */
    static hexToRgba(hex, alpha = 1) {
        if (!hex) return 'rgba(0, 0, 0, 1)';
        
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Handle 3-character hex
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        
        // Parse hex values
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Convert rgba color to hex format
     * @param {string} rgba - RGBA color string (e.g., "rgba(255, 255, 255, 1)")
     * @returns {string} Hex color string (e.g., "#ffffff")
     */
    static rgbaToHex(rgba) {
        if (!rgba) return '#000000';
        
        // Extract RGB values from rgba string
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return '#000000';
        
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        
        // Convert to hex
        const toHex = (n) => {
            const hex = n.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    /**
     * Convert any color format to rgba
     * @param {string} color - Color in any format (hex, rgb, rgba)
     * @param {number} alpha - Alpha value (0-1), defaults to 1
     * @returns {string} RGBA color string
     */
    static toRgba(color, alpha = 1) {
        if (!color) return 'rgba(0, 0, 0, 1)';
        
        // If already rgba, return as is
        if (color.startsWith('rgba(')) {
            return color;
        }
        
        // If rgb, convert to rgba
        if (color.startsWith('rgb(')) {
            return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
        }
        
        // If hex, convert to rgba
        if (color.startsWith('#') || /^[0-9A-Fa-f]{6}$/.test(color)) {
            return this.hexToRgba(color, alpha);
        }
        
        return 'rgba(0, 0, 0, 1)';
    }

    /**
     * Convert any color format to hex
     * @param {string} color - Color in any format (hex, rgb, rgba)
     * @returns {string} Hex color string
     */
    static toHex(color) {
        if (!color) return '#000000';
        
        // If already hex, return as is
        if (color.startsWith('#')) {
            return color;
        }
        
        // If it's a 6-character hex without #, add #
        if (/^[0-9A-Fa-f]{6}$/.test(color)) {
            return '#' + color;
        }
        
        // If rgba or rgb, convert to hex
        if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
            return this.rgbaToHex(color);
        }
        
        return '#000000';
    }
}
