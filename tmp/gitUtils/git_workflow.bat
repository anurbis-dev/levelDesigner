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
git commit -m "v2.2.0: Automated commit - %date% %time%"
echo.

echo 5. Pushing to repository...
git push origin master
echo.

echo === Workflow completed ===
pause
