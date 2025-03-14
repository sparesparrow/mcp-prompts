# MCP-Prompts Codebase Cleanup Plan

## Files Organization

We've organized the files into a more structured directory layout:

```
mcp-prompts/
├── .github/workflows/      # CI/CD workflows
├── docker/                 # Docker-related files
│   ├── Dockerfile.setup    # Setup container configuration
│   ├── Dockerfile.test     # Testing container configuration
│   ├── docker-compose.*    # Docker Compose configurations
│   └── setup-container.sh  # Container setup script
├── scripts/                # Maintenance scripts
│   ├── build/              # Build scripts
│   │   ├── fix-build.js    # ESM compatibility fixes
│   │   └── fix-package.js  # Package.json fixes for distribution
│   └── test/               # Test scripts
│       ├── test-build.sh      # Test build process
│       ├── test-docker-build.sh  # Test Docker build
│       ├── test-npx-package.sh   # Test npx package
│       ├── test-published-package.sh  # Test published package
│       └── verify-npx.sh      # Verify npx installation
├── tests/                  # Test files
│   ├── integration/        # Integration tests
│   │   └── run-mcp-tests.js  # MCP server integration test runner
│   └── sdk/                # SDK tests
│       └── test-sdk.js     # Test SDK functionality
└── ... (other project files)
```

## Files to Keep

### Essential Docker Files
- `Dockerfile` (main production Dockerfile)
- `docker/docker-compose.yml` (main Docker Compose configuration)
- `docker/docker-compose.setup.yml` (development environment setup)
- `docker/docker-compose.test.yml` (testing configuration)
- `docker/Dockerfile.setup` (setup container configuration)
- `docker/Dockerfile.test` (testing container configuration)
- `docker/setup-container.sh` (container setup script)

### Essential Build Scripts
- `scripts/build/fix-build.js` (ESM compatibility fixes)
- `scripts/build/fix-package.js` (package.json fixes for distribution)

### Essential Test Scripts
- `scripts/test/test-build.sh` (test build process)
- `scripts/test/test-docker-build.sh` (test Docker build)
- `scripts/test/test-npx-package.sh` (test npx package)
- `scripts/test/test-published-package.sh` (test published package)
- `scripts/test/verify-npx.sh` (verify npx installation)

### Essential Test Files
- `tests/integration/run-mcp-tests.js` (MCP server integration test runner)
- `tests/sdk/test-sdk.js` (SDK test script)

### CI/CD Configuration
- `.github/workflows/build-publish.yml` (main GitHub Actions workflow)
- `.github/workflows/test-and-publish.yml` (testing and publishing workflow)
- `.github/workflows/ci.yml` (CI workflow)
- `.github/workflows/publish.yml` (publish workflow)

## Files to Update or Modify

1. **Update package.json scripts**
   - Update Docker-related scripts to use the new file paths ✅

2. **Update GitHub Actions workflow**
   - Ensure workflows use the new file paths

3. **Update documentation**
   - Update README with new file structure ✅
   - Create README-DEVELOPMENT.md for detailed development instructions ✅
   - Create RELEASE_CHECKLIST.md for release preparation ✅

## Files to Remove

1. **Duplicate or Redundant Files**
   - `fix-imports.js` (functionality covered by fix-build.js)
   - `manual-docker-test.sh` (incomplete script)

2. **Files Moved to New Locations**
   - `docker-compose.setup.yml` (moved to docker/)
   - `docker-compose.test.yml` (moved to docker/)
   - `docker-compose.yml` (moved to docker/)
   - `Dockerfile.setup` (moved to docker/)
   - `Dockerfile.test` (moved to docker/)
   - `fix-build.js` (moved to scripts/build/)
   - `fix-package.js` (moved to scripts/build/)
   - `test-build.sh` (moved to scripts/test/)
   - `test-docker-build.sh` (moved to scripts/test/)
   - `test-npx-package.sh` (moved to scripts/test/)
   - `test-published-package.sh` (moved to scripts/test/)
   - `verify-npx.sh` (moved to scripts/test/)
   - `test-sdk.js` (moved to tests/sdk/)
   - `scripts/run-mcp-tests.js` (moved to tests/integration/)

## Implementation Steps

1. **Verify the new structure**
   ```bash
   # Ensure all scripts are executable
   chmod +x scripts/test/*.sh scripts/build/*.js tests/integration/run-mcp-tests.js tests/sdk/test-sdk.js
   ```

2. **Update GitHub Actions workflows**
   ```bash
   # Edit .github/workflows/*.yml files to use the new file paths
   # For example, changing references from ./test-published-package.sh to ./scripts/test/test-published-package.sh
   ```

3. **Clean up redundant files after verification**
   ```bash
   # Remove duplicate files
   rm fix-imports.js
   rm manual-docker-test.sh
   
   # Remove files that were copied to new locations
   rm docker-compose.setup.yml
   rm docker-compose.test.yml
   rm docker-compose.yml
   rm Dockerfile.setup
   rm Dockerfile.test
   rm fix-build.js
   rm fix-package.js
   rm test-build.sh
   rm test-docker-build.sh
   rm test-npx-package.sh
   rm test-published-package.sh
   rm verify-npx.sh
   rm test-sdk.js
   ```

## Final Release Preparation

1. **Ensure all tests pass**
   ```bash
   # Run unit tests
   npm test
   
   # Run integration tests
   npm run test:integration
   
   # Test the build process
   npm run test:build
   
   # Test Docker build
   npm run test:docker
   ```

2. **Update version**
   ```bash
   # Update version in package.json according to semantic versioning
   # For example, bumping from 1.1.2 to 1.1.3 for a bug fix release
   ```

3. **Generate documentation**
   - Ensure API documentation is up-to-date
   - Update usage examples if needed

4. **Follow the release checklist**
   - Refer to RELEASE_CHECKLIST.md for a comprehensive release preparation process 