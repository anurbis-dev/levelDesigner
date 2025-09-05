@echo off
REM Change to script directory
cd /d "%~dp0"

echo === Level Editor Git Workflow ===
echo.

echo 1. Checking git status...
git status
echo.

echo 2. Getting recent logs...
call get_git_logs.bat 5
echo.

echo 3. Adding all changes...
git add .
echo.

echo 4. Committing changes...
echo    Choose version type:
echo    [1] Patch (X.Y.Z+1) - bug fixes, small changes
echo    [2] Minor (X.Y+1.0) - new features, backward compatible
echo    [3] Major (X+1.0.0) - breaking changes, architecture changes
echo.
set /p version_type="Enter version type (1-3): "

if "%version_type%"=="1" (
    git commit -m "v2.2.1: Patch update - %date% %time%"
) else if "%version_type%"=="2" (
    git commit -m "v2.3.0: Minor update - %date% %time%"
) else if "%version_type%"=="3" (
    git commit -m "v3.0.0: Major update - %date% %time%"
) else (
    echo Invalid choice, using patch version...
    git commit -m "v2.2.1: Patch update - %date% %time%"
)
echo.

echo 5. Pushing to repository...
git push origin master
echo.

echo === Workflow completed ===
pause
