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

def find_all_directories(directory):
    """Find all directories recursively, including empty ones"""
    directories = set()
    
    for root, dirs, files in os.walk(directory):
        for dir_name in dirs:
            full_path = Path(root) / dir_name
            # Get relative path from content directory
            rel_path = full_path.relative_to(directory)
            # Convert to forward slashes for consistency
            directories.add(str(rel_path).replace('\\', '/'))
    
    return sorted(directories)

def build_folder_structure(json_files, all_directories):
    """Build folder structure from JSON file paths and all directories"""
    structure = {}
    
    # First, add all directories (including empty ones)
    for dir_path in all_directories:
        parts = dir_path.split('/')
        
        if len(parts) >= 1:
            category = parts[0]  # assets, graphs, maps
            if category in structure:
                current = structure[category]
                
                # Navigate/create folder structure
                # For first-level folders (like 'assets'), parts[1:] will be empty, so no subfolders
                for part in parts[1:]:  # Skip category
                    if part not in current:
                        current[part] = {}
                    current = current[part]
            else:
                # Handle unknown categories - add them to structure
                if category not in structure:
                    structure[category] = {}
                current = structure[category]
                
                # Navigate/create folder structure
                for part in parts[1:]:  # Skip category
                    if part not in current:
                        current[part] = {}
                    current = current[part]
    
    # Then, add folders from JSON files (in case some folders only have JSON files)
    for file_path in json_files:
        parts = file_path.split('/')
        
        if len(parts) >= 2:
            category = parts[0]  # assets, graphs, maps
            if category not in structure:
                structure[category] = {}
            current = structure[category]
            
            # Navigate/create folder structure
            for part in parts[1:-1]:  # Skip category and filename
                if part not in current:
                    current[part] = {}
                current = current[part]
    
    return structure

def main():
    print('Scanning content folder for JSON files...\n')
    
    # Check if content directory exists
    if not CONTENT_DIR.exists():
        print(f'ERROR: Content directory not found: {CONTENT_DIR}')
        return 1
    
    # Find JSON files and all directories
    json_files = find_json_files(CONTENT_DIR)
    all_directories = find_all_directories(CONTENT_DIR)
    
    print(f'Found {len(all_directories)} directories (including empty ones)')
    print(f'Found {len(json_files)} JSON file(s)')
    
    # Debug: show all directories found
    if all_directories:
        print('\nDirectories found:')
        for dir_path in all_directories:
            print(f'   - {dir_path}')
    print()
    
    # Load existing manifest
    if MANIFEST_PATH.exists():
        try:
            with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            print('Loaded existing manifest.json')
        except Exception as e:
            print(f'ERROR: Error reading manifest.json: {e}')
            return 1
    else:
        print('WARNING: Manifest not found, creating new one')
        manifest = {
            'version': '1.0.0',
            'generated': str(date.today()),
            'structure': {},
            'files': []
        }
    
    # Update manifest
    manifest['files'] = json_files
    manifest['generated'] = str(date.today())
    
    # Build and update folder structure
    print('Building folder structure from directories and file paths...')
    manifest['structure'] = build_folder_structure(json_files, all_directories)
    
    # Save manifest
    try:
        with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        print('SUCCESS: Manifest updated successfully!\n')
    except Exception as e:
        print(f'ERROR: Error writing manifest.json: {e}')
        return 1
    
    # Display results
    print('Manifest Summary:')
    print(f'   Version: {manifest["version"]}')
    print(f'   Generated: {manifest["generated"]}')
    print(f'   Files: {len(manifest["files"])}\n')
    
    if manifest['files']:
        print('JSON files in manifest:')
        for file in manifest['files']:
            print(f'   - {file}')
        
        print('\nFolder structure:')
        def print_structure(structure, indent=0):
            for key, value in structure.items():
                print('   ' * indent + f'[FOLDER] {key}/')
                if isinstance(value, dict) and value:
                    print_structure(value, indent + 1)
        
        print_structure(manifest['structure'])
    else:
        print('WARNING: No JSON asset files found in content folder')
        print('   Add JSON files to content subfolders and run this script again')
    
    print('\nDone!')
    return 0

if __name__ == '__main__':
    exit(main())
