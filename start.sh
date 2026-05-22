#!/bin/bash

# =====================================================
# CropGuard AI - Start Script
# AI Crop Disease & Pest Detection Platform
# =====================================================

set -e

YELLOW='\033[1;33m'
GREEN='\033[1;32m'
RED='\033[1;31m'
BLUE='\033[1;34m'
CYAN='\033[1;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=4400
FRONTEND_PORT=3400

echo -e "${GREEN}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║        🌿 CropGuard AI Platform 🌿           ║"
echo "  ║   AI Crop Disease & Pest Detection System     ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# ==================== CLEAN PORTS ====================
echo -e "${YELLOW}[1/6] Cleaning used ports...${NC}"

cleanup_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "  ${RED}Killing processes on port $port: $pids${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  else
    echo -e "  ${GREEN}Port $port is free${NC}"
  fi
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

# ==================== CHECK DEPENDENCIES ====================
echo -e "\n${YELLOW}[2/6] Checking dependencies...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "  ${RED}Node.js not found! Please install Node.js${NC}"
  exit 1
fi
echo -e "  ${GREEN}Node.js: $(node --version)${NC}"

if ! command -v psql &> /dev/null; then
  echo -e "  ${RED}PostgreSQL not found! Please install PostgreSQL${NC}"
  exit 1
fi
echo -e "  ${GREEN}PostgreSQL: $(psql --version | head -1)${NC}"

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
  echo -e "  ${YELLOW}Starting PostgreSQL...${NC}"
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
    echo -e "  ${RED}Failed to start PostgreSQL. Please start it manually.${NC}"
    exit 1
  }
  sleep 2
fi
echo -e "  ${GREEN}PostgreSQL is running${NC}"

# ==================== SETUP DATABASE ====================
echo -e "\n${YELLOW}[3/6] Setting up database...${NC}"

# Create database if not exists
if ! psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw crop_disease_db; then
  echo -e "  ${CYAN}Creating database 'crop_disease_db'...${NC}"
  createdb crop_disease_db 2>/dev/null || psql -c "CREATE DATABASE crop_disease_db;" 2>/dev/null || true
fi
echo -e "  ${GREEN}Database ready${NC}"

# Update .env with correct database URL (use current user for macOS)
CURRENT_USER=$(whoami)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS typically uses peer auth with current username
  sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${CURRENT_USER}@localhost:5432/crop_disease_db|" "$PROJECT_DIR/.env" 2>/dev/null || true
fi

# ==================== INSTALL PACKAGES ====================
echo -e "\n${YELLOW}[4/6] Installing packages...${NC}"

cd "$PROJECT_DIR/backend"
if [ ! -d "node_modules" ]; then
  echo -e "  ${CYAN}Installing backend packages...${NC}"
  npm install --silent 2>&1 | tail -1
else
  echo -e "  ${GREEN}Backend packages already installed${NC}"
fi

cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  echo -e "  ${CYAN}Installing frontend packages...${NC}"
  npm install --silent 2>&1 | tail -1
else
  echo -e "  ${GREEN}Frontend packages already installed${NC}"
fi

# ==================== SEED DATABASE ====================
echo -e "\n${YELLOW}[5/6] Seeding database...${NC}"
cd "$PROJECT_DIR/backend"
node seed.js
echo -e "  ${GREEN}Database seeded successfully!${NC}"

# ==================== START SERVERS ====================
echo -e "\n${YELLOW}[6/6] Starting servers with hot reload...${NC}"

# Start backend with nodemon for hot reload
cd "$PROJECT_DIR/backend"
BACKEND_PORT=$BACKEND_PORT npx nodemon --watch . --ext js,json server.js &
BACKEND_PID=$!
echo -e "  ${GREEN}Backend starting on port $BACKEND_PORT (PID: $BACKEND_PID)${NC}"

# Start frontend with Vite (has built-in HMR)
cd "$PROJECT_DIR/frontend"
BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT npx vite --port $FRONTEND_PORT --host &
FRONTEND_PID=$!
echo -e "  ${GREEN}Frontend starting on port $FRONTEND_PORT (PID: $FRONTEND_PID)${NC}"

# Wait for servers to start
sleep 3

echo -e "\n${GREEN}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║         🌿 CropGuard AI is Running! 🌿       ║"
echo "  ╠═══════════════════════════════════════════════╣"
echo "  ║                                               ║"
echo "  ║  Frontend:  http://localhost:$FRONTEND_PORT          ║"
echo "  ║  Backend:   http://localhost:$BACKEND_PORT          ║"
echo "  ║                                               ║"
echo "  ║  Login:     admin@cropguard.com               ║"
echo "  ║  Password:  password123                       ║"
echo "  ║                                               ║"
echo "  ║  Hot reload enabled for both servers          ║"
echo "  ║  Press Ctrl+C to stop all services            ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Trap to clean up on exit
cleanup() {
  echo -e "\n${YELLOW}Shutting down CropGuard AI...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  cleanup_port $BACKEND_PORT
  cleanup_port $FRONTEND_PORT
  echo -e "${GREEN}CropGuard AI stopped. Goodbye! 🌿${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
