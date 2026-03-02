# Personalized Scheme Recommendation System - Startup Script
# This script starts both the backend and frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Prahar AI - Scheme Recommendation System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Installing Dependencies" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
if (Test-Path "node_modules") {
    Write-Host "✓ Backend dependencies already installed" -ForegroundColor Green
} else {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Backend dependencies installed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
}
Set-Location ..

Write-Host ""

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
if (Test-Path "node_modules") {
    Write-Host "✓ Frontend dependencies already installed" -ForegroundColor Green
} else {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Frontend dependencies installed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
}
Set-Location ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 2: Starting Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting backend server on http://localhost:3000..." -ForegroundColor Yellow
Write-Host "Starting frontend server on http://localhost:5173..." -ForegroundColor Yellow
Write-Host ""

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "System Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Credentials:" -ForegroundColor Yellow
Write-Host "  Email:    admin@example.com" -ForegroundColor White
Write-Host "  Password: password" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each terminal window to stop the servers" -ForegroundColor Gray
Write-Host ""
