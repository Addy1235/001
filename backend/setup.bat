@echo off
echo ========================================
echo Flashcard Backend Setup
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo Or run: winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

echo Node.js found:
node --version
echo.

:: Navigate to backend directory
cd /d "%~dp0"

:: Check if .env exists, if not create from example
if not exist ".env" (
    echo Creating .env file from .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env file to configure your MongoDB URI
    echo Default: mongodb://localhost:27017/flashcard
    echo.
)

:: Install dependencies
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo To start the server, run:
echo   npm run dev
echo.
echo Or double-click: start.bat
echo.
pause
