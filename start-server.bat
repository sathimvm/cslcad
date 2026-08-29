@echo off
REM Start script: installs deps and starts server
npm install
if %errorlevel% neq 0 (
  echo npm install failed. Make sure Node.js and npm are installed and in PATH.
  pause
  exit /b %errorlevel%
)
npm start
pause
