# MCP Inspector Testing Guide

Tento dokument popisuje, jak testovat MCP-Prompts server pomocí MCP Inspector nástroje.

## Přehled

MCP Inspector je oficiální nástroj pro testování a debugování MCP serverů. Poskytuje webové rozhraní pro interaktivní testování MCP funkcionalit.

## Instalace

### Automatická instalace

MCP Inspector se automaticky nainstaluje při spuštění testů:

```bash
# Linux/macOS
./scripts/run-mcp-inspector-tests.sh

# Windows PowerShell
.\scripts\run-mcp-inspector-tests.ps1
```

### Manuální instalace

```bash
npm install -g @modelcontextprotocol/inspector
```

## Spuštění testů

### 1. Automatické testy

```bash
# Nastavit environment variable
export TEST_MCP_INSPECTOR=true

# Spustit testy
npm test -- --testPathPattern="mcp-inspector.integration.test"
```

### 2. Manuální testování

```bash
# Spustit MCP Inspector s MCP-Prompts serverem
npx @modelcontextprotocol/inspector npx -y @sparesparrow/mcp-prompts --port 6278
```

Poté otevřete v prohlížeči: http://localhost:6278

## Testované funkcionality

### Základní testy

- ✅ **Spuštění Inspectoru** - Ověření, že se MCP Inspector úspěšně spustí
- ✅ **Webové rozhraní** - Kontrola dostupnosti webového rozhraní
- ✅ **Připojení k serveru** - Ověření připojení k MCP-Prompts serveru

### MCP Tools testy

- ✅ **list_prompts** - Výpis všech promptů
- ✅ **get_prompt** - Načtení konkrétního promptu
- ✅ **save_prompt** - Uložení nového promptu
- ✅ **delete_prompt** - Smazání promptu
- ✅ **apply_template** - Aplikace šablony s proměnnými

### MCP Resources testy

- ✅ **Dostupné zdroje** - Kontrola dostupných MCP zdrojů
- ✅ **Načítání zdrojů** - Testování načítání promptů jako zdrojů

### Pokročilé testy

- ✅ **Šablony a proměnné** - Testování `{{variable}}` substituce
- ✅ **Sekvence** - Testování multi-step workflow
- ✅ **Error handling** - Ověření správného zpracování chyb

## Konfigurace testů

### Environment Variables

| Variable | Popis | Výchozí hodnota |
|----------|-------|-----------------|
| `TEST_MCP_INSPECTOR` | Povolí MCP Inspector testy | `false` |
| `NODE_ENV` | Prostředí pro testy | `test` |

### Porty

- **Inspector port**: 6278 (konfigurovatelný)
- **MCP-Prompts port**: 3003 (výchozí)

## Troubleshooting

### Časté problémy

#### 1. Port je obsazený

```
❌ Proxy Server PORT IS IN USE at port 6277 ❌
```

**Řešení:**
```bash
# Použít jiný port
npx @modelcontextprotocol/inspector npx -y @sparesparrow/mcp-prompts --port 6279
```

#### 2. Inspector se nespustí

**Řešení:**
```bash
# Zkontrolovat instalaci
npm list -g @modelcontextprotocol/inspector

# Přegenerovat instalaci
npm install -g @modelcontextprotocol/inspector --force
```

#### 3. Testy selhávají

**Řešení:**
```bash
# Spustit s debug logováním
DEBUG=* npm test -- --testPathPattern="mcp-inspector.integration.test"

# Zkontrolovat, že MCP-Prompts server běží
curl http://localhost:3003/health
```

### Debugování

#### Logy Inspectoru

```bash
# Spustit s verbose výstupem
npx @modelcontextprotocol/inspector npx -y @sparesparrow/mcp-prompts --verbose
```

#### Logy MCP-Prompts

```bash
# Spustit s debug logováním
LOG_LEVEL=debug npx @sparesparrow/mcp-prompts
```

## Integrace s CI/CD

### GitHub Actions

```yaml
- name: Run MCP Inspector Tests
  env:
    TEST_MCP_INSPECTOR: true
  run: npm test -- --testPathPattern="mcp-inspector.integration.test"
```

### Docker

```dockerfile
# V Dockerfile
ENV TEST_MCP_INSPECTOR=true
RUN npm test -- --testPathPattern="mcp-inspector.integration.test"
```

## Rozšíření testů

### Přidání nového testu

1. Otevřete `tests/integration/mcp-inspector.integration.test.ts`
2. Přidejte nový test case:

```typescript
it('should test new functionality', async () => {
  if (!runTest) {
    console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
    return;
  }

  // Test implementation
  const response = await fetch(`http://localhost:${inspectorPort}/api/tools/new_tool/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arguments: {} })
  });
  
  expect(response.status).toBe(200);
});
```

### Testování nových MCP Tools

```typescript
it('should support new MCP tool', async () => {
  // Test tool availability
  const toolsResponse = await fetch(`http://localhost:${inspectorPort}/api/tools`);
  const tools = await toolsResponse.json();
  const toolNames = tools.map((tool: any) => tool.name);
  expect(toolNames).toContain('new_tool_name');

  // Test tool functionality
  const callResponse = await fetch(`http://localhost:${inspectorPort}/api/tools/new_tool_name/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ arguments: { param: 'value' } })
  });
  
  expect(callResponse.status).toBe(200);
});
```

## Reference

- [MCP Inspector Documentation](https://github.com/modelcontextprotocol/inspector)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [MCP-Prompts API Reference](../04-api-reference.md) 