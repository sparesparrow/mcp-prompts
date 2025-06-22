#!/bin/bash
set -e

# Display help
function show_help {
  echo "Usage: ./run-docker-tests.sh [OPTIONS]"
  echo "Run tests in Docker containers using different configurations"
  echo ""
  echo "Options:"
  echo "  --all           Run all test types (default)"
  echo "  --unit          Run only unit tests"
  echo "  --integration   Run only integration tests"
  echo "  --health-check  Run only health check tests"
  echo "  --clean         Clean up containers, networks, and volumes after testing"
  echo "  --coverage      Generate and save test coverage reports"
  echo "  --watch         Watch for file changes and rerun tests (development mode)"
  echo "  --env           Specify the test environment (e.g., postgres, pgai). Default: test."
  echo "  --help          Display this help message"
  echo ""
  echo "Example: ./run-docker-tests.sh --integration --clean --env=postgres"
  exit 0
}

# Default values
RUN_ALL=true
RUN_UNIT=false
RUN_INTEGRATION=false
RUN_HEALTH_CHECK=false
CLEAN_UP=false
COVERAGE=false
WATCH_MODE=false
ENVIRONMENT="test"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --all)
      RUN_ALL=true
      ;;
    --unit)
      RUN_ALL=false
      RUN_UNIT=true
      ;;
    --integration)
      RUN_ALL=false
      RUN_INTEGRATION=true
      ;;
    --health-check)
      RUN_ALL=false
      RUN_HEALTH_CHECK=true
      ;;
    --clean)
      CLEAN_UP=true
      ;;
    --coverage)
      COVERAGE=true
      ;;
    --watch)
      WATCH_MODE=true
      ;;
    --env=*)
      ENVIRONMENT="${1#*=}"
      ;;
    --help)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      ;;
  esac
  shift
done

# --- Helper Functions ---

function get_compose_files() {
  local env=$1
  local files="-f docker-compose.yml"
  
  case $env in
    postgres)
      files="$files -f docker/compose/docker-compose.postgres.yml"
      ;;
    pgai)
      files="$files -f docker/compose/docker-compose.postgres.yml -f docker/compose/docker-compose.pgai.yml"
      ;;
    sse)
      files="$files -f docker/compose/docker-compose.sse.yml"
      ;;
  esac

  files="$files -f docker/compose/docker-compose.test.yml"
  echo $files
}

function run_tests_for_env() {
  local env=$1
  echo "--- Running tests for environment: $env ---"
  
  local compose_files=$(get_compose_files $env)

  if [ "$RUN_ALL" = true ] || [ "$RUN_UNIT" = true ]; then
    run_unit_tests "$compose_files"
  fi
  if [ "$RUN_ALL" = true ] || [ "$RUN_INTEGRATION" = true ]; then
    run_integration_tests "$compose_files"
  fi
  if [ "$RUN_ALL" = true ] || [ "$RUN_HEALTH_CHECK" = true ]; then
    run_health_check_tests "$compose_files"
  fi

  if [ "$CLEAN_UP" = true ]; then
    clean_up "$compose_files"
  fi
}

# --- Test Execution Functions ---

# Create results directory if it doesn't exist
mkdir -p test-results

# Run unit tests
function run_unit_tests {
  local compose_files=$1
  echo "Running unit tests in Docker..."
  
  if [ "$WATCH_MODE" = true ]; then
    docker compose $compose_files run --rm mcp-unit-tests npm run test:unit -- --watch
  else
    COMMAND="npm run test:unit"
    if [ "$COVERAGE" = true ]; then
      COMMAND="$COMMAND -- --coverage --coverageDirectory=/app/test-results/coverage-unit-$ENVIRONMENT"
    fi
    docker compose $compose_files run --rm mcp-unit-tests $COMMAND
  fi
}

# Run integration tests
function run_integration_tests {
  local compose_files=$1
  echo "Running integration tests in Docker..."
  
  if [ "$WATCH_MODE" = true ]; then
    docker compose $compose_files run --rm mcp-integration-tests npm run test:integration -- --watch
  else
    COMMAND="npm run test:integration"
    if [ "$COVERAGE" = true ]; then
      COMMAND="$COMMAND -- --coverage --coverageDirectory=/app/test-results/coverage-integration-$ENVIRONMENT"
    fi
    docker compose $compose_files run --rm mcp-integration-tests $COMMAND
  fi
}

# Run health check tests
function run_health_check_tests {
  local compose_files=$1
  echo "Running health check tests in Docker..."
  
  docker compose $compose_files --profile health-check up --build -d
  docker compose $compose_files --profile health-check logs -f mcp-health-check-tests
  
  # Wait for test runner to complete
  echo "Waiting for tests to complete..."
  docker wait mcp-health-check-tests
  
  # Check exit code
  EXIT_CODE=$(docker inspect mcp-health-check-tests --format='{{.State.ExitCode}}')
  if [ "$EXIT_CODE" != "0" ]; then
    echo "Health check tests failed with exit code $EXIT_CODE"
    if [ "$CLEAN_UP" = true ]; then
      clean_up "$compose_files" --profile health-check
    fi
    exit $EXIT_CODE
  fi
  
  echo "Health check tests completed successfully"
  
  if [ "$CLEAN_UP" = true ]; then
    clean_up "$compose_files" --profile health-check
  fi
}

# Clean up Docker resources
function clean_up {
  local compose_files=$1
  local extra_args=$2
  echo "Cleaning up Docker resources..."
  docker compose $compose_files $extra_args down -v
}

# --- Main Execution Logic ---

if [ "$ENVIRONMENT" = "all" ]; then
  ENVS_TO_RUN="test postgres pgai"
  for env in $ENVS_TO_RUN; do
    run_tests_for_env $env
  done
else
    run_tests_for_env $ENVIRONMENT
fi

echo "All specified tests completed!"