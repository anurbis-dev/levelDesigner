@echo off
REM Batch script to safely get git logs without pager issues
REM Usage: get_git_logs.bat [number_of_commits] [output_file]

REM Change to script directory
cd /d "%~dp0"

set COMMITS=%1
if "%COMMITS%"=="" set COMMITS=10

set OUTPUT_FILE=%2
if "%OUTPUT_FILE%"=="" set OUTPUT_FILE=git_logs.txt

REM Disable pager for git commands
set GIT_PAGER=cat

echo Getting git logs (last %COMMITS% commits)...

REM Get git log and save to file
git log --oneline -n %COMMITS% > %OUTPUT_FILE% 2>&1

if %ERRORLEVEL% equ 0 (
    echo.
    echo Git logs saved to: %OUTPUT_FILE%
    echo.
    echo Contents:
    type %OUTPUT_FILE%
) else (
    echo Error getting git logs
    exit /b 1
)
