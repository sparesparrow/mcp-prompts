# Development Guide

This guide explains how to develop and contribute to the MCP Prompt Manager project.

## Directory Structure

The project follows a structured organization to maintain clean separation of concerns:

```
mcp-prompt-manager/
├── .github/workflows/    # CI/CD workflow configurations
├── docker/               # Docker-related files
│   ├── Dockerfile.setup  # Setup container configuration
│   ├── Dockerfile.test   # Testing container configuration
│   ├── docker-compose.*  # Docker Compose configurations
│   └── setup-container.sh # Container setup script
├── scripts/              # Maintenance and utility scripts
│   ├── build/            # Build scripts
│   │   ├── fix-build.js  # ESM compatibility fixes
│   │   └── fix-package.js # Package.json fixes
│   └── test/             # Test scripts
│       ├── test-build.sh      # Test build process
│       ├── test-docker-build.sh # Test Docker build
│       ├── test-npx-package.sh  # Test npx package
│       └── test-published-package.sh # Test published package
├── src/                  # Source code
│   ├── adapters/         # Storage adapters
│   ├── core/             # Core logic and types
│   ├── services/         # Business services
│   ├── tools/            # MCP tool implementations
│   ├── utils/            # Utility functions
│   ├── config.ts         # Configuration handling
│   └── index.ts          # Main entry point
├── tests/                # Test files
│   ├── integration/      # Integration tests
│   │   └── run-mcp-tests.js # MCP server integration test runner
│   └── sdk/              # SDK tests
│       └── test-sdk.js   # Test SDK functionality
├── Dockerfile            # Production Docker image
├── package.json          # Project metadata and scripts
├── RELEASE_CHECKLIST.md  # Steps for releasing a new version
└── README.md             # Project documentation
```

## Development Workflow

### Setting Up Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/user/mcp-prompt-manager.git
   cd mcp-prompt-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with the necessary configuration:
   ```
   # Storage configuration
   STORAGE_TYPE=file
   PROMPTS_DIR=./data/prompts
   
   # Server configuration
   SERVER_NAME=mcp-prompts
   SERVER_VERSION=1.0.0
   LOG_LEVEL=debug
   ```

### Development Commands

- **Start development server with hot reloading**
  ```bash
  npm run dev
  ```

- **Build the project**
  ```bash
  npm run build
  ```

- **Run unit tests**
  ```bash
  npm test
  ```

- **Run integration tests**
  ```bash
  npm run test:integration
  ```

- **Test build process**
  ```bash
  npm run test:build
  ```

- **Test Docker build**
  ```bash
  npm run test:docker
  ```

- **Build Docker image**
  ```bash
  npm run docker:build
  ```

### Build Process

The build process includes several important steps:

1. **TypeScript Compilation**
   ```bash
   npx tsc
   ```

2. **Copy Static Files**
   ```bash
   npm run copy-static-files
   ```

3. **Make Entry Point Executable**
   ```bash
   chmod +x build/index.js
   ```

4. **Fix ESM Imports**
   The `fix-build.js` script handles ESM compatibility issues, including:
   - Adding `.js` extensions to local imports
   - Handling CommonJS modules in ESM environment
   - Special handling for MCP SDK imports

### Docker Development

For Docker-based development:

1. **Run development environment with Docker Compose**
   ```bash
   docker-compose -f docker/docker-compose.setup.yml up
   ```

2. **Test in Docker environment**
   ```bash
   docker-compose -f docker/docker-compose.test.yml up
   ```

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

### Release Process

Before creating a release, please follow the steps in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) to ensure everything is properly prepared. 