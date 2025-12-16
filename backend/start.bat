@echo off
echo ========================================
echo Starting Flashcard Backend Server
echo ========================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo Dependencies not installed. Running setup first...
    call setup.bat
    if %errorlevel% neq 0 exit /b 1
)

:: Check if .env exists
if not exist ".env" (
    echo Creating .env from .env.example...
    copy .env.example .env
)

echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop
echo.

npm run dev
