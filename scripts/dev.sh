#!/bin/bash
set -e

# Start development environment
echo "🚀 Starting development environment..."

# Run tests in watch mode
pnpm run test:watch &
TEST_PID=$!

# Start TypeScript compiler in watch mode
pnpm run build:watch &
TSC_PID=$!

# Start the development server
pnpm run dev &
SERVER_PID=$!

# Handle cleanup on exit
cleanup() {
    echo "Cleaning up..."
    kill $TEST_PID $TSC_PID $SERVER_PID
}
trap cleanup EXIT

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
