@echo off
setlocal EnableExtensions
title NEXUS AI - Local Server

REM Always run from the folder that contains this batch file.
cd /d "%~dp0"
if errorlevel 1 goto folder_failed

echo.
echo ========================================
echo        NEXUS AI - LOCAL STARTUP
echo ========================================
echo.

REM Check that this is the project root.
if not exist "requirements.txt" (
    echo ERROR: requirements.txt was not found.
    echo Extract the complete project ZIP and run this file from its root folder.
    goto failed
)
if not exist "backend\main.py" (
    echo ERROR: backend\main.py was not found.
    echo The project folder is incomplete or this is the wrong folder.
    goto failed
)

REM Prefer the Windows Python Launcher, then fall back to python on PATH.
set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"

if not defined PYTHON_CMD (
    where python >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD goto python_missing

REM Require Python 3.10 or newer before creating the virtual environment.
%PYTHON_CMD% -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
if errorlevel 1 goto python_version

echo [1/3] Checking virtual environment...
if not exist ".venv\Scripts\python.exe" (
    echo Creating .venv...
    %PYTHON_CMD% -m venv .venv
    if errorlevel 1 goto venv_failed
)

if not exist ".venv\Scripts\python.exe" goto venv_failed

echo [2/3] Installing required packages...
".venv\Scripts\python.exe" -m pip --version >nul 2>nul
if errorlevel 1 (
    ".venv\Scripts\python.exe" -m ensurepip --upgrade
    if errorlevel 1 goto pip_failed
)

".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto install_failed

echo.
echo [3/3] Starting NEXUS...
echo.
echo Website: http://127.0.0.1:8000
echo API health: http://127.0.0.1:8000/api/health
echo.
echo Keep this window open while using NEXUS.
echo Press Ctrl+C to stop the server.
echo.

".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
set "SERVER_EXIT=%ERRORLEVEL%"
if not "%SERVER_EXIT%"=="0" (
    echo.
    echo ERROR: NEXUS stopped with exit code %SERVER_EXIT%.
    echo If the message says the address is already in use, close the other
    echo NEXUS server window or stop the process using port 8000.
    goto failed
)
goto finished

:folder_failed
echo ERROR: Could not open the project folder.
goto failed

:python_missing
echo ERROR: Python was not found.
echo Install Python 3.10 or newer from https://www.python.org/downloads/
echo During installation, enable "Add Python to PATH".
goto failed

:python_version
echo ERROR: Python 3.10 or newer is required.
echo Install Python 3.10, 3.11, or 3.12, then run this file again.
goto failed

:venv_failed
echo ERROR: Could not create the virtual environment.
echo Check your Python installation and folder permissions.
goto failed

:pip_failed
echo ERROR: pip is not available inside .venv.
echo Try deleting the .venv folder and run this file again.
goto failed

:install_failed
echo ERROR: Dependency installation failed.
echo Check your internet connection and try again.
echo If an error names a package, share the full error message.
goto failed

:failed
echo.
pause
exit /b 1

:finished
echo.
echo NEXUS server stopped.
pause
exit /b 0
