# @sparesparrow/mcp-prompts-core

Doménová logika, porty, entity a use-casy pro MCP Prompts server.

## 🎯 **Účel**

Core balíček obsahuje čistou doménovou logiku bez závislostí na konkrétních implementacích:
- **Entities** - doménové objekty (Prompt, Template, Category)
- **Ports** - rozhraní pro adaptéry (IPromptRepository, ITemplatingEngine)
- **Use Cases** - business logika (addPrompt, getPromptById, listPrompts)
- **Validation** - Zod schémata a validace

## 🏗️ **Struktura**

```
src/
├── entities/          # Doménové entity
├── ports/            # Rozhraní (porty)
├── use-cases/        # Business logika
├── validation/       # Zod schémata
├── types/            # TypeScript typy
├── utils/            # Pomocné funkce
└── index.ts          # Hlavní export
```

## 📦 **Instalace**

```bash
pnpm add @sparesparrow/mcp-prompts-core
```

## 🔧 **Použití**

```typescript
import { PromptService } from '@sparesparrow/mcp-prompts-core';
import type { IPromptRepository, ITemplatingEngine } from '@sparesparrow/mcp-prompts-core';

// Implementace portů
class MyPromptRepository implements IPromptRepository {
  // ...
}

// Použití
const promptService = new PromptService(
  new MyPromptRepository(),
  new MyTemplatingEngine()
);
```

## 🧪 **Testování**

```bash
# Spustit testy
pnpm test

# Testy s watch mode
pnpm test:watch

# Type checking
pnpm typecheck
```

## 🚀 **Build**

```bash
# Build
pnpm build

# Build s watch mode
pnpm build:watch

# Clean
pnpm clean
```

## 📋 **Požadavky**

- Node.js >= 20.0.0
- TypeScript >= 5.8.0
- pnpm >= 9.0.0
