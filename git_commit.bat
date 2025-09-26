@echo off
echo Git operations for Level Editor v3.19.1
echo =====================================

echo.
echo Adding all changes...
git add -A

echo.
echo Committing changes...
git commit -m "feat: v3.19.1 GridRenderer refactoring and documentation update

- Refactored grid rendering system with modular architecture
- Removed duplicate code and intermediate GridRenderer layer
- Added BaseGridRenderer with common grid rendering utilities
- Implemented specialized renderers: Rectangular, Isometric, Hexagonal
- Fixed grid positioning and camera integration
- Updated comprehensive documentation and API references
- Improved code organization and maintainability"

echo.
echo Pushing to remote repository...
git push origin master

echo.
echo Git operations completed!
pause
