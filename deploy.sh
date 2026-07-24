#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  KWICKLY PRODUCTION DEPLOYMENT SCRIPT (Linux/Mac)
# ══════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔═════════════════════════════════════════════════════════════╗"
echo "║         KWICKLY PRODUCTION DEPLOYMENT                      ║"
echo "╚═════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check prerequisites
echo "[1/8] Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker not found."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "ERROR: docker-compose not found."; exit 1; }
echo "  ✓ Docker and docker-compose found"

# Step 2: Check .env file
echo "[2/8] Checking environment configuration..."
if [ ! -f "backend/.env" ]; then
    echo "  Creating .env from template..."
    cp backend/.env.production backend/.env
    echo "  ⚠ IMPORTANT: Edit backend/.env with your production values!"
    echo "  Press Enter when ready..."
    read
fi
echo "  ✓ Environment file ready"

# Step 3: Run tests
echo "[3/8] Running test suite..."
cd backend
npx jest --runInBand --forceExit --silent || { echo "  ✗ Tests failed!"; exit 1; }
echo "  ✓ All tests passed"
cd ..

# Step 4: Build Docker images
echo "[4/8] Building Docker images..."
docker-compose build --no-cache || { echo "  ✗ Build failed!"; exit 1; }
echo "  ✓ Docker images built"

# Step 5: Stop existing containers
echo "[5/8] Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true
echo "  ✓ Existing containers stopped"

# Step 6: Start services
echo "[6/8] Starting services..."
docker-compose up -d || { echo "  ✗ Failed to start services!"; exit 1; }
echo "  ✓ Services started"

# Step 7: Wait for health checks
echo "[7/8] Waiting for services to be healthy..."
sleep 10
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "  ✓ Backend is healthy"
else
    echo "  ⚠ Backend may still be starting..."
fi

# Step 8: Show status
echo "[8/8] Deployment status..."
docker-compose ps
echo ""
echo "╔═════════════════════════════════════════════════════════════╗"
echo "║  DEPLOYMENT COMPLETE                                       ║"
echo "║                                                             ║"
echo "║  Backend API:  http://localhost:5000                        ║"
echo "║  Health Check: http://localhost:5000/health                 ║"
echo "║  MongoDB:      localhost:27017                              ║"
echo "║  Redis:        localhost:6379                               ║"
echo "║                                                             ║"
echo "║  View logs:    docker-compose logs -f backend              ║"
echo "║  Stop:         docker-compose down                         ║"
echo "╚═════════════════════════════════════════════════════════════╝"
echo ""
