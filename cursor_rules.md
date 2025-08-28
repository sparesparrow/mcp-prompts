# MCP Prompts Monorepo Root Rules

## 🏗️ **Architektura & Design**

### **Hexagonální architektura (Ports & Adapters)**
- **Core** - čistá doménová logika bez infrastrukturních závislostí
- **Ports** - rozhraní definovaná v core balíčku
- **Adapters** - implementace portů v adapter balíčcích
- **Apps** - kompozice a konfigurace v apps složce

### **Struktura workspace**
```
mcp-prompts/
├── packages/
│   ├── core/                    # Doménová logika a porty
│   ├── @sparesparrow/           # Shared packages
│   └── adapters-*/              # Implementace portů
├── apps/
│   └── server/                  # MCP server aplikace
└── docs/                        # Dokumentace
```

## 🔧 **Build & Package Management**

### **Build pořadí**
1. **Core packages** - `@sparesparrow/mcp-prompts-contracts`, `@sparesparrow/mcp-prompts-catalog`
2. **Core** - `packages/core`
3. **Adapters** - všechny `packages/adapters-*`
4. **Apps** - `apps/server`

### **Build příkazy**
```bash
# Build celého workspace
pnpm run build

# Build s watch mode
pnpm run build:watch

# Type checking
pnpm run typecheck

# Clean build artifacts
pnpm run clean
```

## 📦 **Import strategie**

### **Workspace dependencies**
- Používej `workspace:*` pro interní závislosti
- Importuj z built outputs: `@mcp-prompts/core/dist/`
- Vyhni se circular dependencies

### **Path aliases**
```typescript
// V tsconfig.options.json
"@core": ["packages/core/src"]
"@core/*": ["packages/core/src/*"]
"@adapters-*": ["packages/adapters-*/src"]
```

## 🎯 **Code Style**

### **TypeScript**
- Strict mode povinný
- ESM modules (`"type": "module"`)
- NodeNext module resolution
- Zod pro validaci

### **ESLint & Prettier**
- ESLint 9.0+ flat config
- Prettier pro formátování
- Airbnb base rules
- TypeScript-specific rules

## 🧪 **Testing**

### **Test framework**
- **Vitest** pro unit testy
- **Playwright** pro e2e testy
- **Coverage > 90%** pro core balíčky
- **Integration tests** pro adaptéry

### **Test struktura**
```
packages/*/
├── src/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── package.json
```

## 🚀 **Development Workflow**

### **Git hooks**
- Husky pro pre-commit hooks
- Conventional commits
- Changesets pro releases

### **CI/CD**
- GitHub Actions
- Build matrix (Node 18, 20, Linux, macOS, Windows)
- Docker builds
- Security scanning

## 📋 **Package konvence**

### **Naming**
- `@sparesparrow/mcp-prompts-core` - core package
- `@sparesparrow/mcp-prompts-adapters-*` - adapter packages
- `@sparesparrow/mcp-prompts-*` - shared packages

### **Versioning**
- Semantic versioning
- Workspace dependencies
- Changesets pro release management

## 🔒 **Security & Quality**

### **Dependencies**
- Regular security audits
- Dependency pinning
- License compliance
- Vulnerability scanning

### **Code quality**
- Type safety
- Error handling
- Logging (Pino)
- Health checks

---

*Tyto pravidla definují standardy pro celý MCP Prompts monorepo workspace.*
