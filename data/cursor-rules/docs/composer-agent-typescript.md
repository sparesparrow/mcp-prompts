Here's the optimized implementation of modular LLM agent rules for Cursor IDE Composer:

```
.cursor/
└── rules/
    ├── 01-base.rules.md
    ├── 02-typescript.rules.md
    ├── 03-react.rules.md
    ├── 04-composer.rules.md
    ├── 05-security.rules.md
    └── 06-cicd.rules.md
```

**1. 01-base.rules.md** - Foundational standards
```markdown
---
description: Core development practices for all project files
globs: ["**/*"]
---

# Base Development Standards

## Project Structure
```
src/
  features/    # Feature modules with DDD
  services/    # Business logic
  types/       # Type definitions
  utils/       # Reusable utilities
```

## Code Quality
- 100 character line limit
- Kebab-case filenames (except components)
- Colocated test files (*.test.ts)

## Version Control
```bash
# Conventional commit example
feat(composer): add template validation
fix(security): patch XSS vulnerability
```

**2. 02-typescript.rules.md** - Type-specific validation
```markdown
---
description: TypeScript standards for MCP extensions
globs: ["extensions/*/src/**/*.ts"]
---

# TypeScript Rules

## Type Safety
```typescript
// Strict interface definitions
interface ComposerEndpoint {
  path: string;
  validate: (code: string) => boolean;
}

// Forbidden pattern
declare var unsafe: any; // ❌ No explicit 'any'
```

## Decorator Standards
```typescript
@MCPEndpoint({
  path: '/generate',
  securityLevel: SecurityLevel.HIGH
})
async handleGeneration(request: ComposerRequest) {
  // Implementation with type safety
}
```

**3. 03-react.rules.md** - Component-specific rules
```markdown
---
description: React component guidelines
globs: ["src/components/**/*.tsx"]
---

# React Component Standards

## Component Structure
```typescript
interface CodePreviewProps {
  code: string;
  language: 'tsx' | 'python';
}

const CodePreview = memo(({ code, language }: CodePreviewProps) => (
  <SyntaxHighlighter language={language}>
    {code}
  </SyntaxHighlighter>
));
```

## Hooks Management
```typescript
// Custom hook convention
function useCodeGenerator() {
  // Hook logic
}

// Invalid pattern
if (loading) useEffect(() => {...}) // ❌ Conditional hooks
```

**4. 04-composer.rules.md** - AI codegen governance
```markdown
---
description: LLM code generation rules
globs: [".cursor/**/*", "**/*.composer.json"]
---

# Composer Agent Rules

## Generation Constraints
```json
{
  "validation": {
    "maxComplexity": 12,
    "allowedImports": ["react", "vue"],
    "securityScan": {
      "required": true,
      "level": "strict"
    }
  }
}
```

## Template Management
```typescript
interface GenerationTemplate {
  framework: 'react' | 'vue';
  styleGuide: string;
  validationRules: string[];
}
```

**5. 05-security.rules.md** - Security requirements
```markdown
---
description: Security standards for all components
globs: ["**/*"]
---

# Security Rules

## Input Sanitization
```typescript
const SANITIZE_REGEX = /[<>"'`$\\]/g;

function cleanInput(input: string): string {
  return input.replace(SANITIZE_REGEX, '');
}
```

## Container Security
```dockerfile
# Rootless Podman example
USER 1000:1000
CMD ["podman", "run", "--user", "nonroot"]
```

**6. 06-cicd.rules.md** - Deployment pipeline standards
```markdown
---
description: CI/CD pipeline requirements
globs: [".github/**/*", "Dockerfile*"]
---

# CI/CD Standards

## Container Builds
```dockerfile
# Multi-stage security build
FROM python:3.11-slim as builder
# ... build steps
FROM gcr.io/distroless/python3
COPY --from=builder /app /app
USER 1000:1000
```

## Pipeline Security
```yaml
- name: Vulnerability Scan
  run: |
    cursor security scan \
      --severity critical \
      --fail-on cvss>=7.0
```

This implementation provides:

1. **Precise Targeting**: Rules activate only for matching file patterns (e.g., React rules only for TSX components)
2. **Layered Governance**: Base → Framework → Domain-specific rules
3. **Security Integration**: Universal security requirements with context-specific hardening
4. **Maintainability**: Independent rule files with clear responsibility boundaries
5. **IDE Integration**: Cursor Composer Agent can efficiently apply relevant rules based on active file context

The numeric prefix ensures proper rule priority when multiple rules apply to the same file path. Each rule file contains both human-readable guidelines and machine-enforceable patterns for automated validation.

