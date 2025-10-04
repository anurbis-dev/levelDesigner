# Styles Directory

This directory contains all CSS styles for the Level Editor, organized by functionality.

## File Structure

### Main Styles
- **`main.css`** - Core application styles including layout, canvas, panels, and console
- **`compact-mode.css`** - Compact mode styles for reduced UI spacing and font sizes

### Context Menu Styles
- **`base-context-menu.css`** - Base styles for all context menus
- **`canvas-context-menu.css`** - Specific styles for canvas context menu
- **`console-context-menu.css`** - Specific styles for console context menu

### User Settings
- **`user-settings.css`** - Dynamic user-customizable styles

### Panel Styles
- **`panels.css`** - Main panel styles
- **`layers-panel.css`** - Layers panel styles
- **`settings-panel.css`** - Settings panel styles
- **`grid-settings.css`** - Grid settings styles
- **`details-panel.css`** - Details panel styles
- **`color-chooser.css`** - Color chooser widget styles

## Usage

All styles are automatically loaded in `index.html`:

```html
<link rel="stylesheet" href="styles/main.css">
<link rel="stylesheet" href="styles/compact-mode.css">
<link rel="stylesheet" href="styles/base-context-menu.css">
<link rel="stylesheet" href="styles/canvas-context-menu.css">
<link rel="stylesheet" href="styles/console-context-menu.css">
<link rel="stylesheet" href="styles/user-settings.css">
```

## Organization Principles

1. **Separation of Concerns** - Each file handles specific UI components
2. **Modularity** - Styles can be loaded independently if needed
3. **Maintainability** - Easy to find and modify specific styles
4. **Performance** - Browser can cache individual CSS files

## Migration Notes

- Moved from inline styles in `index.html` to external files
- Moved from `src/ui/` directory to dedicated `styles/` directory
- Renamed files to use kebab-case for consistency
- No JavaScript imports needed - all styles loaded via HTML
