# Content Folder Structure

This folder contains all game assets organized in a hierarchical structure.

## Folder Structure

```
content/
├── assets/          # Game assets (sprites, tiles, etc.)
│   ├── backgrounds/
│   ├── characters/
│   ├── collectibles/
│   ├── effects/
│   ├── flora/
│   ├── platforms/
│   └── TEST/        # Test assets
├── graphs/          # Behavior graphs
├── maps/            # Level maps
└── manifest.json    # Asset manifest file
```

## Adding New Assets

### 1. Create Asset Files

Place your asset files (JSON + PNG) in the appropriate subfolder:

```
content/assets/TEST/
├── my_asset.json
└── my_asset.png
```

### 2. Asset JSON Format

Create a JSON file with the following structure:

```json
{
  "name": "My Asset",
  "type": "object",
  "imgSrc": "my_asset.png",
  "color": "#CCCCCC",
  "width": 32,
  "height": 32,
  "properties": {
    "created": "2025-10-08T12:00:00.000Z",
    "isTemporary": false
  },
  "tags": ["custom", "test"]
}
```

**Important Notes:**
- **ID auto-generated**: If no `id` field, ID is generated from FULL PATH to ensure uniqueness
  - Example: `assets/TEST/hero.json` → `asset_assets_TEST_hero`
  - Example: `assets/platforms/hero.json` → `asset_assets_platforms_hero`
  - Same filename in different folders = different IDs ✓
- **Single image only**: `imgSrc` should be a string (not array). If array is provided, only first image is used.
- **Category auto-detected**: Category is determined by parent folder name
  - `assets/TEST/file.json` → category "TEST"
  - `graphs/file.json` → category "graphs"
  - `maps/level1/file.json` → category "level1"
- **Assets can be in ANY folders**: Not limited to predefined structure
- **Alternative formats**: `image` field is also supported as alternative to `imgSrc`.
- **Image path**: Relative to JSON file location (e.g., `my_asset.png` in same folder)
- **Cache busting**: Files are loaded with cache busting to ensure fresh data on restart.

### 3. Update manifest.json

Add the path to your JSON file in the `files` array:

```json
{
  "version": "1.0.0",
  "generated": "2025-10-08",
  "structure": { ... },
  "files": [
    "assets/TEST/my_asset.json"
  ]
}
```

### 4. Reload Editor

Restart the level editor to load the new assets.

## Asset Properties

- **name**: Display name of the asset
- **type**: Asset type (object, tile, character, etc.)
- **category**: Category (overridden by folder structure)
- **imgSrc**: Image file path (can be array or string)
- **image**: Alternative image field
- **color**: Fallback color if image not loaded
- **width/height**: Asset dimensions in pixels
- **properties**: Custom properties object

## Tabs

**Simple Logic**: Tabs are created ONLY for categories that have at least one loaded asset.
- Category is determined by the parent folder name of the asset file
- Example: File in `assets/TEST/` creates a "TEST" tab
- No assets = no tabs

## Automatic Loading

When the editor starts:
1. Loads `manifest.json` (with cache busting)
2. Reads all files listed in `files` array
3. Creates tabs for categories with assets
4. Updates Content panel with folder structure

**Important**: Always update `manifest.json` when adding new asset files!

## Current Assets

Files in TEST folder:
- FG_flora_02.json
- map_miningFacility_LVL01_prototype_v01.json
