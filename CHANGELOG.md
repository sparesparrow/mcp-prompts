# Changelog

## [1.1.0] - 2025-03-05

### Code Structure Improvements
- Consolidated utility functions with storage module to reduce file count
- Removed redundant utils directory
- Fixed server.connect method in main file
- Streamlined the project structure

### Script Organization
- Renamed npm scripts with consistent `prompt:` prefix convention
- Organized scripts into logical groups
- Added shorthand commands for common operations
- Improved script documentation

### Configuration Updates
- Enhanced tsconfig.json with better TypeScript options
- Updated .gitignore to be more comprehensive
- Restructured package.json with cleaner organization
- Added rimraf for cross-platform directory cleanup

### Testing Improvements
- Added basic unit tests for core functionality
- Created test directory structure
- Added test README with documentation
- Ensured CI pipeline tests include export/import features

### Documentation
- Added detailed README files in key directories
- Updated main README with new command names
- Added comprehensive descriptions for all features
- Created this changelog file to track project history

### CI/CD Pipeline
- Added GitHub Actions workflow for CI
- Set up automated testing for Node 18 and 20
- Added package generation for releases
- Improved linting checks

## [1.0.0] - 2025-03-04

Initial release of the MCP Prompts Server with:

- Basic prompt storage and retrieval
- Template variable substitution
- Raw prompt processing
- Import/export functionality
- Tag management
- Folder organization 