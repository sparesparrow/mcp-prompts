# MCP Prompts Server - Consolidation Plan

This document outlines the plan for further code consolidation and cleanup to reduce the number of files in the project and improve maintainability.

## Completed Consolidation

✅ Created unified `src/core/prompt-management.ts` module that combines:
- Import functionality
- Export functionality
- Raw prompt processing
- Tag management

✅ Created unified CLI tool in `bin/prompt-cli.ts`

✅ Updated package.json scripts to use the new consolidated tools

✅ Removed legacy script files:
- `scripts/import_prompts.js`
- `scripts/export_prompts.js`
- `scripts/process_prompts.js`
- `scripts/manage_tags.js`

✅ Updated prompt-pipeline.js to use the consolidated CLI tools

✅ Created Docker and container setup with docker-compose.yml

✅ Added PGAI database integration with migration and verification tools

✅ Updated documentation to reflect new command structure

✅ Removed references to legacy scripts in all documentation

## Next Steps for Consolidation

### Phase 1: Consolidate Remaining Script Functionality

- ✅ Move `organize_prompts.js` functionality into core module
- ✅ Move `prompt-pipeline.js` functionality into core module
- ✅ Remove the scripts directory entirely

### Phase 2: Streamline Shell Scripts

- [x] Consolidated `build.sh`, `build-and-install.sh`, etc. into a single build utility (`build-tools.js`)
- [x] Updated documentation to reflect new simplified build process

### Phase 3: Improve TypeScript Configuration

- ✅ Simplify `tsconfig.json` 
- ✅ Ensure all code is properly typed
- [ ] Add more comprehensive tests

### Phase 4: Regular Maintenance

For ongoing maintenance, follow these steps:

1. **Regular Rebuilds**
   ```bash
   npm run build
   ```

2. **Update Documentation**
   - Keep README.md up to date with any changes
   - Update CHANGELOG.md for each release

3. **Clean Unused Code**
   - Regularly check for and remove unused code
   - Consider regular audits with tools like `depcheck`

4. **Git Workflow**
   ```bash
   # Before committing
   npm run lint
   npm run test
   
   # Commit and push
   git add .
   git commit -m "Meaningful commit message"
   git push origin main
   ```

## Benefits of Consolidation

- **Reduced File Count**: Fewer files to navigate and maintain
- **Improved Developer Experience**: Consolidated core functionality makes the code easier to understand
- **Better TypeScript Integration**: More consistent typing throughout the codebase
- **Simplified CLI**: One tool to rule them all
- **Easier Maintenance**: Less code duplication means fewer bugs and easier updates
- **Docker Integration**: Easy deployment with Docker and PostgreSQL 