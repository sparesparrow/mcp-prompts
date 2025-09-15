---
description: TypeScript development standards and best practices
globs: ["**/*.ts", "**/*.tsx"]
priority: 20
dependencies: ["01-base-agentic.rules.md", "01-base-devops.rules.md"]
---

# TypeScript Development Standards

## Core Principles

### Type Safety
- Use strict TypeScript configuration
- Avoid `any` type usage
- Leverage union types and generics

### Code Organization
- Follow modular design patterns
- Use proper file and folder structure
- Implement clean architecture principles

### Error Handling
- Use typed error handling
- Implement proper async/await patterns
- Provide meaningful error messages

## Code Standards

### Type Definitions
```typescript
// Good: Proper type definitions
interface UserData {
  id: string;
  name: string;
  roles: UserRole[];
}

type UserRole = 'admin' | 'user' | 'guest';

// Bad: Loose typing
interface BadUser {
  id: any; // ❌ Avoid any
  data: object; // ❌ Too generic
}
```

### Error Handling
```typescript
// Good: Typed error handling
class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      handleApiError(error);
    }
    throw new Error('Failed to fetch user');
  }
}

// Bad: Untyped error handling
async function badFetch(id: string) {
  try {
    return await api.get(id);
  } catch (e: any) { // ❌ Untyped error
    console.log(e);
  }
}
```

### Async Patterns
```typescript
// Good: Proper async handling
async function processData<T>(
  data: T[],
  processor: (item: T) => Promise<void>
): Promise<void> {
  await Promise.all(
    data.map(async (item) => {
      try {
        await processor(item);
      } catch (error) {
        handleProcessingError(error);
      }
    })
  );
}

// Bad: Poor async handling
async function badProcess(items: any[]) {
  for (const item of items) {
    await process(item); // ❌ Sequential processing
  }
}
```

## Validation Rules

```typescript
const TypeScriptRules = {
  // Enforce strict typing
  noExplicitAny: {
    pattern: /: any(?!\s*\/\/\s*allowed)/,
    message: "Avoid using 'any' type"
  },
  
  // Proper error handling
  typedErrorHandling: {
    pattern: /catch\s*\(error:\s*[A-Z][A-Za-z]+Error\)/,
    message: "Use typed error handling"
  },
  
  // Async/await usage
  asyncAwaitUsage: {
    pattern: /async\s+function.*try\s*{.*}\s*catch/,
    message: "Implement proper async/await error handling"
  }
};
```

## Configuration

### TSConfig Standards
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Best Practices

1. Type Definitions
   - Create interfaces for data structures
   - Use type aliases for unions
   - Leverage generics for reusability

2. Error Management
   - Create custom error classes
   - Use discriminated unions for errors
   - Implement proper error boundaries

3. Async Operations
   - Use Promise.all for parallel operations
   - Implement proper cancellation
   - Handle timeouts appropriately

## Security Considerations

1. Input Validation
   - Validate all external data
   - Use runtime type checking
   - Implement proper sanitization

2. Type Safety
   - Avoid type assertions
   - Use strict null checks
   - Implement proper access control

3. Error Exposure
   - Sanitize error messages
   - Implement proper logging
   - Control stack trace exposure 