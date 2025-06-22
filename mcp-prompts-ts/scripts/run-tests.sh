#!/bin/bash
set -e

# Display help
function show_help {
  echo "Usage: ./run-tests.sh [OPTIONS]"
  echo "Run tests for MCP-Prompts"
  echo ""
  echo "Options:"
  echo "  --unit             Run only unit tests"
  echo "  --integration      Run only integration tests"
  echo "  --coverage         Generate test coverage report"
  echo "  --docker           Run tests in Docker containers"
  echo "  --clean            Clean up Docker containers after tests"
  echo "  --help             Display this help message"
  echo ""
  echo "If no options are provided, all tests will be run."
  exit 0
}

# Parse arguments
RUN_UNIT=false
RUN_INTEGRATION=false
RUN_COVERAGE=false
USE_DOCKER=false
CLEAN_DOCKER=false

if [ $# -eq 0 ]; then
  RUN_UNIT=true
  RUN_INTEGRATION=true
else
  for arg in "$@"; do
    case $arg in
      --unit)
        RUN_UNIT=true
        ;;
      --integration)
        RUN_INTEGRATION=true
        ;;
      --coverage)
        RUN_COVERAGE=true
        ;;
      --docker)
        USE_DOCKER=true
        ;;
      --clean)
        CLEAN_DOCKER=true
        ;;
      --help)
        show_help
        ;;
      *)
        echo "Unknown option: $arg"
        show_help
        ;;
    esac
  done
fi

# Start PostgreSQL if running integration tests outside Docker
if [ "$RUN_INTEGRATION" = true ] && [ "$USE_DOCKER" = false ]; then
  echo "Starting PostgreSQL container for integration tests..."
  docker run --name postgres-test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mcp_prompts_test -p 5432:5432 --rm -d postgres:14-alpine

  # Wait for PostgreSQL to become ready
  echo "Waiting for PostgreSQL to be ready..."
  until docker exec postgres-test pg_isready -U postgres &> /dev/null; do
    echo -n "."
    sleep 1
  done
  echo " PostgreSQL is ready!"
fi

# Set up cleanup function
function cleanup {
  if [ "$RUN_INTEGRATION" = true ] && [ "$USE_DOCKER" = false ]; then
    echo "Stopping PostgreSQL container..."
    docker stop postgres-test
  fi

  if [ "$USE_DOCKER" = true ] && [ "$CLEAN_DOCKER" = true ]; then
    echo "Cleaning up Docker resources..."
    docker-compose -f docker-compose.test.yml down -v
  fi
}

# Register cleanup function to run on exit
trap cleanup EXIT

# Run tests
if [ "$USE_DOCKER" = true ]; then
  echo "Running tests in Docker containers..."
  docker-compose -f docker-compose.test.yml build
  docker-compose -f docker-compose.test.yml up --abort-on-container-exit
else
  # Run unit tests
  if [ "$RUN_UNIT" = true ]; then
    echo "Running unit tests..."
    if [ "$RUN_COVERAGE" = true ]; then
      npm run test -- --coverage
    else
      npm run test -- --testPathIgnorePatterns=integration
    fi
  fi

  # Run integration tests
  if [ "$RUN_INTEGRATION" = true ]; then
    echo "Running integration tests..."
    export TEST_INTEGRATION=true
    export STORAGE_TYPE=postgres
    export PG_HOST=localhost
    export PG_PORT=5432
    export PG_DATABASE=mcp_prompts_test
    export PG_USER=postgres
    export PG_PASSWORD=postgres
    export PG_SSL=false
    
    npm run test -- --testPathPattern=integration
  fi
fi

echo "All tests completed successfully!" 