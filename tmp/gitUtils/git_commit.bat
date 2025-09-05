@echo off
REM Change to script directory
cd /d "%~dp0"

echo === Quick Git Commit ===
echo.

echo Current changes:
git status --short
echo.

set /p commit_message="Enter commit message: "
if "%commit_message%"=="" set commit_message="Quick commit - %date% %time%"

echo.
echo Adding all changes...
git add .

echo Committing with message: %commit_message%
git commit -m "%commit_message%"

echo.
echo Pushing to repository...
git push origin master

echo.
echo === Commit completed ===
pause
