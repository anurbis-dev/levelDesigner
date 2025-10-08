# How to Update Asset Library

## Quick Start

When you add new JSON asset files to the `content/` folder, you need to update the manifest.

### Automatic Update (Easiest)

Double-click `update_manifest.bat` or run:

```bash
# Windows
update_manifest.bat

# Or use Python
python update_manifest.py

# Or use Node.js
node update_manifest.js
```

The script will:
1. ✅ Scan `content/` folder recursively
2. ✅ Find all JSON files (except manifest.json)
3. ✅ Update `content/manifest.json` automatically
4. ✅ Show summary of found files

### Manual Update

If scripts are blocked by antivirus:

1. Find your JSON files:
   ```
   content/assets/TEST/FG_flora_02.json
   content/assets/TEST/map_miningFacility_LVL01_prototype_v01.json
   ```

2. Open `content/manifest.json`

3. Add file paths to `files` array:
   ```json
   "files": [
     "assets/TEST/FG_flora_02.json",
     "assets/TEST/map_miningFacility_LVL01_prototype_v01.json"
   ]
   ```

4. Save and restart editor

## Important Notes

- **Use forward slashes** `/` in paths (not backslashes `\`)
- Paths are relative to `content/` folder
- Don't include `content/` in the path
- Restart editor after updating manifest

## Example Workflow

1. Add asset files:
   ```
   content/assets/characters/player/hero.json
   content/assets/characters/player/hero.png
   ```

2. Run update script:
   ```
   update_manifest.bat
   ```

3. Restart level editor

4. Assets appear in "player" category tab

## Troubleshooting

**Script doesn't work?**
- Antivirus might be blocking it
- Use manual method instead
- Check if Python or Node.js is installed

**Assets not loading?**
- Check console (F12) for errors
- Verify JSON format is correct
- Ensure image files exist
- Try hard refresh (Ctrl+F5)

**No tabs appearing?**
- Tabs only appear if assets load successfully
- Check manifest.json has correct paths
- Verify JSON files are valid

## More Info

See `content/README.md` for detailed asset format documentation.
