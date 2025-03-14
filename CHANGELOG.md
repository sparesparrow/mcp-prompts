# Changelog

## [1.1.12] - 2025-03-14

- Automated version bump



## [Unreleased] - Coming Soon
### Added
- Added version compatibility check for Node.js
- New build and Docker test scripts for better quality assurance
- Integrated tsc-esm-fix for automatic .js extension handling
- Added Node.js compatibility section to documentation

### Fixed
- Fixed CommonJS module imports for PostgreSQL client in ESM context
- Corrected import statements for MCP SDK to include .js extensions
- Fixed Docker container initialization
- Improved build process to handle ESM compatibility issues
- Enhanced publish script with comprehensive checks

### Changed
- Updated build process for better Node.js version compatibility
- Improved error reporting in build scripts
- Enhanced Docker container configuration

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

## [1.2.0] - 2024-03-06

### Added
- PostgreSQL integration for centralized prompt storage
- Added 'category' field for better prompt organization
- Usage analytics tracking with 'usage_count' and 'last_used' fields
- New 'prompt_analytics' tool for viewing prompt usage statistics
- Category filtering in 'list_prompts' tool
- Comprehensive setup script for database initialization
- Docker and Docker Compose support with PostgreSQL
- Detailed documentation on categories and analytics features
- Integration tests for category and analytics functionality

### Changed
- Migrated storage from file-based to PostgreSQL
- Improved error messages with helpful suggestions
- Enhanced security with SSL support for database connections
- Updated all MCP tools to use the standard response format
- Improved error handling with more detailed logs

### Fixed
- Fixed inconsistent response formats across tools
- Improved error handling in asynchronous operations
- Added proper type assertions in test files

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