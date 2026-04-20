#!/bin/bash
set -e

MODE="${1:-dev}"

echo "--- Building SIMTA ($MODE mode) ---"

# Kill existing processes on target ports
echo "Cleaning ports 3535 and 3536..."
fuser -k 3535/tcp 2>/dev/null || true
fuser -k 3536/tcp 2>/dev/null || true
sleep 1

if [ "$MODE" = "prod" ]; then
    echo "--- Memulai SIMTA Mode PRODUCTION (Container) ---"
    
    # Kill existing processes/containers on target ports
    echo "Cleaning ports 3535 and 3536..."
    fuser -k 3535/tcp 2>/dev/null || true
    fuser -k 3536/tcp 2>/dev/null || true
    if command -v podman-compose &> /dev/null; then
        COMPOSE_CMD="podman-compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        echo "Error: docker-compose atau podman-compose tidak ditemukan!"
        exit 1
    fi
    $COMPOSE_CMD build
    echo "--- Build Containers Complete ---"
    exit 0
fi

if [ "$MODE" = "dev" ]; then
    # 1. Build Frontend
    echo "[1/2] Building Frontend locally..."
    cd frontend
    # Clean potential stale caches
    rm -rf tsconfig.tsbuildinfo node_modules/.vite
    npm install
    npm run build
    cd ..

    # 2. Build Backend
    echo "[2/2] Building Backend locally..."
    cd backend
    go build -o server .
    cd ..

    echo "--- Build Complete ---"
    echo "To start the application:"
    echo "1. Menggunakan: ./start.sh dev"
    exit 0
fi

echo "Mode tidak valid! Gunakan './build.sh dev' atau './build.sh prod'."
exit 1
