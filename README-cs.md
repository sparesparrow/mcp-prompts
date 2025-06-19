# MCP-Prompts (česky)

[![build](https://img.shields.io/github/actions/workflow/status/sparesparrow/mcp-prompts/ci.yml?branch=main)](https://github.com/sparesparrow/mcp-prompts/actions)
[![license](https://img.shields.io/github/license/sparesparrow/mcp-prompts.svg)](LICENSE)
[![codecov](https://codecov.io/gh/sparesparrow/mcp-prompts/branch/main/graph/badge.svg)](https://codecov.io/gh/sparesparrow/mcp-prompts)

---

## TODOs: Refaktoring, CI/CD a zvýšení kvality

Tento seznam obsahuje konkrétní úkoly pro další zlepšení repozitáře. Každý bod obsahuje detailní instrukce a akceptační kritéria.

### 4. Rozšíření a úklid testů
- **Instrukce:**
  - Přidejte/rozšiřte testy pro nové funkce (sekvence, workflow engine).
  - Zajistěte, že všechny testy běží v CI (unit, integration, docker, E2E).
  - Odstraňte nebo opravte neudržované testy.
- **Akceptační kritéria:**
  - Všechny hlavní funkce jsou pokryty testy.
  - Testy jsou stabilní a procházejí v CI.

### 5. Aktualizace závislostí a bezpečnost
- **Instrukce:**
  - Spusťte `npm outdated` a aktualizujte závislosti.
  - Ověřte kompatibilitu MCP SDK a dalších klíčových balíčků.
  - Ověřte bezpečnostní best practices v Dockerfile a docker-compose.
- **Akceptační kritéria:**
  - Všechny závislosti jsou aktuální a build/testy procházejí.
  - Dockerfile a compose splňují bezpečnostní doporučení (viz security-considerations.mdc).

### 6. Dokumentace a přehlednost
- **Instrukce:**
  - Udržujte README v kořeni a podsložkách stručné, s odkazy na detailní dokumentaci.
  - Přidejte/aktualizujte README do všech důležitých složek (`scripts/`, `legacy/`, `examples/`, `docker/scripts/`).
  - Zvažte přesun dlouhých příkladů a FAQ do samostatných souborů.
- **Akceptační kritéria:**
  - README v kořeni i podsložkách je aktuální a přehledné.
  - Dlouhé příklady/FAQ jsou v samostatných souborech.

### 7. Oprava build chyb a refaktoring importů
- **Instrukce:**
  - Opravte všechny importy na explicitní cesty s příponou `.js` dle požadavků ESM/TypeScript.
  - Zkontrolujte a opravte všechny exporty/importy mezi soubory (`PromptService`, `createServer` apod.).
  - Ověřte, že všechny třídy a funkce jsou správně pojmenované a exportované.
- **Akceptační kritéria:**
  - Build projde bez chyb.
  - Všechny importy jsou explicitní a správné.

### 8. Aktualizace a sladění s MCP SDK
- **Instrukce:**
  - Zkontrolujte dokumentaci a typy aktuální verze MCP SDK.
  - Upravte konstrukci serveru, použití `resource`, `tool` a dalších metod podle nové API.
  - Ověřte, že všechny MCP integrace odpovídají aktuálnímu SDK.
- **Akceptační kritéria:**
  - Kód je kompatibilní s aktuální verzí MCP SDK.
  - Všechny MCP funkce fungují dle očekávání.

### 9. Oprava a rozšíření testů po refaktoringu
- **Instrukce:**
  - Po opravě build chyb upravte/rozšiřte testy tak, aby odpovídaly novému API a struktuře kódu.
  - Ověřte, že testy pokrývají i chybové scénáře a edge cases.
- **Akceptační kritéria:**
  - Všechny testy projdou v CI.
  - Testy pokrývají hlavní i chybové scénáře.

---

## Návod: Jak nastavit MCP server v Claude Desktop a Cursor IDE & práce s prompt šablonami

### 1. Nastavení MCP serveru v Claude Desktop

1. **Stáhněte a spusťte MCP-Prompts server**
   - Nejrychlejší způsob je pomocí npx:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Nebo použijte Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
2. **Ověřte běh serveru**
   - Otevřete v prohlížeči nebo použijte curl:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
3. **Otevřete Claude Desktop**
   - V nastavení (Settings) najděte sekci "Custom MCP server" nebo "Prompt server".
   - Zadejte adresu vašeho MCP serveru, např.:
     ```
     http://localhost:3003
     ```
   - Uložte a restartujte Claude Desktop, pokud je potřeba.

### 2. Nastavení MCP serveru v Cursor IDE

1. **Spusťte MCP-Prompts server** (viz výše).
2. **V Cursor IDE otevřete nastavení (Settings → AI → Prompt Management)**
   - Najděte pole pro "Custom MCP server URL" nebo podobné.
   - Zadejte adresu vašeho MCP serveru:
     ```
     http://localhost:3003
     ```
   - Uložte nastavení. Nyní můžete vybírat a používat prompty přímo v IDE.

### 3. Práce s prompt šablonami

- **Prompt šablony** umožňují používat proměnné v textu promptu, např.:
  ```json
  {
    "id": "code-review-assistant",
    "name": "Code Review Assistant",
    "content": "Zkontroluj následující kód: {{code}}",
    "isTemplate": true,
    "variables": ["code"]
  }
  ```
- **Použití šablony přes API nebo CLI:**
  - Pošlete požadavek na endpoint `/api/v1/prompts/apply-template` nebo použijte CLI:
    ```bash
    mcp-prompts prompt apply code-review-assistant --var code="console.log('Ahoj!')"
    ```
  - Výsledek bude prompt s dosazenými hodnotami:
    ```
    Zkontroluj následující kód: console.log('Ahoj!')
    ```
- **V GUI (Claude Desktop, Cursor IDE):**
  - Vyberte šablonu, zadejte hodnoty proměnných do formuláře a potvrďte.
  - Výsledek se automaticky použije v chatu nebo editoru.

> **Tip:** Prompt šablony můžete upravovat nebo přidávat v adresáři `prompts/` (formát JSON). Po restartu serveru se nové šablony načtou automaticky.

---

## Jak používat MCP Tools poskytované serverem

MCP server může poskytovat tzv. **tools** – akce, které lze volat z klienta (IDE, Claude Desktop, API, LLM). Tools umožňují například vytvářet prompty, analyzovat data, nebo volat externí API.

### 1. Základní princip
- Každý tool má unikátní jméno, popis a schéma vstupních parametrů (JSON Schema).
- Tools lze vypsat pomocí požadavku `tools/list` nebo v GUI klienta (např. v Cursor IDE nebo Claude Desktop).
- Tool se volá pomocí požadavku `tools/call` s parametry podle schématu.

### 2. Příklad: Volání toolu přes API

Například tool pro aplikaci šablony promptu může mít definici:
```json
{
  "name": "apply_template",
  "description": "Apply variables to a prompt template",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "variables": { "type": "object" }
    },
    "required": ["id", "variables"]
  }
}
```

Volání přes HTTP API (POST):
```bash
curl -X POST http://localhost:3003/api/v1/tools/call \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "apply_template",
    "arguments": {
      "id": "code-review-assistant",
      "variables": { "code": "console.log('Ahoj!')" }
    }
  }'
```

### 3. Použití v GUI (Cursor IDE, Claude Desktop)
- V GUI najděte sekci "Tools" nebo "Akce".
- Vyberte tool podle názvu a popisu.
- Zadejte požadované parametry (např. ID promptu, hodnoty proměnných).
- Výsledek se zobrazí v chatu nebo editoru.

### 4. Best practices a bezpečnost
- **Vždy ověřujte, jaké tools server nabízí** (`tools/list`).
- **Pečlivě zadávejte parametry** – validace probíhá podle schématu.
- **Nespouštějte destruktivní tools bez ověření** (např. mazání souborů, zápis do databáze).
- **Sledujte logy a výstupy** – chybové stavy jsou vraceny v poli `content` s příznakem `isError`.

### 5. Další informace
- Kompletní popis a příklady najdete v oficiální dokumentaci MCP: [MCP Tools – modelcontextprotocol.io/docs/concepts/tools](https://modelcontextprotocol.io/docs/concepts/tools)
- Pro pokročilé scénáře (např. dynamické přidávání tools, anotace, bezpečnost) viz sekce "Best practices" a "Security considerations" v dokumentaci.

---

# MCP-Prompts

Tento repozitář obsahuje správce promptů a workflow pro Model Context Protocol (MCP).

## Struktura repozitáře

- `src/` – Zdrojové kódy serveru a služeb
- `prompts/` – Všechny prompty a šablony (JSON)
- `scripts/` – Utility pro build, testování, release
- `docker/` – Docker konfigurace a utility
- `tests/` – Jednotkové a integrační testy
- `legacy/` – Legacy utility, staré skripty, custom-mcp, jednorázové nástroje
- `examples/` – Ukázkové konfigurační soubory
- `docs/` – Dokumentace a návrhy
- `glama.json` – Hlavní konfigurační soubor (ponechat v kořeni)

## CI/CD a kvalita kódu

- CI pipeline (GitHub Actions) spouští lint, testy, build, validaci promptů a health-check.
- Všechny prompty jsou validovány proti schématu.
- Kód je pokryt testy a pravidelně refaktorován pro vyšší čitelnost a udržitelnost.

## Další informace

- Legacy utility a příkladové soubory byly přesunuty do složek `legacy/` a `examples/`.
- Pro detailní informace viz README v jednotlivých složkách. 