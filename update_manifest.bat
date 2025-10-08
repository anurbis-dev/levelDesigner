@echo off
chcp 65001 >nul
echo ========================================
echo   Update manifest.json
echo ========================================
echo.

:: Try Python first
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Using Python to update manifest...
    python update_manifest.py
    if %errorlevel% equ 0 goto :success
)

:: Try Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Using Node.js to update manifest...
    node update_manifest.js
    if %errorlevel% equ 0 goto :success
)

:: Manual fallback
echo.
echo ⚠️  Automatic update not available
echo.
echo 📋 Manual Instructions:
echo.
echo 1. List JSON files in content folder:
echo.
dir /s /b content\*.json | findstr /v "manifest.json"
echo.
echo 2. Open content\manifest.json in text editor
echo.
echo 3. Update the "files" array with paths like:
echo    "assets/TEST/FG_flora_02.json"
echo    (use forward slashes /)
echo.
echo 4. Save and restart the editor
echo.
goto :end

:success
echo.
echo ✅ Manifest updated successfully!
echo.
echo 📄 Check content\manifest.json to verify
echo 🔄 Restart the level editor to load new assets
echo.

:end
pause