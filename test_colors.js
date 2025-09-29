// Test color conversion cycle
function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbaToHex(rgba) {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return '#000000';
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const fs = require('fs');
const canvasJson = JSON.parse(fs.readFileSync('./config/defaults/canvas.json', 'utf8'));

console.log('=== Color Conversion Test ===');
console.log('Original canvas.json colors:');
console.log('  gridColor:', canvasJson.gridColor);
console.log('  gridSubdivColor:', canvasJson.gridSubdivColor);

// Simulate UI conversion
const uiGridColor = rgbaToHex(canvasJson.gridColor);
const uiGridSubdivColor = canvasJson.gridSubdivColor.startsWith('#') ? canvasJson.gridSubdivColor : '#' + canvasJson.gridSubdivColor;
console.log('\nUI display colors (hex):');
console.log('  gridColor:', uiGridColor);
console.log('  gridSubdivColor:', uiGridSubdivColor);

// Simulate user changing color
const userGridColor = '#ff0000';
const userGridSubdivColor = '#00ff00';
console.log('\nUser changed colors to:');
console.log('  gridColor:', userGridColor);
console.log('  gridSubdivColor:', userGridSubdivColor);

// Simulate StateManager conversion
const opacity = canvasJson.gridOpacity || 0.1;
const stateGridColor = hexToRgba(userGridColor, opacity);
const stateGridSubdivColor = hexToRgba(userGridSubdivColor, opacity);
console.log('\nStateManager colors (rgba):');
console.log('  gridColor:', stateGridColor);
console.log('  gridSubdivColor:', stateGridSubdivColor);

// Simulate config save
const savedGridColor = rgbaToHex(stateGridColor);
const savedGridSubdivColor = rgbaToHex(stateGridSubdivColor);
console.log('\nSaved to config (hex):');
console.log('  gridColor:', savedGridColor);
console.log('  gridSubdivColor:', savedGridSubdivColor);

// Test round-trip
const roundTrip1 = hexToRgba(savedGridColor, opacity);
const roundTrip2 = hexToRgba(savedGridSubdivColor, opacity);
console.log('\nRound-trip test:');
console.log('  Match StateManager:', roundTrip1 === stateGridColor && roundTrip2 === stateGridSubdivColor);
