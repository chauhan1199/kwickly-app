@echo off
REM ══════════════════════════════════════════════════════════════
REM  KWICKLY PRODUCTION DEPLOYMENT SCRIPT (Windows)
REM ══════════════════════════════════════════════════════════════

echo.
echo ╔═════════════════════════════════════════════════════════════╗
echo ║         KWICKLY PRODUCTION DEPLOYMENT                      ║
echo ╚═════════════════════════════════════════════════════════════╝
echo.

REM Step 1: Check prerequisites
echo [1/8] Checking prerequisites...
where docker >nul 2>&1 || (echo ERROR: Docker not found. Install Docker Desktop first. & exit /b 1)
where docker-compose >nul 2>&1 || (echo ERROR: docker-compose not found. & exit /b 1)
echo   ✓ Docker and docker-compose found

REM Step 2: Check .env file
echo [2/8] Checking environment configuration...
if not exist "backend\.env" (
    echo   Creating .env from template...
    copy backend\.env.production backend\.env
    echo   ⚠ IMPORTANT: Edit backend\.env with your production values before continuing!
    echo   Press any key when ready...
    pause >nul
)
echo   ✓ Environment file ready

REM Step 3: Run tests
echo [3/8] Running test suite...
cd backend
call npx jest --runInBand --forceExit --silent
if %errorlevel% neq 0 (
    echo   ✗ Tests failed! Fix issues before deploying.
    exit /b 1
)
echo   ✓ All tests passed
cd ..

REM Step 4: Build Docker images
echo [4/8] Building Docker images...
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo   ✗ Build failed!
    exit /b 1
)
echo   ✓ Docker images built

REM Step 5: Stop existing containers
echo [5/8] Stopping existing containers...
docker-compose down --remove-orphans 2>nul
echo   ✓ Existing containers stopped

REM Step 6: Start services
echo [6/8] Starting services...
docker-compose up -d
if %errorlevel% neq 0 (
    echo   ✗ Failed to start services!
    exit /b 1
)
echo   ✓ Services started

REM Step 7: Wait for health checks
echo [7/8] Waiting for services to be healthy...
timeout /t 10 /nobreak >nul
curl -s http://localhost:5000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo   ⚠ Backend may still be starting up...
)
echo   ✓ Health check completed

REM Step 8: Show status
echo [8/8] Deployment status...
docker-compose ps
echo.
echo ╔═════════════════════════════════════════════════════════════╗
echo ║  DEPLOYMENT COMPLETE                                       ║
echo ║                                                             ║
echo ║  Backend API:  http://localhost:5000                        ║
echo ║  Health Check: http://localhost:5000/health                 ║
echo ║  MongoDB:      localhost:27017                              ║
echo ║  Redis:        localhost:6379                               ║
echo ║                                                             ║
echo ║  View logs:    docker-compose logs -f backend              ║
echo ║  Stop:         docker-compose down                         ║
echo ╚═════════════════════════════════════════════════════════════╝
echo.
