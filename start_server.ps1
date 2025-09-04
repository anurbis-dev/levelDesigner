Write-Host "Starting Level Editor Server..." -ForegroundColor Green
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Python found: $pythonVersion" -ForegroundColor Yellow
        Write-Host "Starting HTTP server on port 8000..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Server will be available at: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "Level Editor will open at: http://localhost:8000/index.html" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Red
        Write-Host ""
        
        # Start browser and server
        Start-Process "http://localhost:8000/index.html"
        python -m http.server 8000
    }
} catch {
    Write-Host "Python not found. Checking for Node.js..." -ForegroundColor Yellow
    
    # Check if Node.js is available
    try {
        $nodeVersion = node --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Node.js found: $nodeVersion" -ForegroundColor Yellow
            Write-Host "Installing serve package..." -ForegroundColor Yellow
            npm install -g serve
            Write-Host ""
            Write-Host "Starting HTTP server on port 3000..." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
            Write-Host "Level Editor will open at: http://localhost:3000/index.html" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Red
            Write-Host ""
            
            # Start browser and server
            Start-Process "http://localhost:3000/index.html"
            serve -p 3000
        }
    } catch {
        Write-Host "Neither Python nor Node.js found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install one of the following:" -ForegroundColor Yellow
        Write-Host "1. Python 3.x (recommended)" -ForegroundColor White
        Write-Host "2. Node.js with npm" -ForegroundColor White
        Write-Host ""
        Write-Host "Then run this script again." -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
    }
}
