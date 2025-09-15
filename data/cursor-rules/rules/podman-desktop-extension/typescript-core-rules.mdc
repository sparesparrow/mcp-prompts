---
description: Core TypeScript development guidelines for Podman Desktop extensions
globs: ["src/**/*.ts", "src/**/*.tsx"]
---

# TypeScript Core Development Rules

## Type Safety

### Strict Type Checking
- Enable strict type checking in tsconfig.json
- Avoid usage of `any` type
- Use explicit return types for functions
- Enable strict null checks

### Type Declarations
```typescript
// DO
interface ProviderOptions {
  name: string;
  id: string;
  status: ProviderStatus;
  images: {
    icon: string;
    logo: string;
  };
}

// DON'T
type ProviderOptions = {
  name: any;
  id: any;
  status: any;
  images: any;
};
```

### Null and Undefined
- Use optional parameters instead of null/undefined
- Implement null checks where required
```typescript
// DO
function getProviderStatus(provider?: Provider): ProviderStatus {
  return provider?.status ?? 'unknown';
}

// DON'T
function getProviderStatus(provider: Provider | null): ProviderStatus {
  if (provider === null) {
    return 'unknown';
  }
  return provider.status;
}
```

## Code Organization

### File Structure
- One class/interface per file
- Use index.ts files for exports
- Group related functionality in directories
```
src/
  ├── extension.ts
  ├── provider/
  │   ├── index.ts
  │   ├── provider.ts
  │   └── types.ts
  ├── commands/
  │   ├── index.ts
  │   └── hello-world.ts
  └── utils/
      ├── index.ts
      └── status-helpers.ts
```

### Import/Export Conventions
```typescript
// DO
export { Provider } from './provider';
export type { ProviderOptions } from './types';

// DON'T
export * from './provider';
```

## Error Handling

### Async Operations
- Use try/catch blocks for async operations
- Provide meaningful error messages
```typescript
// DO
async function activateProvider(): Promise<void> {
  try {
    await provider.start();
  } catch (error) {
    throw new Error(`Failed to activate provider: ${error.message}`);
  }
}

// DON'T
async function activateProvider(): Promise<void> {
  await provider.start();
}
```

### Error Types
- Define custom error types for specific failures
```typescript
class ProviderActivationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ProviderActivationError';
  }
}
```

## Naming Conventions

### Files and Directories
- Use kebab-case for files: `hello-world.ts`
- Use camelCase for directories: `providers/`
- Use `.ts` extension for TypeScript files
- Use `.tsx` extension for React components

### Variables and Functions
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use ALL_CAPS for constants
```typescript
// DO
const defaultTimeout = 3000;
function activateProvider() {}
class ProviderManager {}
interface ProviderOptions {}
const MAX_RETRIES = 3;

// DON'T
const DefaultTimeout = 3000;
function Activate_Provider() {}
class providerManager {}
```

## Documentation

### JSDoc Comments
- Add JSDoc comments for public APIs
- Include parameter and return type descriptions
- Document thrown errors
```typescript
/**
 * Activates the provider with the given options
 * @param options - Configuration options for the provider
 * @throws {ProviderActivationError} When activation fails
 * @returns Promise that resolves when activation is complete
 */
async function activateProvider(options: ProviderOptions): Promise<void> {
  // Implementation
}
```

## Best Practices

### Immutability
- Use readonly for properties that shouldn't change
- Use const for variable declarations
```typescript
// DO
interface ProviderConfig {
  readonly id: string;
  readonly name: string;
}

// DON'T
interface ProviderConfig {
  id: string;
  name: string;
}
```

### Null Coalescing
- Use null coalescing operator (??) instead of OR (||)
```typescript
// DO
const status = provider?.status ?? 'unknown';

// DON'T
const status = provider?.status || 'unknown';
```

### Async/Await
- Use async/await instead of .then()
- Always handle errors in async operations
```typescript
// DO
async function initializeProvider(): Promise<void> {
  try {
    await provider.initialize();
    await provider.connect();
  } catch (error) {
    // Handle error
  }
}

// DON'T
function initializeProvider(): Promise<void> {
  return provider.initialize()
    .then(() => provider.connect())
    .catch(error => {
      // Handle error
    });
}
```

## Extension-Specific Guidelines

### Provider Implementation
- Implement cleanup in deactivate function
- Register disposables with extension context
```typescript
export function activate(context: ExtensionContext): void {
  const provider = createProvider();
  context.subscriptions.push(provider);
}

export function deactivate(): void {
  // Cleanup will be handled automatically
}
```

### Resource Management
- Always dispose of resources
- Use extension context for registration
```typescript
// DO
const disposable = commands.registerCommand('my.command', () => {});
context.subscriptions.push(disposable);

// DON'T
commands.registerCommand('my.command', () => {});
```
