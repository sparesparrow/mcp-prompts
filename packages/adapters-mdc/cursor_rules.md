<<<<<<< Updated upstream
# MCP Prompts MDC Adapter Rules

## 🎯 **Účel & Role**

### **Hexagonální architektura**
- **Secondary/Driven Adapter** - implementuje porty definované v core
- **Žádná business logika** - pouze infrastrukturní implementace
- **MDC (Model Context Protocol) parser** pro prompt soubory
- **Round-trip konverze** mezi MDC a JSON formáty

## 📁 **Struktura modulů**

```
src/
├── mdc/              # MDC parsing a serializace
│   ├── parser.ts     # MDC → JSON parser
│   ├── serializer.ts # JSON → MDC serializer
│   └── validator.ts  # MDC syntax validace
├── adapters/         # Implementace core portů
│   ├── mdc.repository.ts    # IPromptRepository implementace
│   └── mdc.templating.ts    # ITemplatingEngine implementace
├── types/            # MDC-specific typy
│   ├── mdc.types.ts  # MDC AST typy
│   └── parser.types.ts # Parser výsledky
├── utils/            # Pomocné funkce
│   ├── file.utils.ts # File I/O operace
│   └── mdc.utils.ts  # MDC utility funkce
└── index.ts          # Hlavní export
```

## 🔧 **Import pravidla**

### **Povolené importy**
- ✅ **Core package** - `@sparesparrow/mcp-prompts-core`
- ✅ **MDC parsing knihovny** - pro MDC syntax
- ✅ **File system knihovny** - pro I/O operace
- ✅ **Utility knihovny** - lodash, ramda

### **Zakázané importy**
- ❌ **Business logika** - žádné doménové entity
- ❌ **Framework-specific kód** - žádné Express, Fastify
- ❌ **Database drivers** - pouze přes core porty

### **Import struktura**
```typescript
// 1. Core package (ports a typy)
import type { IPromptRepository, Prompt } from '@sparesparrow/mcp-prompts-core';
import type { CreatePromptParams } from '@sparesparrow/mcp-prompts-core';

// 2. External libraries
import { parseMDC, serializeMDC } from 'mdc-parser';

// 3. Internal modules
import { MDCParser } from './mdc/parser.js';
import { MDCRepository } from './adapters/mdc.repository.js';
```

## 🧪 **Testovací přístup**

### **Test framework**
- **Vitest** pro unit testy
- **Integration tests** s real MDC soubory
- **Round-trip tests** (MDC → JSON → MDC)
- **Error handling tests** pro invalid MDC

### **Test struktura**
```
tests/
├── unit/
│   ├── mdc/
│   │   ├── parser.test.ts
│   │   └── serializer.test.ts
│   └── adapters/
│       └── mdc.repository.test.ts
├── integration/
│   ├── mdc.roundtrip.test.ts
│   └── file.operations.test.ts
├── fixtures/
│   ├── valid.mdc
│   ├── invalid.mdc
│   └── complex.mdc
└── mocks/
    └── file.system.mock.ts
```

### **Test příklady**
```typescript
import { describe, it, expect } from 'vitest';
import { MDCParser } from '../src/mdc/parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('MDC Parser', () => {
  it('should parse valid MDC file', () => {
    const mdcContent = readFileSync(
      join(__dirname, 'fixtures/valid.mdc'), 
      'utf-8'
    );
    
    const result = MDCParser.parse(mdcContent);
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('prompts');
  });

  it('should handle invalid MDC syntax', () => {
    const invalidMDC = 'invalid {{ syntax }';
    
    const result = MDCParser.parse(invalidMDC);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid syntax');
  });
});
```

## 📦 **Build konfigurace**

### **Build tools**
- **SWC** pro rychlý JavaScript build
- **TypeScript** pro type declarations
- **Composite build** pro monorepo podporu

### **Package.json exports**
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./mdc": "./dist/mdc/index.js",
    "./adapters": "./dist/adapters/index.js"
  }
}
```

## 🔄 **MDC Parser Implementace**

### **Parser interface**
```typescript
export interface MDCParserResult {
  success: boolean;
  data?: MDCDocument;
  error?: string;
  warnings?: string[];
}

export interface MDCDocument {
  version: string;
  prompts: MDCPrompt[];
  metadata: Record<string, unknown>;
}

export interface MDCPrompt {
  name: string;
  content: string;
  variables: string[];
  tags: string[];
  metadata: Record<string, unknown>;
}
```

### **Parser implementace**
```typescript
export class MDCParser {
  static parse(content: string): MDCParserResult {
    try {
      // MDC parsing logic
      const tokens = this.tokenize(content);
      const ast = this.buildAST(tokens);
      const document = this.buildDocument(ast);
      
      return {
        success: true,
        data: document
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static tokenize(content: string): MDCToken[] {
    // Tokenization logic
  }

  private static buildAST(tokens: MDCToken[]): MDCAST {
    // AST building logic
  }
}
```

## 🚫 **Co NEDĚLAT**

- ❌ Implementovat business logiku
- ❌ Validovat doménová pravidla
- ❌ Používat framework-specific kód
- ❌ Hardcodovat file paths
- ❌ Ignorovat error handling

## ✅ **Co DĚLAT**

- ✅ Implementovat core porty přesně
- ✅ Robustní error handling
- ✅ Comprehensive MDC parsing
- ✅ Round-trip testy
- ✅ Performance optimalizace
- ✅ Logging všech operací

## 📋 **Code Quality**

### **Error handling**
```typescript
export class MDCParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    public readonly context: string
  ) {
    super(`MDC Parse Error at ${line}:${column}: ${message}`);
    this.name = 'MDCParseError';
  }
}
```

### **Logging**
```typescript
import { logger } from '@sparesparrow/mcp-prompts-core';

export class MDCRepository implements IPromptRepository {
  async getPrompt(id: string): Promise<Prompt | null> {
    logger.info('Fetching prompt from MDC', { id });
    
    try {
      // Implementation
      logger.debug('Prompt fetched successfully', { id });
      return prompt;
    } catch (error) {
      logger.error('Failed to fetch prompt from MDC', { id, error });
      throw error;
    }
  }
}
```

---

*MDC Adapter implementuje MDC parsing a serializaci pro MCP Prompts.* 
=======
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
>>>>>>> Stashed changes
