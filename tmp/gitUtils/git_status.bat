@echo off
REM Change to script directory
cd /d "%~dp0"

echo === Git Status Check ===
echo.

echo Current branch:
git branch --show-current
echo.

echo Status:
git status --short
echo.

echo Recent commits:
call get_git_logs.bat 3
echo.

echo === Status check completed ===
pause
