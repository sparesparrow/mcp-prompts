# Uživatelský návod MCP-Prompts (Claude Desktop & Cursor IDE)

## 1. Nastavení MCP-Prompts serveru pro Claude Desktop

1. **Nainstalujte a spusťte MCP-Prompts server**
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
3. **Nastavte Claude Desktop, aby používal váš MCP server**
   - Otevřete Claude Desktop a přejděte do **Nastavení** → **Developer** → **Edit Config**.
   - Otevře se (nebo vytvoří) soubor `claude_desktop_config.json`.
   - Přidejte nebo upravte sekci MCP serveru, například:
     ```json
     {
       "mcpServers": {
         "prompts": {
           "command": "npx",
           "args": ["-y", "@sparesparrow/mcp-prompts"]
         }
       }
     }
     ```
   - Uložte soubor a restartujte Claude Desktop.
   - V chatu by se měla objevit ikona nástrojů (slider). Klikněte na ni pro přístup k MCP tools a promptům.

## 2. Nastavení MCP-Prompts serveru pro Cursor IDE

1. **Spusťte MCP-Prompts server** (viz výše).
2. **Otevřete nastavení Cursor IDE** (Settings → AI → Prompt Management).
3. **Najděte pole pro "Custom MCP server URL"** (nebo podobné).
4. **Zadejte adresu serveru:**
   ```
   http://localhost:3003
   ```
5. **Uložte nastavení.** Nyní můžete procházet a používat prompty přímo v IDE.

## 3. Používání promptů a tools v GUI (Claude Desktop, Cursor IDE)

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
- **Jak používat šablony promptů:**
  - V GUI vyberte šablonu promptu.
  - Vyplňte požadované proměnné ve formuláři.
  - Výsledek se vloží do chatu nebo editoru.
- **Jak používat tools:**
  - Otevřete menu nástrojů (slider nebo ikona tools).
  - Vyberte tool podle názvu a popisu.
  - Zadejte požadované parametry (např. ID promptu, hodnoty proměnných).
  - Výsledek se zobrazí v chatu nebo výstupní oblasti.

## 4. Příklady použití konkrétních promptů

- **Code Review Assistant:**
  - Získejte okamžitou zpětnou vazbu na úryvky kódu. Vložte kód, vyberte prompt a obdržíte recenzi.
- **Data Analysis Template:**
  - Analyzujte CSV nebo JSON data. Vložte data, vyberte šablonu a získejte přehled nebo souhrn.
- **Project Analysis Assistant:**
  - Získejte přehled o projektu, jeho struktuře a možných vylepšeních.
- **Repository Explorer:**
  - Rychle pochopte strukturu a klíčové soubory v repozitáři.
- **Vlastní workflow prompty:**
  - Řetězte více promptů pro komplexní úlohy (např. generování kódu, refaktoring, dokumentace).

## 5. Tipy pro řešení problémů

- Pokud server není detekován:
  - Restartujte Claude Desktop nebo Cursor IDE po změně konfigurace.
  - Zkontrolujte, že MCP server běží a je dostupný na zadané adrese.
  - Ověřte, že v konfiguračním souboru nejsou překlepy.
  - Zkontrolujte logy pro chyby (Claude Desktop logy nebo výstup serveru).
- Můžete upravovat nebo přidávat nové šablony promptů ve složce `prompts/` (formát JSON). Po restartu serveru se načtou automaticky.
- Pro pokročilé použití viz [oficiální dokumentaci MCP](https://modelcontextprotocol.io/quickstart/user) a [API reference](docs/04-api-reference.md).

## 6. Další informace a zdroje

- [Dokumentace MCP protokolu](https://modelcontextprotocol.io/quickstart/user)
- [Jak připojit Claude Desktop k MCP serveru (MESA blog)](https://www.getmesa.com/blog/how-to-connect-mcp-server-claude/)
- [Plná dokumentace MCP-Prompts](docs/00-overview.md)
- [Průvodce šablonami promptů](docs/05-templates-guide.md)
- [Vývojářský průvodce](docs/07-developer-guide.md) 