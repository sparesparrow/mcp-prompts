# MCP Prompts Server Codebase Cleanup Plan

This document outlines the comprehensive plan for cleaning up the MCP Prompts Server codebase before the next release.

## 1. Fix the Missing Config.js Issue

### Current Issues
- When running the package with npx, it fails with `Cannot find module '/path/to/config.js'`
- The published package is missing essential files, including only README.md, index.js, and package.json

### Fixes Implemented
- Updated `files` in package.json to include the required file
- Updated the copy-static-files script to explicitly copy config.js
- Created a verification script to check for missing files before publishing
- Enhanced the ensure-config.js script to provide a more robust fallback

## 2. Docker-Related Cleanup

### Current Issues
- Docker login detection is not working properly
- Docker Compose files are showing obsolete version warnings
- Network issues with Docker Compose setups

### Tasks
- [x] Fixed Docker login detection in publish.sh
- [ ] Update Docker Compose files to remove obsolete version attribute
- [ ] Add cleanup procedures for Docker networks before running compose
- [ ] Add volume cleanup options to the Docker scripts
- [ ] Enhance Docker healthchecks for PostgreSQL and other services

## 3. Module Organization

### Current Issues
- Directory structure could be more intuitive
- Some files may have duplicate functionality
- ESM import issues with .js extensions

### Tasks
- [ ] Review all import paths for consistency
- [ ] Ensure consistent use of .js extensions in imports for ESM compatibility
- [ ] Consolidate similar utilities into shared modules
- [ ] Remove any deprecated code paths
- [ ] Add explicit exports in index.js to make API surface clear

## 4. Testing Infrastructure

### Current Issues
- Tests fail due to missing dependencies or misconfiguration
- Integration tests have issues with ES modules

### Tasks
- [ ] Fix the integration test scripts to work with ES modules
- [ ] Add more comprehensive unit tests for core functionality
- [ ] Create proper test mocks for external dependencies
- [ ] Set up proper test fixtures for the file and PostgreSQL adapters
- [ ] Add GitHub Actions workflow for automated testing

## 5. Documentation Improvement

### Current Issues
- Some documentation has been removed in recent commits
- Usage examples might be outdated

### Tasks
- [ ] Create comprehensive README with up-to-date examples
- [ ] Add detailed API documentation for all public methods
- [ ] Create a troubleshooting guide for common issues
- [ ] Add documentation for Docker and Docker Compose usage
- [ ] Improve inline code documentation

## 6. Build Process Enhancements

### Current Issues
- Build process might not include all necessary files
- ESM modules require special handling

### Tasks
- [ ] Ensure build process correctly handles TypeScript to JavaScript conversion
- [ ] Add proper source map support
- [ ] Improve error reporting during build process
- [ ] Optimize build output size
- [ ] Add bundle analysis for production builds

## 7. Security Improvements

### Current Issues
- PostgreSQL connection strings might contain credentials
- Docker images might have unnecessary permissions

### Tasks
- [ ] Add environment variable sanitization
- [ ] Review file permissions in Docker containers
- [ ] Add input validation for all user-facing APIs
- [ ] Review error messages to prevent information leakage
- [ ] Add security headers for HTTP server

## 8. Configuration Management

### Current Issues
- Environment variable handling could be improved
- Configuration validation might be incomplete

### Tasks
- [ ] Use dotenv-safe to ensure required environment variables are present
- [ ] Add schema validation for configuration objects
- [ ] Support multiple configuration sources (env, file, CLI)
- [ ] Add configuration validation on startup
- [ ] Add support for configuration overrides

## Timeline

1. **Phase 1 (Immediate)** - Fix critical issues
   - Fix missing config.js issue
   - Fix Docker login detection
   - Update package.json to include all necessary files

2. **Phase 2 (Short-term)** - Improve code quality and testing
   - Refactor module organization
   - Enhance testing infrastructure
   - Improve build process

3. **Phase 3 (Medium-term)** - Enhance features and documentation
   - Improve documentation
   - Add security improvements
   - Enhance configuration management

4. **Phase 4 (Long-term)** - Future-proofing
   - Plan for next major release
   - Consider architectural improvements
   - Add advanced features

## Success Criteria

- Package can be installed and run with `npm install` and `npx`
- All tests pass locally and in CI
- Docker images build and run without errors
- Documentation is complete and accurate
- Security issues are addressed
- Configuration is flexible and validated 