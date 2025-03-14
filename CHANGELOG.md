# Changelog

## [1.2.20] - 2025-03-14

- Automated version bump



## [1.2.19] - 2024-03-16

### Fixed
- Fixed TypeScript errors in PostgresAdapter implementation
- Enhanced savePrompt method to properly return the created prompt
- Added updatePrompt method to the PostgresAdapter
- Fixed StorageAdapter interface to include listPrompts and clearAll methods
- Improved error handling in database-tools.ts for the clearAll method
- Enhanced health check endpoint with more detailed information

### Added
- Added better documentation and error handling for health check endpoint

## [1.2.18] - 2024-03-14

### Added
- Added HTTP server with health check endpoint
- Added Docker container health checks
- Added ESM module compatibility for Node.js 18-23+
- Enhanced database tools with better error handling

### Changed
- Improved Docker build process with multi-stage builds
- Streamlined configuration management
- Optimized PostgreSQL adapter connection handling
- Updated dependencies to latest versions

### Fixed
- Fixed issues with file adapter on certain file systems
- Improved error messages for better debugging
- Fixed template variable extraction

## [1.2.17] - 2025-03-14

- Automated version bump



## [1.2.16] - 2025-03-14

- Automated version bump



## [1.2.15] - 2025-03-14

- Automated version bump



## [1.2.13] - 2025-03-14

- Automated version bump



## [1.2.12] - 2025-03-14

- Automated version bump



## [1.2.11] - 2025-03-14

- Automated version bump



## [1.2.10] - 2025-03-14

- Automated version bump



## [1.2.6] - 2025-03-14

- Automated version bump



## [1.2.5] - 2025-03-14

- Automated version bump



## [1.2.4] - 2025-03-14

- Automated version bump



## [1.2.3] - 2025-03-14

- Automated version bump



## [1.2.2] - 2025-03-14

- Automated version bump



## [1.2.1] - 2025-03-14

- Automated version bump



All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2025-03-14

### Changed
- Reorganized codebase structure for better maintainability
- Moved Docker-related files to `docker/` directory
- Moved build scripts to `scripts/build/` directory
- Moved test scripts to `scripts/test/` directory
- Moved integration tests to `tests/integration/` directory
- Moved SDK tests to `tests/sdk/` directory
- Updated GitHub workflows to use new file paths
- Updated Docker Compose configuration to use new file paths
- Added comprehensive development documentation

### Added
- Created `README-DEVELOPMENT.md` with detailed development instructions
- Created `RELEASE_CHECKLIST.md` for release preparation
- Added `CHANGELOG.md` to track changes

### Removed
- Removed duplicate and redundant files
- Removed incomplete scripts

## [1.1.16] - 2025-03-05

### Added
- Initial release with basic functionality

## [1.1.15] - 2025-03-14

- Automated version bump



## [1.1.14] - 2025-03-14

- Automated version bump



## [1.1.13] - 2025-03-14

- Automated version bump



## [1.1.12] - 2025-03-14

- Automated version bump



## [1.3.0] - 2024-03-07

### Added
- Implemented simplified architecture following SOLID principles
- Added unified core types in a single file
- Implemented focused storage adapters
- Created streamlined prompt service
- Added streamlined MCP server implementation with tools
- Added Docker and Docker Compose integration for easier deployment

### Changed
- Completely refactored codebase for simplicity and maintainability
- Reduced file count and complexity
- Improved error handling with proper types
- Updated imports to use .js extensions for ESM compatibility
- Simplified configuration management
- Made Docker configuration more flexible

### Removed
- Removed complex CLI interface in favor of focused MCP tools
- Removed unnecessary utilities and functions
- Removed legacy scripts and pipeline tools

## [1.1.0] - 2024-03-01

### Added
- PGAI vector search for semantic prompt discovery
- Support for embeddings in PostgreSQL
- Improved prompts collection with professional templates
- Batch processing capabilities for prompt collections

### Changed
- Enhanced prompt processing pipeline
- Improved command-line interface with more options
- Better error handling and validation

## [1.0.0] - 2024-02-15

### Added
- Initial release of MCP Prompts Server
- Basic prompt management capabilities (add, edit, get, list, delete)
- Template variable substitution
- Tag-based organization
- File-based storage
- Import/export functionality
- MCP protocol compatibility