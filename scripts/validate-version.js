#!/usr/bin/env node

/**
 * Validate version synchronization between LevelEditor.js and package.json
 * Ensures version consistency before commits
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEVEL_EDITOR_PATH = path.join(__dirname, '..', 'src', 'core', 'LevelEditor.js');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

function extractVersionFromFile(filePath, pattern) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(pattern);
        return match ? match[1] : null;
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return null;
    }
}

function main() {
    console.log('🔍 Validating version synchronization...\n');

    // Extract version from LevelEditor.js
    const levelEditorVersion = extractVersionFromFile(
        LEVEL_EDITOR_PATH,
        /static\s+VERSION\s*=\s*['"]([^'"]+)['"]/
    );

    // Extract version from package.json
    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    } catch (error) {
        console.error(`Error reading ${PACKAGE_JSON_PATH}:`, error.message);
        process.exit(1);
    }
    const packageVersion = packageJson.version;

    console.log(`📄 LevelEditor.js:  ${levelEditorVersion || 'NOT FOUND'}`);
    console.log(`📦 package.json:    ${packageVersion}\n`);

    if (!levelEditorVersion) {
        console.error('❌ Error: Could not find VERSION in LevelEditor.js');
        process.exit(1);
    }

    if (levelEditorVersion !== packageVersion) {
        console.error('❌ Version mismatch detected!');
        console.error(`   LevelEditor.js: ${levelEditorVersion}`);
        console.error(`   package.json:   ${packageVersion}\n`);
        console.error('⚠️  Please synchronize versions before committing.');
        console.error(`   Update package.json to: "${levelEditorVersion}"`);
        process.exit(1);
    }

    console.log('✅ Versions are synchronized!');
    process.exit(0);
}

main();

