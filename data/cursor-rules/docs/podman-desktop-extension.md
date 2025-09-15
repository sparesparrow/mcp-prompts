# Podman Desktop Extension Rules Planning

## Overview
This document outlines the structure and organization of Cursor rules for Podman Desktop extension development. Rules will be stored in `.cursor/rules/` and will help guide AI-assisted development.

## Rule Categories and Files

### 1. TypeScript Core Rules
**File:** `typescript-core.md`
**Description:** Core TypeScript development guidelines for Podman Desktop extensions
**Globs:** `["src/**/*.ts", "src/**/*.tsx"]`
**Key Areas:**
- Type safety requirements
- Import/export conventions
- File organization principles
- Naming conventions
- Error handling patterns

### 2. Extension API Rules
**File:** `extension-api.md`
**Description:** Guidelines for using the Podman Desktop extension API
**Globs:** `["src/extension.ts", "src/**/provider.ts"]`
**Key Areas:**
- Extension lifecycle management
- Provider implementation patterns
- API usage best practices
- Event handling
- Context management

### 3. Build Configuration Rules
**File:** `build-config.md`
**Description:** Rules for build configuration and tooling setup
**Globs:** `["vite.config.ts", "tsconfig.json", "package.json"]`
**Key Areas:**
- Build tool configuration
- TypeScript compiler settings
- Dependency management
- Bundle optimization

### 4. Testing Rules
**File:** `testing.md`
**Description:** Testing standards and practices for extensions
**Globs:** `["src/**/*.test.ts", "src/**/*.spec.ts"]`
**Key Areas:**
- Test structure and organization
- Mock and stub patterns
- Coverage requirements
- Testing utilities

### 5. Provider Implementation Rules
**File:** `provider-impl.md`
**Description:** Specific rules for implementing providers in extensions
**Globs:** `["src/**/provider/**/*.ts"]`
**Key Areas:**
- Provider status management
- Connection handling
- Resource cleanup
- Error recovery

### 6. Command Implementation Rules
**File:** `commands.md`
**Description:** Guidelines for implementing extension commands
**Globs:** `["src/**/commands/**/*.ts"]`
**Key Areas:**
- Command registration
- Parameter handling
- Error handling
- User feedback

### 7. UI Component Rules
**File:** `ui-components.md`
**Description:** Rules for UI component development
**Globs:** `["src/**/*.tsx", "src/**/components/**/*.ts"]`
**Key Areas:**
- Component structure
- State management
- Event handling
- Accessibility

## Implementation Plan

1. Create `.cursor/rules/` directory structure
2. Implement each rule file with detailed guidelines
3. Add rule-specific examples and patterns
4. Include cross-references between related rules
5. Add validation and testing guidelines

## Next Steps

1. Create the base directory structure
2. Implement TypeScript core rules (most fundamental)
3. Implement Extension API rules (critical for functionality)
4. Progress through remaining rule categories

