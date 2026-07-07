@echo off
if "%~1"=="hidden" goto :main

REM --- Relaunch fully hidden via VBScript (WshShell.Run 0=hidden uses ShellExecute SW_HIDE, ---
REM ---  window is created already-hidden - no flash/minimize race like PowerShell -WindowStyle Hidden) ---
set "VBS=%TEMP%\start_editor_launch_%RANDOM%.vbs"
> "%VBS%" echo Set ws = CreateObject("WScript.Shell")
>> "%VBS%" echo ws.Run "cmd /c ""%~f0"" hidden", 0, False
wscript //nologo "%VBS%"
del "%VBS%" >nul 2>&1
exit /b 0

:main
setlocal enabledelayedexpansion
set "PORT=8000"
set "URL=http://localhost:%PORT%/index.html"
set "ROOT=%~dp0"

REM --- Show a native splash window immediately (separate OS window, not the browser page) ---
REM ---  covers the gap between double-click and the browser window appearing (server start etc.) ---
REM ---  Splash design/layout lives in scripts\splash_screen.ps1 - edit that file to change it ---
set "SPLASH_PID_FILE=%TEMP%\haplo_splash_%RANDOM%.pid"
set "SPLASH_STATUS_FILE=%TEMP%\haplo_splash_status_%RANDOM%.txt"
set "SPLASH_IMG=%ROOT%HAPLO_editor_SplashScreen_v3-54.png"
set "SPLASH_SCRIPT=%ROOT%scripts\splash_screen.ps1"
REM --- Splash closes itself once index.html pings this loopback port (LevelEditor fully ---
REM ---  initialized in the browser) - see window.notifySplashReady() in index.html ---
set "SPLASH_READY_PORT=47990"
if exist "%SPLASH_STATUS_FILE%" del "%SPLASH_STATUS_FILE%" >nul 2>&1
call :splashstatus "Starting Level Editor..."
start "" /b powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%SPLASH_SCRIPT%" -ImagePath "%SPLASH_IMG%" -PidFile "%SPLASH_PID_FILE%" -StatusFile "%SPLASH_STATUS_FILE%" -ReadyPort %SPLASH_READY_PORT%

REM --- Compute a 16:9 window sized to 50% of the monitor under the cursor, centered on it ---
set "WIN_W=1280"
set "WIN_H=720"
set "WIN_X=100"
set "WIN_Y=100"
set "PSCMD=Add-Type -AssemblyName System.Windows.Forms; $p=[System.Windows.Forms.Cursor]::Position; $b=[System.Windows.Forms.Screen]::FromPoint($p).Bounds; $w=[int]($b.Width/2); $h=[int]($w*9/16); $x=$b.X+[int](($b.Width-$w)/2); $y=$b.Y+[int](($b.Height-$h)/2); Write-Output ($w.ToString()+','+$h.ToString()+','+$x.ToString()+','+$y.ToString())"
for /f "tokens=1-4 delims=," %%a in ('powershell -NoProfile -Command "%PSCMD%" 2^>nul') do (
    set "WIN_W=%%a"
    set "WIN_H=%%b"
    set "WIN_X=%%c"
    set "WIN_Y=%%d"
)

REM --- Kill any process already listening on the target port ---
call :splashstatus "Checking for a previous server on port %PORT%..."
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    taskkill /F /PID %%p >nul 2>&1
)

REM --- Pick backend: Python preferred, then Node/npx serve ---
python --version >nul 2>&1
if !errorlevel! == 0 (
    call :splashstatus "Starting Python server - python -m http.server %PORT%"
    start "" /b cmd /c "cd /d "%ROOT%" && python -m http.server %PORT%"
) else (
    node --version >nul 2>&1
    if !errorlevel! == 0 (
        call :splashstatus "Starting Node server - npx serve -l %PORT%"
        start "" /b cmd /c "cd /d "%ROOT%" && npx serve -l %PORT% ."
    ) else (
        call :closesplash
        call :showerror "Neither Python nor Node.js found. Install one of them to run the Level Editor server."
        exit /b 1
    )
)

REM --- Wait for the server to bind the port and capture its PID ---
call :splashstatus "Waiting for the server to become ready..."
set "SERVER_PID="
set "TRIES=0"
:waitport
set /a TRIES+=1
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT% " ^| findstr LISTENING') do set "SERVER_PID=%%p"
if defined SERVER_PID goto :portready
if %TRIES% GEQ 20 goto :portready
ping -n 2 127.0.0.1 >nul
goto :waitport
:portready
call :splashstatus "Server ready. Detecting installed browser..."

