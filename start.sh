#!/bin/bash
# SIMTA — Startup Script
# Menjalankan backend Go dan frontend (Mode dev lokal atau prod container)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="${1:-dev}"

if [ "$MODE" = "prod" ]; then
    echo "--- Memulai SIMTA Mode PRODUCTION (Container) ---"
    
    # Kill existing processes/containers on target ports
    echo "Cleaning ports 3535 and 3536..."
    fuser -k 3535/tcp 2>/dev/null || true
    fuser -k 3536/tcp 2>/dev/null || true
    sleep 1
    # Memilih command yang ada: podman-compose atau docker-compose
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
    echo "Menggunakan command: $COMPOSE_CMD"
    
    # Supaya build ulang container jika ada perubahan
    $COMPOSE_CMD up -d --build
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SIMTA — Sistem Monitoring Tugas Akhir [PRODUCTION]"
    echo "  Telah berjalan di container. Buka http://localhost:3535"
    echo "  Untuk melihat logs: $COMPOSE_CMD logs -f"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
fi

if [ "$MODE" = "dev" ]; then
    echo "--- Memulai SIMTA Mode DEV (Native) ---"
    
    # Kill existing processes
    pkill -f "simta-backend" 2>/dev/null || true
    pkill -f "vite.*simta\|simta.*vite" 2>/dev/null || true
    sleep 1

    # Load shared env
    set -a
    [ -f .env ] && . ./.env
    set +a

    # Start backend
    echo "▶ Starting backend on :3536..."
    cd "$SCRIPT_DIR/backend"
    go build -o simta-backend . 2>&1
    ./simta-backend &
    BACKEND_PID=$!

    # Wait for backend
    sleep 2
    echo "✓ Backend running (PID: $BACKEND_PID)"

    # Start frontend
    echo "▶ Starting frontend on :3535..."
    cd "$SCRIPT_DIR/frontend"
    npm run dev &
    FRONTEND_PID=$!

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SIMTA — Sistem Monitoring Tugas Akhir [DEV]"
    echo "  Backend  : http://localhost:3536"
    echo "  Frontend : http://localhost:3535"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Tekan Ctrl+C untuk menghentikan semua server."

    # Cleanup on exit
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
    wait
    exit 0
fi

echo "Mode tidak valid! Gunakan './start.sh dev' atau './start.sh prod'."
exit 1
