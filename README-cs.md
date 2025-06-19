# MCP-Prompts (česky)

[![build](https://img.shields.io/github/actions/workflow/status/sparesparrow/mcp-prompts/ci.yml?branch=main)](https://github.com/sparesparrow/mcp-prompts/actions)
[![license](https://img.shields.io/github/license/sparesparrow/mcp-prompts.svg)](LICENSE)
[![codecov](https://codecov.io/gh/sparesparrow/mcp-prompts/branch/main/graph/badge.svg)](https://codecov.io/gh/sparesparrow/mcp-prompts)

---

## TODOs: Další rozvoj a zlepšení

Tento seznam obsahuje aktuální úkoly a návrhy pro další rozvoj a zvýšení kvality projektu.

### 1. Rozšíření a stabilizace funkcí
- [ ] Stabilizovat a zdokumentovat MDC (Cursor Rules) adapter
- [ ] Rozšířit podporu pro nové MCP klienty (LM Studio, LibreChat, Tasker, Android, atd.)
- [ ] Přidat a rozšířit uživatelské návody (EN, CZ) pro všechny podporované klienty a integrace
- [ ] Přidat příklady a scénáře pro pokročilé workflow a prompty

### 2. Testování a CI/CD
- [ ] Zajistit vysoké pokrytí testy (unit, integration, E2E)
- [ ] Pravidelně spouštět CI pipeline (lint, testy, build, validace, audit)
- [ ] Přidat testy pro MDC adapter a nové storage backendy
- [ ] Automatizovat testy pro CLI a API

### 3. Dokumentace a přehlednost
- [ ] Udržovat README a uživatelské návody stručné a aktuální
- [ ] Přidat/aktualizovat README do všech důležitých složek (`scripts/`, `legacy/`, `examples/`, `docker/scripts/`)
- [ ] Přidat detailní příklady, FAQ a troubleshooting sekce
- [ ] Přidat odkazy na oficiální MCP dokumentaci a komunitní zdroje

### 4. Refaktoring a údržba
- [ ] Pravidelně refaktorovat kód podle code-style pravidel
- [ ] Odstraňovat mrtvý nebo neudržovaný kód
- [ ] Zajistit konzistenci typů, exportů/importů a pojmenování
- [ ] Zlepšit strukturu modulů a oddělení funkcí (adapters, prompts, handlers, ...)

### 5. Bezpečnost a aktualizace
- [ ] Pravidelně aktualizovat závislosti (`npm audit`, `npm update`)
- [ ] Ověřit bezpečnostní best practices v Dockerfile, docker-compose a API
- [ ] Přidat validaci vstupů a robustní error handling

### 6. Podpora nových funkcí a integrací
- [ ] Přidat podporu pro nové typy promptů, tools a workflow
- [ ] Zajistit kompatibilitu s novými verzemi MCP SDK a klientů
- [ ] Přidat návody a příklady pro integraci s mobilními a desktopovými aplikacemi

---

## Úkoly a konkrétní TODOs

Níže jsou konkrétní úkoly a návrhy pro přispěvatele. Pokud chcete pomoci, vyberte si neodškrtnutý bod nebo založte nové issue!

- [ ] Implementovat pokročilou validaci promptů (např. kontrola duplicitních ID, povinných polí, použití proměnných)
- [ ] Přidat integrační testy pro MDC (Cursor Rules) adapter
- [ ] Vylepšit chybové hlášky a zpětnou vazbu v API odpovědích
- [ ] Přidat screenshoty do uživatelských návodů (EN, CZ) pro hlavní klienty (Claude Desktop, Cursor IDE, LM Studio, LibreChat)
- [ ] Automatizovat publikaci Docker image při vydání (CI/CD)
- [ ] Přidat ukázkové Tasker profily a Android automatizační skripty do dokumentace
- [ ] Rozšířit API dokumentaci v `docs/04-api-reference.md` (více příkladů endpointů, chybové scénáře)
- [ ] Provést bezpečnostní revizi a vylepšit ochranu nových endpointů a integrací
- [ ] Přidat pokročilé příklady promptů/workflow (vícekrokové, řetězení, atd.)
- [ ] Přidat ukázky použití CLI a troubleshooting do uživatelského návodu
- [ ] Přidat validaci proměnných z prostředí a srozumitelné chyby při startu
- [ ] Přidat badge pro podporované MCP klienty (LM Studio, LibreChat, atd.) do README

Neváhejte navrhnout další úkoly nebo založit issue na cokoli, co najdete!

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