REM --- Locate a browser. Chromium-based ones support --app (frameless app window); ---
REM ---  browsers without an app-window mode (Firefox) just open a normal window instead. ---
set "BROWSER_EXE="
set "BROWSER_MODE="
set "PROFILE_TAG="

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=chrome")
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=chrome")
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=chrome")

if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=edge")
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=edge")

if not defined BROWSER_EXE if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (set "BROWSER_EXE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=brave")
if not defined BROWSER_EXE if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" (set "BROWSER_EXE=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=brave")

if not defined BROWSER_EXE if exist "%LocalAppData%\Vivaldi\Application\vivaldi.exe" (set "BROWSER_EXE=%LocalAppData%\Vivaldi\Application\vivaldi.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=vivaldi")

if not defined BROWSER_EXE if exist "%LocalAppData%\Programs\Opera\opera.exe" (set "BROWSER_EXE=%LocalAppData%\Programs\Opera\opera.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=opera")
if not defined BROWSER_EXE if exist "%ProgramFiles%\Opera\opera.exe" (set "BROWSER_EXE=%ProgramFiles%\Opera\opera.exe" & set "BROWSER_MODE=app" & set "PROFILE_TAG=opera")

if not defined BROWSER_EXE if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" (set "BROWSER_EXE=%ProgramFiles%\Mozilla Firefox\firefox.exe" & set "BROWSER_MODE=window" & set "PROFILE_TAG=firefox")
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" (set "BROWSER_EXE=%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" & set "BROWSER_MODE=window" & set "PROFILE_TAG=firefox")

if defined BROWSER_EXE (
    REM --- Isolated profile forces a dedicated browser process, so /wait reliably ---
    REM ---  blocks until this specific window is closed, letting us stop the server ---
    set "PROFILE_DIR=%TEMP%\LevelEditorProfile_!PROFILE_TAG!"
    call :splashstatus "Opening !PROFILE_TAG!..."
    if "!BROWSER_MODE!"=="app" (
        start "" /wait "!BROWSER_EXE!" --app=%URL% --user-data-dir="!PROFILE_DIR!" --window-size=!WIN_W!,!WIN_H! --window-position=!WIN_X!,!WIN_Y!
    ) else (
        start "" /wait "!BROWSER_EXE!" -profile "!PROFILE_DIR!" -no-remote -new-instance %URL% -width !WIN_W! -height !WIN_H!
    )
) else (
    REM --- No known browser found by path: fall back to the OS default handler if one is ---
    REM ---  registered. Fire-and-forget (can't reliably /wait an unknown default browser), ---
    REM ---  so leave the server running - the next launch cleans up the old one via the port kill above. ---
    reg query "HKCR\http\shell\open\command" >nul 2>&1
    if !errorlevel! == 0 (
        start "" %URL%
        exit /b 0
    ) else (
        call :closesplash
        call :showerror "No web browser was found on this system. Install Chrome, Edge, Firefox, Brave, Opera or Vivaldi to run the Level Editor."
        if defined SERVER_PID taskkill /F /PID %SERVER_PID% >nul 2>&1
        exit /b 1
    )
)

REM --- Editor window closed: stop the server ---
if defined SERVER_PID taskkill /F /PID %SERVER_PID% >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    taskkill /F /PID %%p >nul 2>&1
)

REM --- Safety net: splash should already have closed itself once index.html pinged it ready; ---
REM ---  if it's somehow still running (page never finished loading, ping missed), force-kill it now ---
call :closesplash
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*%SPLASH_PID_FILE%*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force } " >nul 2>&1

exit /b 0

:splashstatus
>> "%SPLASH_STATUS_FILE%" echo %~1
exit /b 0

:closesplash
if exist "%SPLASH_PID_FILE%" (
    set /p SPLASH_PID=<"%SPLASH_PID_FILE%"
    if defined SPLASH_PID taskkill /F /PID !SPLASH_PID! >nul 2>&1
    del "%SPLASH_PID_FILE%" >nul 2>&1
)
if exist "%SPLASH_STATUS_FILE%" del "%SPLASH_STATUS_FILE%" >nul 2>&1
exit /b 0

:showerror
powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('%~1','Level Editor','OK','Error')"
exit /b 0
