@echo off
echo Starting Inventory Billing System...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd server && npm start"

timeout /t 5 /nobreak > nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "npm start"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Login with: admin / admin123
pause
