#!/usr/bin/env python3
"""
Update manifest.json with all JSON files found in content folder
Scans recursively and adds paths to manifest
"""

import os
import json
from datetime import date
from pathlib import Path

CONTENT_DIR = Path('./content')
MANIFEST_PATH = CONTENT_DIR / 'manifest.json'

def find_json_files(directory):
    """Find all JSON files recursively, excluding manifest.json"""
    json_files = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.json') and file != 'manifest.json':
                full_path = Path(root) / file
                # Get relative path from content directory
                rel_path = full_path.relative_to(directory)
                # Convert to forward slashes for consistency
                json_files.append(str(rel_path).replace('\\', '/'))
    
    return sorted(json_files)

def main():
    print('🔍 Scanning content folder for JSON files...\n')
    
    # Check if content directory exists
    if not CONTENT_DIR.exists():
        print(f'❌ Content directory not found: {CONTENT_DIR}')
        return 1
    
    # Find all JSON files
    json_files = find_json_files(CONTENT_DIR)
    print(f'✅ Found {len(json_files)} JSON file(s)\n')
    
    # Load existing manifest
    if MANIFEST_PATH.exists():
        try:
            with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            print('📄 Loaded existing manifest.json')
        except Exception as e:
            print(f'❌ Error reading manifest.json: {e}')
            return 1
    else:
        print('⚠️  Manifest not found, creating new one')
        manifest = {
            'version': '1.0.0',
            'generated': str(date.today()),
            'structure': {
                'assets': {},
                'graphs': {},
                'maps': {}
            },
            'files': []
        }
    
    # Update manifest
    manifest['files'] = json_files
    manifest['generated'] = str(date.today())
    
    # Save manifest
    try:
        with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        print('✅ Manifest updated successfully!\n')
    except Exception as e:
        print(f'❌ Error writing manifest.json: {e}')
        return 1
    
    # Display results
    print('📊 Manifest Summary:')
    print(f'   Version: {manifest["version"]}')
    print(f'   Generated: {manifest["generated"]}')
    print(f'   Files: {len(manifest["files"])}\n')
    
    if manifest['files']:
        print('📁 JSON files in manifest:')
        for file in manifest['files']:
            print(f'   - {file}')
    else:
        print('⚠️  No JSON asset files found in content folder')
        print('   Add JSON files to content subfolders and run this script again')
    
    print('\n✨ Done!')
    return 0

if __name__ == '__main__':
    exit(main())
