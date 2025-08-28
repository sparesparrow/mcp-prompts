# MCP Prompts Core Package Rules

## 🎯 **Doménová logika - čistota**

### **Zásady**
- **Žádné závislosti na konkrétních adaptérech**
- **Pouze standardní TypeScript knihovny a doménové kontrakty**
- **Použití dependency injection patternů**
- **Business logika je izolovaná a testovatelná**
- **Hexagonální architektura - core je centrum**

## 📁 **Struktura modulů**

```
src/
├── entities/          # Doménové entity (Prompt, Template, Category)
│   ├── prompt.entity.ts
│   ├── template.entity.ts
│   └── category.entity.ts
├── ports/            # Rozhraní (IPromptRepository, ITemplatingEngine)
│   ├── prompt.repository.port.ts
│   ├── templating.port.ts
│   └── event.publisher.port.ts
├── services/         # Doménové služby
│   ├── prompt.service.ts
│   ├── template.service.ts
│   └── validation.service.ts
├── use-cases/        # Business logika (addPrompt, getPromptById, listPrompts)
│   ├── addPrompt/
│   ├── getPromptById/
│   └── listPrompts/
├── validation/       # Zod schémata a validace
│   ├── prompt.schema.ts
│   ├── template.schema.ts
│   └── common.schemas.ts
├── types/            # TypeScript typy a interfaces
│   ├── prompt.types.ts
│   ├── template.types.ts
│   └── common.types.ts
├── utils/            # Pomocné funkce
│   ├── id.generator.ts
│   ├── date.utils.ts
│   └── validation.utils.ts
└── index.ts          # Hlavní export
```

## 🔧 **Import pravidla**

### **Povolené importy**
- ✅ Standardní TypeScript knihovny
- ✅ Zod pro validaci
- ✅ Utility knihovny (uuid, date-fns)
- ✅ Doménové kontrakty z `@sparesparrow/mcp-prompts-contracts`

### **Zakázané importy**
- ❌ Importy z adapter balíčků
- ❌ Framework-specific kód
- ❌ Infrastrukturní závislosti
- ❌ I/O operace

### **Import struktura**
```typescript
// 1. External libraries
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// 2. Internal modules
import { Prompt } from './entities/prompt.entity.js';
import type { IPromptRepository } from './ports/prompt.repository.port.js';

// 3. Types
import type { CreatePromptParams } from './types/prompt.types.js';
```

## 🧪 **Testovací přístup**

### **Test framework**
- **Vitest** pro unit testy
- **Mock všech externích závislostí**
- **Testování business logiky v izolaci**
- **Coverage > 90%**

### **Test struktura**
```
tests/
├── unit/
│   ├── entities/
│   ├── services/
│   └── use-cases/
├── integration/
│   └── ports/
├── fixtures/
│   ├── prompts.fixture.ts
│   └── templates.fixture.ts
└── mocks/
    ├── repository.mock.ts
    └── templating.mock.ts
```

### **Test příklady**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { PromptService } from '../src/services/prompt.service.js';
import { MockPromptRepository } from './mocks/repository.mock.js';

describe('PromptService', () => {
  it('should create prompt with valid data', async () => {
    const mockRepo = new MockPromptRepository();
    const service = new PromptService(mockRepo);
    
    const result = await service.createPrompt({
      name: 'Test Prompt',
      content: 'Test content'
    });
    
    expect(result.name).toBe('Test Prompt');
  });
});
```

## 📦 **Build konfigurace**

### **Build tools**
- **SWC** pro rychlý JavaScript build
- **TypeScript** pro type declarations
- **Composite build** pro monorepo podporu
- **Exports pro všechny use-cases**

### **Package.json exports**
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./entities": "./dist/entities/index.js",
    "./ports": "./dist/ports/index.js",
    "./services": "./dist/services/index.js",
    "./use-cases": "./dist/use-cases/index.js"
  }
}
```

## 🚫 **Co NEDĚLAT**

- ❌ Importovat z adapter balíčků
- ❌ Používat framework-specific kód
- ❌ Přidávat infrastrukturní závislosti
- ❌ Míchat doménovou logiku s I/O operacemi
- ❌ Používat console.log (použij Pino logger)
- ❌ Hardcodovat business rules

## ✅ **Co DĚLAT**

- ✅ Implementovat čisté doménové entity
- ✅ Definovat jasná rozhraní (porty)
- ✅ Používat dependency injection
- ✅ Psát testovatelnou business logiku
- ✅ Validovat vstupy pomocí Zod
- ✅ Používat value objects pro doménové koncepty
- ✅ Implementovat domain events pro side effects

## 🔄 **Domain Events**

### **Event struktura**
```typescript
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export class PromptCreatedEvent implements DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly data: { name: string; author: string }
  ) {}
}
```

## 📋 **Code Quality**

### **TypeScript**
- Strict mode povinný
- No explicit any
- Proper error handling
- Comprehensive type definitions

### **Error handling**
```typescript
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
```

---

*Core package implementuje čistou doménovou logiku podle hexagonální architektury.* 