#!/usr/bin/env bash
set -e

# Colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print formatted messages
log_info() {
  echo -e "${BLUE}INFO:${NC} $1"
}

log_success() {
  echo -e "${GREEN}SUCCESS:${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}WARNING:${NC} $1"
}

log_error() {
  echo -e "${RED}ERROR:${NC} $1"
}

# Function to display usage
usage() {
  cat << EOF
Usage: ./install.sh [OPTIONS]

Universal installer for the MCP Prompts server.

Options:
  --help              Show this help message
  --mode=<mode>       Installation mode (npm, docker, local)
  --docker-user=<user> Docker username (for Docker mode)
  --path=<path>       Path to install (for local mode)
  --process-prompts   Process raw prompts
  --no-build          Skip the build step
  --dev               Install in development mode

Examples:
  ./install.sh --mode=npm                # Install via npm globally
  ./install.sh --mode=docker             # Install via Docker
  ./install.sh --mode=local --path=/opt  # Install to local path
EOF
}

# Default values
INSTALL_MODE="local"
INSTALL_PATH="$HOME/.mcp-prompts"
DOCKER_USER="user"
PROCESS_PROMPTS=false
SKIP_BUILD=false
DEV_MODE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --help)
      usage
      exit 0
      ;;
    --mode=*)
      INSTALL_MODE="${arg#*=}"
      ;;
    --docker-user=*)
      DOCKER_USER="${arg#*=}"
      ;;
    --path=*)
      INSTALL_PATH="${arg#*=}"
      ;;
    --process-prompts)
      PROCESS_PROMPTS=true
      ;;
    --no-build)
      SKIP_BUILD=true
      ;;
    --dev)
      DEV_MODE=true
      ;;
    *)
      log_error "Unknown option: $arg"
      usage
      exit 1
      ;;
  esac
done

# Function to check dependencies
check_dependencies() {
  log_info "Checking dependencies..."
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js v18 or later."
    exit 1
  fi
  
  NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    log_warning "Node.js version is $NODE_VERSION. Version 18 or higher is recommended."
  else
    log_success "Node.js version $NODE_VERSION is suitable."
  fi
  
  # Check for npm
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed. Please install npm."
    exit 1
  fi
  
  # Check for Docker if needed
  if [ "$INSTALL_MODE" = "docker" ]; then
    if ! command -v docker &> /dev/null; then
      log_error "Docker is not installed but is required for docker mode. Please install Docker."
      exit 1
    fi
    log_success "Docker is installed."
  fi
}

# Function to install dependencies and build
build_project() {
  if [ "$SKIP_BUILD" = true ]; then
    log_info "Skipping build as requested..."
    return
  fi
  
  log_info "Installing dependencies..."
  if [ "$DEV_MODE" = true ]; then
    npm install
  else
    npm ci
  fi
  
  log_info "Building project..."
  npm run build
  
  log_success "Build completed."
}

# Function to process raw prompts
process_prompts() {
  if [ "$PROCESS_PROMPTS" = true ]; then
    log_info "Processing raw prompts..."
    if [ ! -f "rawprompts.txt" ]; then
      log_warning "rawprompts.txt not found, skipping prompt processing."
      return
    fi
    
    # Create directory for processed prompts
    mkdir -p processed_prompts
    
    # Run the processing script
    node scripts/process_prompts.js
    
    # Copy processed prompts to the right location
    cp -r processed_prompts/* prompts/
    
    log_success "Prompts processed and added to the prompts directory."
  else
    log_info "Skipping prompt processing. Use --process-prompts to process raw prompts."
  fi
}

# Function to install the MCP server
install_mcp_server() {
  case $INSTALL_MODE in
    npm)
      log_info "Installing via npm globally..."
      npm i -g .
      log_success "Installed globally via npm. Use 'mcp-prompts' to run."
      ;;
    docker)
      log_info "Building Docker image..."
      docker build -t "$DOCKER_USER/mcp-prompts:latest" .
      log_success "Docker image built as $DOCKER_USER/mcp-prompts:latest"
      log_info "Run with: docker run -it --rm $DOCKER_USER/mcp-prompts:latest"
      ;;
    local)
      log_info "Installing to local path: $INSTALL_PATH"
      mkdir -p "$INSTALL_PATH"
      cp -r package.json package-lock.json build/ prompts/ "$INSTALL_PATH/"
      
      # Create a launcher script
      LAUNCHER="$INSTALL_PATH/mcp-prompts"
      cat > "$LAUNCHER" << EOF
#!/usr/bin/env bash
node "\$(dirname "\$0")/build/index.js" "\$@"
EOF
      chmod +x "$LAUNCHER"
      
      # Create symlink if not already in PATH
      if [[ ":$PATH:" != *":$INSTALL_PATH:"* ]]; then
        SYMLINK_DIR="$HOME/.local/bin"
        mkdir -p "$SYMLINK_DIR"
        ln -sf "$LAUNCHER" "$SYMLINK_DIR/mcp-prompts"
        log_info "Created symlink in $SYMLINK_DIR"
        log_info "Make sure $SYMLINK_DIR is in your PATH."
      fi
      
      log_success "Installed to $INSTALL_PATH"
      ;;
    *)
      log_error "Unknown installation mode: $INSTALL_MODE"
      usage
      exit 1
      ;;
  esac
}

# Main installation flow
main() {
  log_info "Starting MCP Prompts server installation..."
  
  check_dependencies
  build_project
  process_prompts
  install_mcp_server
  
  log_success "MCP Prompts server installation completed!"
  
  case $INSTALL_MODE in
    npm)
      log_info "Run the server with: mcp-prompts"
      ;;
    docker)
      log_info "Run the server with: docker run -it --rm $DOCKER_USER/mcp-prompts:latest"
      ;;
    local)
      log_info "Run the server with: $INSTALL_PATH/mcp-prompts"
      if [[ ":$PATH:" != *":$INSTALL_PATH:"* ]] && [[ ":$PATH:" == *":$HOME/.local/bin:"* ]]; then
        log_info "Or simply: mcp-prompts"
      fi
      ;;
  esac
  
  log_info "Documentation: https://github.com/yourusername/mcp-prompts#readme"
}

# Execute the main function
main 