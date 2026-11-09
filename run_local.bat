@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
    where python >nul 2>nul
    if errorlevel 1 goto python_missing
    set PYTHON=python
) else (
    set PYTHON=py -3
)

if not exist ".venv\Scripts\python.exe" (
    %PYTHON% -m venv .venv
    if errorlevel 1 goto setup_failed
)

echo Installing or checking Python dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto setup_failed

echo.
echo NEXUS is starting. Open http://127.0.0.1:8000 in your browser.
echo Keep this window open while using NEXUS. Press Ctrl+C to stop.
".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
goto :eof

:python_missing
echo Python 3.10 or newer was not found. Install Python and enable "Add Python to PATH".
pause
exit /b 1

:setup_failed
echo Setup failed. Check your Python installation and internet connection, then try again.
pause
exit /b 1
