#!/usr/bin/env node

/**
 * Update manifest.json with all JSON files found in content folder
 * Scans recursively and adds paths to manifest
 */

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = './content';
const MANIFEST_PATH = path.join(CONTENT_DIR, 'manifest.json');

/**
 * Recursively find all JSON files in directory
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Array<string>} Array of relative file paths
 */
function findJsonFiles(dir, baseDir = dir) {
    const files = [];
    
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // Recursively search subdirectories
                files.push(...findJsonFiles(fullPath, baseDir));
            } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'manifest.json') {
                // Add JSON file (except manifest.json itself)
                const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                files.push(relativePath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error.message);
    }
    
    return files;
}

/**
 * Main function
 */
function main() {
    console.log('🔍 Scanning content folder for JSON files...\n');
    
    // Check if content directory exists
    if (!fs.existsSync(CONTENT_DIR)) {
        console.error('❌ Content directory not found:', CONTENT_DIR);
        process.exit(1);
    }
    
    // Find all JSON files
    const jsonFiles = findJsonFiles(CONTENT_DIR);
    console.log(`✅ Found ${jsonFiles.length} JSON file(s)\n`);
    
    // Load existing manifest
    let manifest;
    if (fs.existsSync(MANIFEST_PATH)) {
        try {
            const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
            manifest = JSON.parse(manifestContent);
            console.log('📄 Loaded existing manifest.json');
        } catch (error) {
            console.error('❌ Error reading manifest.json:', error.message);
            process.exit(1);
        }
    } else {
        console.log('⚠️  Manifest not found, creating new one');
        manifest = {
            version: '1.0.0',
            generated: new Date().toISOString().split('T')[0],
            structure: {
                assets: {},
                graphs: {},
                maps: {}
            },
            files: []
        };
    }
    
    // Update manifest
    manifest.files = jsonFiles;
    manifest.generated = new Date().toISOString().split('T')[0];
    
    // Save manifest
    try {
        const manifestJson = JSON.stringify(manifest, null, 2);
        fs.writeFileSync(MANIFEST_PATH, manifestJson, 'utf8');
        console.log('✅ Manifest updated successfully!\n');
    } catch (error) {
        console.error('❌ Error writing manifest.json:', error.message);
        process.exit(1);
    }
    
    // Display results
    console.log('📊 Manifest Summary:');
    console.log(`   Version: ${manifest.version}`);
    console.log(`   Generated: ${manifest.generated}`);
    console.log(`   Files: ${manifest.files.length}\n`);
    
    if (manifest.files.length > 0) {
        console.log('📁 JSON files in manifest:');
        manifest.files.forEach(file => {
            console.log(`   - ${file}`);
        });
    } else {
        console.log('⚠️  No JSON asset files found in content folder');
        console.log('   Add JSON files to content subfolders and run this script again');
    }
    
    console.log('\n✨ Done!');
}

// Run main function
try {
    main();
} catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
}
