# Cursor Rules: @mcp-prompts/adapters-mdc

## Code Style & Formatting
- Use TypeScript strict mode (see tsconfig)
- Prefer named exports; avoid default exports
- Use `import type` for type-only imports
- Format imports: external, then internal, then types
- Use Prettier for formatting (auto on save)

## Build & Module System
- Module type: NodeNext (ESM)
- Build with `pnpm build` (uses tsc or SWC)
- Output: ESM, with type declarations
- No CommonJS output

## Package Management
- Use pnpm for all dependency management
- No `package-lock.json` or `yarn.lock`
- All dependencies must be declared in package.json

## Testing
- Use Vitest for unit/integration tests
- Test files: `*.test.ts` in `tests/`
- Run tests with `pnpm test` or `pnpm -F @mcp-prompts/adapters-mdc test`

## Debugging
- Use VS Code launch configs or `node --inspect`
- Source maps enabled for all builds

## Import Conventions
- Use package root imports for internal modules (e.g., `@mcp-prompts/adapters-mdc`)
- No relative imports across package boundaries

## Adapter-Specific Rules
- Integrates with MDC templating engine
- All template rendering must be robust and validated
- No business logic: only templating concerns

--- 