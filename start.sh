#!/bin/bash
# Project: FliDeck
# Description: Local-first presentation harness for folder-based HTML artifacts
cd "$(dirname "$0")"

echo "================================================"
echo "FliDeck - Development Server"
echo "================================================"
echo ""

# Check if already running
if lsof -i :5201 | grep -q LISTEN; then
  echo "FliDeck is already running on ports 5200/5201"
  echo "Opening browser..."
  open http://localhost:5200
  exit 0
fi

echo "Building shared types..."
npm run build -w shared

echo ""
echo "Starting FliDeck (client: 5200, server: 5201) via Overmind..."
echo "  overmind connect client  — attach to client logs"
echo "  overmind connect server  — attach to server logs"
echo "  overmind stop            — stop all processes"
echo ""

# Open browser after delay (background — gives server time to start)
(sleep 4 && open http://localhost:5200) &

overmind start
