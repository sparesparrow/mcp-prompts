# MCP Prompt Manager Release Checklist

This checklist ensures that all necessary steps are completed before releasing a new version of the MCP Prompt Manager.

## Pre-Release Preparation

### Code Quality
- [ ] All TypeScript errors are resolved
- [ ] Code linting passes with no errors
- [ ] Code is properly formatted according to project standards
- [ ] All `TODO` and `FIXME` comments are addressed or documented in issues

### Testing
- [ ] Unit tests pass (`npm test`)
- [ ] Integration tests pass (`npm run test:integration`)
- [ ] Build test passes (`npm run test:build`)
- [ ] Docker build test passes (`npm run test:docker`)
- [ ] Package installation test passes (`npm run test:package`)

### Documentation
- [ ] README is up-to-date with the latest features and changes
- [ ] Code documentation (JSDoc/TSDoc) is complete
- [ ] Usage examples are updated
- [ ] CHANGELOG is updated with all notable changes
- [ ] API documentation is generated and up-to-date

## Release Process

### Version Update
- [ ] Update version in `package.json` according to semantic versioning
- [ ] Ensure dependencies are up-to-date
- [ ] Update any version references in documentation

### Build Verification
- [ ] Clean build succeeds (`npm run build`)
- [ ] Build package is properly structured
- [ ] ESM imports are correctly handled

### Publishing
- [ ] Create a git tag for the new version
- [ ] Push changes and tag to GitHub
- [ ] Publish to npm (`npm publish`)
- [ ] Build and push Docker image (`npm run docker:build`)

### Post-Release Verification
- [ ] Verify installation from npm (`npm install -g @sparesparrow/mcp-prompts`)
- [ ] Verify package can be run with npx (`npx @sparesparrow/mcp-prompts`)
- [ ] Verify Docker image works as expected (`docker run sparesparrow/mcp-prompts:latest`)
- [ ] Verify integration with Claude Desktop

## Release Notes

### v1.1.3 (Example)
- New Features:
  - [ ] Project orchestration capabilities
  - [ ] Database export/import tools
  - [ ] Backup and restore functionality

- Bug Fixes:
  - [ ] Fixed TypeScript errors in FileAdapter
  - [ ] Fixed version handling in updatePrompt
  - [ ] Fixed HTTP transport import error

- Improvements:
  - [ ] Reorganized codebase structure
  - [ ] Enhanced error handling
  - [ ] Updated README with comprehensive usage examples

## Final Approval

- [ ] All tests pass in CI/CD pipeline
- [ ] Documentation is accurate and complete
- [ ] Release notes are comprehensive
- [ ] Package functions as expected in all supported environments 