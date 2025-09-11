@echo off
echo Starting Level Editor Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python found. Starting HTTP server on port 8000...
    echo.
    echo Server will be available at: http://localhost:8000
    echo Level Editor will open at: http://localhost:8000/index.html
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    
    REM Start server in background and open browser
    timeout /t 2 /nobreak >nul
    start http://localhost:8000/index.html
    python -m http.server 8000
) else (
    echo Python not found. Checking for Node.js...
    
    REM Check if Node.js is available
    node --version >nul 2>&1
    if %errorlevel% == 0 (
        echo Node.js found. Installing serve package...
        npm install -g serve
        echo.
        echo Starting HTTP server on port 3000...
        echo.
        echo Server will be available at: http://localhost:3000
        echo Level Editor will open at: http://localhost:3000/index.html
        echo.
        echo Press Ctrl+C to stop the server
        echo.
        
        REM Start server in background and open browser
        timeout /t 2 /nobreak >nul
        start http://localhost:3000/index.html
        serve -p 3000
    ) else (
        echo Neither Python nor Node.js found!
        echo.
        echo Please install one of the following:
        echo 1. Python 3.x (recommended)
        echo 2. Node.js with npm
        echo.
        echo Then run this script again.
        echo.
        pause
    )
)
