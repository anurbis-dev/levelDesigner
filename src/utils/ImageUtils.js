export class ImageUtils {
    /**
     * Get image dimensions from a data URL
     * @param {string} dataUrl - Image data URL
     * @returns {Promise<{width: number, height: number}>} Image dimensions
     */
    static getImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
        });
    }
}
