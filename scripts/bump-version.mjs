#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const LEVEL_EDITOR_PATH = path.join(__dirname, '..', 'src', 'core', 'LevelEditor.js');

const level = process.argv[2];
if (!['patch', 'minor', 'major'].includes(level)) {
    console.error('Usage: node scripts/bump-version.mjs <patch|minor|major>');
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
let [major, minor, patch] = pkg.version.split('.').map(Number);

if (level === 'major') {
    major += 1; minor = 0; patch = 0;
} else if (level === 'minor') {
    minor += 1; patch = 0;
} else {
    patch += 1;
}

const nextVersion = `${major}.${minor}.${patch}`;
const previousVersion = pkg.version;
pkg.version = nextVersion;

fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');

let editorSrc = fs.readFileSync(LEVEL_EDITOR_PATH, 'utf8');
editorSrc = editorSrc.replace(
    /static\s+VERSION\s*=\s*['"][^'"]+['"]/,
    `static VERSION = '${nextVersion}'`
);
fs.writeFileSync(LEVEL_EDITOR_PATH, editorSrc);

console.log(`Version bumped: ${previousVersion} -> ${nextVersion} (${level})`);
