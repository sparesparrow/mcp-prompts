# Tests for MCP Prompts Server

This directory contains tests for the MCP Prompts Server functionality.

## Test Overview

The tests in this directory focus on verifying the core functionality of the prompt management system, including:

- Saving and loading prompts
- Template variable substitution
- Error handling for non-existent prompts
- Validation logic

## Running Tests

Run the tests using:

```bash
npm run test
```

Or run the CI version (which compiles first):

```bash
npm run test:ci
```

## Test Structure

Tests are organized as follows:

- **promptServer.test.ts**: Tests for the core prompt storage and retrieval functions
- Additional test files to be added for specific functionality

## Test Environment

Tests run in an isolated environment with a separate test directory to avoid affecting actual prompt data.

## Adding New Tests

When adding new tests:

1. Create new test files in this directory
2. Follow the existing test pattern (setup, test cases, assertions, cleanup)
3. Add the test to the npm scripts in package.json if needed 