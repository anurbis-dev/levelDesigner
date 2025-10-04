/**
 * Performance Optimization Utilities
 * Provides throttle, debounce, and memoization helpers
 * @version 3.37.0
 */

/**
 * Throttle function execution to a maximum rate
 * Ensures function is called at most once per delay period
 * 
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Minimum delay between calls in milliseconds
 * @returns {Function} Throttled function
 * 
 * @example
 * const throttledMove = throttle((e) => handleMove(e), 16); // ~60fps
 * canvas.addEventListener('mousemove', throttledMove);
 */
export function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId = null;
    
    return function throttled(...args) {
        const now = performance.now();
        const timeSinceLastCall = now - lastCall;
        
        // If enough time has passed, call immediately
        if (timeSinceLastCall >= delay) {
            lastCall = now;
            return fn.apply(this, args);
        }
        
        // Otherwise, schedule a call for when delay expires
        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastCall = performance.now();
                timeoutId = null;
                fn.apply(this, args);
            }, delay - timeSinceLastCall);
        }
    };
}

/**
 * Debounce function execution until after delay has elapsed since last call
 * Useful for expensive operations that should only run after user stops interacting
 * 
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds to wait
 * @returns {Function} Debounced function with cancel method
 * 
 * @example
 * const debouncedSearch = debounce((query) => search(query), 300);
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 * // Cancel if needed: debouncedSearch.cancel();
 */
export function debounce(fn, delay) {
    let timeoutId = null;
    
    const debounced = function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
    
    // Allow cancelling pending call
    debounced.cancel = function() {
        clearTimeout(timeoutId);
    };
    
    return debounced;
}

/**
 * Simple memoization for pure functions
 * Caches results based on stringified arguments
 * 
 * @param {Function} fn - Pure function to memoize
 * @param {Function} [keyFn] - Optional key generator function
 * @returns {Function} Memoized function with cache clearing
 * 
 * @example
 * const memoizedCalculation = memoize((x, y) => expensiveCalc(x, y));
 * const result1 = memoizedCalculation(5, 10); // Calculates
 * const result2 = memoizedCalculation(5, 10); // From cache
 */
export function memoize(fn, keyFn = null) {
    const cache = new Map();
    
    const memoized = function(...args) {
        const key = keyFn ? keyFn(...args) : JSON.stringify(args);
        
        if (cache.has(key)) {
            return cache.get(key);
        }
        
        const result = fn.apply(this, args);
        cache.set(key, result);
        
        return result;
    };
    
    // Allow manual cache clearing
    memoized.clearCache = function() {
        cache.clear();
    };
    
    memoized.cache = cache; // Expose for inspection
    
    return memoized;
}

/**
 * Memoization with automatic cache invalidation
 * Cache is cleared when dependencies change
 * 
 * @param {Function} fn - Function to memoize
 * @param {Function} keyFn - Key generator function
 * @param {Function} getDeps - Function returning dependency array
 * @returns {Function} Memoized function with dependency tracking
 * 
 * @example
 * const memoizedBounds = memoizeWithInvalidation(
 *     (obj) => calculateBounds(obj),
 *     (obj) => obj.id,
 *     () => [level.version, camera.zoom] // Invalidate on these changes
 * );
 */
export function memoizeWithInvalidation(fn, keyFn, getDeps) {
    const cache = new Map();
    let lastDeps = null;
    
    const memoized = function(...args) {
        // Check if dependencies changed
        const currentDeps = getDeps();
        if (lastDeps !== null && !areArraysEqual(lastDeps, currentDeps)) {
            cache.clear();
        }
        lastDeps = currentDeps;
        
        // Standard memoization
        const key = keyFn(...args);
        
        if (cache.has(key)) {
            return cache.get(key);
        }
        
        const result = fn.apply(this, args);
        cache.set(key, result);
        
        return result;
    };
    
    memoized.clearCache = function() {
        cache.clear();
        lastDeps = null;
    };
    
    return memoized;
}

/**
 * Request Animation Frame wrapper for batching updates
 * Ensures function is called once per frame
 * 
 * @param {Function} fn - Function to batch
 * @returns {Function} Batched function with cancel method
 * 
 * @example
 * const batchedRender = batchRAF(() => render());
 * stateManager.subscribe('objects', batchedRender);
 * // Multiple state changes trigger only one render per frame
 */
export function batchRAF(fn) {
    let rafId = null;
    let pendingArgs = null;
    
    const batched = function(...args) {
        pendingArgs = args;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                rafId = null;
                fn.apply(this, pendingArgs);
                pendingArgs = null;
            });
        }
    };
    
    batched.cancel = function() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
            pendingArgs = null;
        }
    };
    
    return batched;
}

/**
 * LRU (Least Recently Used) Cache implementation
 * Automatically evicts oldest entries when size limit is reached
 * 
 * @class LRUCache
 * 
 * @example
 * const cache = new LRUCache(100); // Max 100 entries
 * cache.set('key1', value1);
 * const value = cache.get('key1');
 * cache.has('key1'); // true
 */
export class LRUCache {
    /**
     * @param {number} maxSize - Maximum number of entries
     */
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }
    
    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined
     */
    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }
        
        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        
        return value;
    }
    
    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(key, value) {
        // Remove if exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        
        // Add to end
        this.cache.set(key, value);
        
        // Evict oldest if over size
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
    
    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }
    
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }
    
    /**
     * Get current cache size
     * @returns {number}
     */
    get size() {
        return this.cache.size;
    }
}

/**
 * Helper: Compare two arrays for equality
 * @private
 */
function areArraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}
