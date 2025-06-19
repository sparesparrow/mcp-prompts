# Uživatelská příručka MCP-Prompts

## Úvod
MCP-Prompts je lehký, rozšiřitelný server pro správu promptů a šablon v ekosystému Model Context Protocol (MCP). Tato příručka vám pomůže nastavit, konfigurovat a používat MCP-Prompts s různými klienty, včetně LM Studio, LibreChat, Tasker, Android, Cursor IDE a Claude Desktop.

**Cílová skupina:**
- Vývojáři, prompt inženýři a pokročilí uživatelé, kteří chtějí spravovat a verzovat prompty pro LLM workflow.

**Předpoklady:**
- Node.js (pro lokální instalaci)
- Docker (pro kontejnerové nasazení)
- Základní znalost příkazové řádky

## Obsah
1. [Začínáme](#začínáme)
2. [Nastavení podporovaných klientů](#nastavení-podporovaných-klientů)
   - [LM Studio](#lm-studio)
   - [LibreChat](#librechat)
   - [Tasker (Android)](#tasker-android)
   - [Cursor IDE](#cursor-ide)
   - [Claude Desktop](#claude-desktop)
3. [Funkce a možnosti](#funkce-a-možnosti)
4. [Pokročilé příklady použití](#pokročilé-příklady-použití)
5. [Řešení problémů a FAQ](#řešení-problémů-a-faq)
6. [Kontakt a podpora](#kontakt-a-podpora)

## Začínáme

### Lokální instalace (npx)
```bash
npx -y @sparesparrow/mcp-prompts
curl http://localhost:3003/health
```

### Docker nasazení
```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```

### Docker Compose (PostgreSQL)
```yaml
version: "3"
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: "true"
      STORAGE_TYPE: "postgres"
      POSTGRES_CONNECTION_STRING: "postgresql://postgres:password@db:5432/mcp_prompts"
    ports: [ "3003:3003" ]
    depends_on: [ db ]
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
```

## Nastavení podporovaných klientů

### LM Studio
- Přidejte MCP-Prompts jako vlastní server v nastavení LM Studio.
- Příklad konfigurace:
  ```json
  {
    "name": "MCP Prompts",
    "url": "http://localhost:3003"
  }
  ```
- Viz [LM Studio dokumentace](https://lmstudio.ai/docs/).

### LibreChat
- Přidejte MCP-Prompts jako backend resource.
- Příklad konfigurace:
  ```json
  {
    "resource": "http://localhost:3003/prompts"
  }
  ```
- Viz [LibreChat dokumentace](https://github.com/danny-avila/LibreChat).

### Tasker (Android)
- Použijte HTTP Request akce pro komunikaci s MCP-Prompts API.
- Příklad: GET `http://<server>:3003/prompts`
- Viz [Tasker dokumentace](https://tasker.joaoapps.com/).

### Cursor IDE
- Přidejte MCP-Prompts jako resource server v nastavení Cursor IDE.
- Příklad konfigurace:
  ```json
  {
    "resource": "http://localhost:3003/prompts"
  }
  ```
- Viz [Cursor IDE dokumentace](https://www.cursor.so/docs/).

### Claude Desktop
- Přidejte MCP-Prompts jako vlastní MCP server v konfiguraci Claude Desktop.
- Příklad konfigurace:
  ```json
  {
    "mcpServers": {
      "mcp-prompts": {
        "command": "node",
        "args": ["/cesta/k/mcp-prompts/build/index.js"],
        "env": {
          "STORAGE_TYPE": "file",
          "PROMPTS_DIR": "/cesta/k/prompts"
        }
      }
    }
  }
  ```
- Viz [Claude Desktop dokumentace](https://github.com/ClaudeAI/claude-desktop).

## Funkce a možnosti
- Modulární úložiště: file, Postgres, MDC (Cursor Rules)
- Verzovaná správa promptů
- HTTP/SSE API endpointy
- Šablony promptů a substituce proměnných
- Integrace s více klienty
- Validace pomocí JSON schémat

## Pokročilé příklady použití
- Vytváření a aplikace šablon promptů
- Použití MDC (Cursor Rules) adaptéru
- Vícekrokové workflow příklady
- Export/import promptů

## Řešení problémů a FAQ
- Běžné chyby a jejich řešení
- Jak ověřit stav serveru
- Jak resetovat úložiště
- Kde najít logy
- Jak nahlásit problém

## Kontakt a podpora
- [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
- [Oficiální MCP dokumentace](https://github.com/modelcontextprotocol)
- Komunitní zdroje a Discord (pokud je k dispozici)

## 1. Nastavení MCP-Prompts serveru pro Claude Desktop

### 5. Claude Desktop: Krok za krokem

1. **Spusťte MCP-Prompts server**
   - Otevřete terminál a spusťte:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Nebo použijte Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - _[Vložit screenshot: Terminál se spuštěným MCP-Prompts]_  

2. **Ověřte běh serveru**
   - V prohlížeči nebo terminálu zadejte:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - _[Vložit screenshot: Výstup health check]_  

3. **Nastavte Claude Desktop**
   - Otevřete Claude Desktop a přejděte do **Settings** → **Developer** → **Prompt Management**.
   - Přidejte nový server s adresou `http://localhost:3003` nebo adresou vašeho MCP-Prompts serveru.
   - _[Vložit screenshot: Nastavení serveru v Claude Desktop]_  

4. **Ověřte integraci**
   - Otevřete správce promptů v Claude Desktop a ověřte, že se načítají prompty z MCP-Prompts.
   - _[Vložit screenshot: Načtené prompty v Claude Desktop]_  

#### Rychlý kontrolní seznam
- [ ] Server MCP-Prompts běží
- [ ] Claude Desktop nakonfigurován s adresou serveru
- [ ] Prompty se načítají správně

#### Tabulka řešení problémů
| Problém | Řešení |
|---|---|
| Prompty se nenačítají | Zkontrolujte, zda server běží a adresa je správná |
| Chyba připojení | Ověřte síťové nastavení a firewall |
| Chybí prompty | Ověřte obsah adresáře s prompty nebo nastavení úložiště |

## 2. Nastavení MCP-Prompts serveru pro Cursor IDE

### 4. Cursor IDE: Krok za krokem

1. **Spusťte MCP-Prompts server**
   - Otevřete terminál a spusťte:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Nebo použijte Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - _[Vložit screenshot: Terminál se spuštěným MCP-Prompts]_  

2. **Ověřte běh serveru**
   - V prohlížeči nebo terminálu zadejte:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - _[Vložit screenshot: Výstup health check]_  

3. **Nastavte Cursor IDE**
   - Otevřete Cursor IDE a přejděte do **Settings** → **AI** → **Prompt Management**.
   - Přidejte nový server s adresou `http://localhost:3003` nebo adresou vašeho MCP-Prompts serveru.
   - _[Vložit screenshot: Nastavení serveru v Cursor IDE]_  

4. **Ověřte integraci**
   - Otevřete správce promptů v Cursor IDE a ověřte, že se načítají prompty z MCP-Prompts.
   - _[Vložit screenshot: Načtené prompty v Cursor IDE]_  

#### Rychlý kontrolní seznam
- [ ] Server MCP-Prompts běží
- [ ] Cursor IDE nakonfigurováno s adresou serveru
- [ ] Prompty se načítají správně

#### Tabulka řešení problémů
| Problém | Řešení |
|---|---|
| Prompty se nenačítají | Zkontrolujte, zda server běží a adresa je správná |
| Chyba připojení | Ověřte síťové nastavení a firewall |
| Chybí prompty | Ověřte obsah adresáře s prompty nebo nastavení úložiště |

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

## Použití MCP-Prompts s Taskerem (Android), Anthropic API a Android integracemi (náhled)

> **Poznámka:** Podrobné návody k těmto integracím budou brzy doplněny. Níže je náhled plánovaných funkcí a scénářů.

### 1. Tasker (Android): Krok za krokem

1. **Spusťte MCP-Prompts server**
   - Otevřete terminál a spusťte:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Nebo použijte Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - _[Vložit screenshot: Terminál se spuštěným MCP-Prompts]_  

2. **Ověřte běh serveru**
   - V prohlížeči nebo terminálu zadejte:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - _[Vložit screenshot: Výstup health check]_  

3. **Nastavte HTTP Request v Taskeru**
   - Otevřete Tasker na svém Android zařízení.
   - Vytvořte nový **Profil** (např. "Načíst MCP Prompt").
   - Přidejte **Task** s akcí **HTTP Request**:
     - **Method:** GET
     - **URL:** `http://<ip-serveru>:3003/prompts`
     - (Nahraďte `<ip-serveru>` IP adresou vašeho počítače/serveru ve stejné síti.)
   - Volitelně přidejte akce pro zpracování odpovědi (např. zobrazit v Popupu, uložit do souboru, spustit další Tasker akci).
   - _[Vložit screenshot: Nastavení HTTP Request v Taskeru]_  

4. **Otestujte integraci**
   - Spusťte profil nebo task v Taskeru.
   - Měli byste vidět data promptu načtená z MCP-Prompts.

#### Řešení problémů s integrací Tasker

| Problém                     | Řešení                                                                 |
|-----------------------------|------------------------------------------------------------------------|
| Nelze se připojit k serveru | Ujistěte se, že MCP-Prompts běží a je dostupný z vašeho Android zařízení. |
| Síť není dostupná           | Ujistěte se, že Android zařízení a server jsou ve stejné Wi-Fi síti.   |
| Prompty se nezobrazují      | Zkontrolujte logy serveru; ověřte správnou URL a port v Taskeru.       |
| Chybí akce HTTP Request     | Aktualizujte Tasker na nejnovější verzi; viz [Tasker User Guide](https://tasker.joaoapps.com/userguide/en/). |

#### Rychlý kontrolní seznam

- [ ] MCP-Prompts server běží a je dostupný z Androidu
- [ ] Akce HTTP Request v Taskeru používá správnou IP a port
- [ ] Není blokován firewall nebo síťová izolace mezi Androidem a serverem
- [ ] Profil/task v Taskeru načte a zobrazí data promptu

### 2. Anthropic API klíč pro HTTP požadavky
- Nastavení Taskeru nebo jiných HTTP klientů pro volání MCP-Prompts serveru s vaším Anthropic API klíčem pro LLM odpovědi.
- Bezpečné uložení a použití API klíče v proměnných Taskeru.

### 3. Text-to-Speech (TTS)
- Použití Taskeru pro přečtení odpovědí promptů pomocí Android TTS.

### 4. Integrace se schránkou
- Automatické kopírování odpovědí promptů do schránky pro rychlé sdílení nebo vložení.

### 5. Sdílení přes Android Share menu
- Sdílení výsledků promptů přímo z MCP-Prompts do jiných aplikací přes Android share intent.

### 6. Android digitální asistent
- Integrace MCP-Prompts s Google Assistantem nebo jiným digitálním asistentem pro hlasové workflow.

### 7. AIDL (Android Interface Definition Language)
- Pokročilé: Zpřístupnění MCP-Prompts jako služby přes AIDL pro hlubokou integraci s Android aplikacemi.

> **Sledujte novinky!** Plné návody, Tasker profily a ukázkové skripty budou brzy doplněny.

## Použití MCP-Prompts s LM Studio a dalšími MCP klienty

### 1. LM Studio: Krok za krokem

1. **Spusťte MCP-Prompts server**
   - Otevřete terminál a spusťte:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Nebo použijte Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - _[Vložit screenshot: Terminál se spuštěným MCP-Prompts]_  

2. **Ověřte běh serveru**
   - V prohlížeči nebo terminálu zadejte:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - _[Vložit screenshot: Výstup health check]_  

3. **Nastavte LM Studio**
   - Otevřete LM Studio a přejděte do **Settings** → **Custom Servers**.
   - Klikněte na **Add Server** a zadejte:
     - **Name:** `MCP Prompts`
     - **URL:** `http://localhost:3003`
   - Klikněte na **Save**.
   - _[Vložit screenshot: Nastavení serveru v LM Studio]_  

4. **Otestujte integraci**
   - V LM Studio otevřete správce promptů nebo prohlížeč zdrojů.
   - Měli byste vidět prompty z MCP-Prompts.

#### Řešení problémů s integrací LM Studio

| Problém                     | Řešení                                                                 |
|-----------------------------|------------------------------------------------------------------------|
| Nelze se připojit k serveru | Ujistěte se, že MCP-Prompts běží a je dostupný na `http://localhost:3003`. |
| Port 3003 je již používán   | Zastavte jiné služby nebo změňte port v MCP-Prompts i LM Studio.        |
| Prompty se nezobrazují      | Zkontrolujte logy serveru; ověřte správnou URL v nastavení LM Studio.   |

#### Rychlý kontrolní seznam

- [ ] MCP-Prompts server běží (`curl http://localhost:3003/health`)
- [ ] LM Studio je nastaveno se správnou URL serveru
- [ ] Není blokován firewall nebo port
- [ ] Prompty jsou viditelné v LM Studio

### 2. LibreChat: Krok za krokem

1. **Spusťte MCP-Prompts server**
   - Otevřete terminál a spusťte:
     ```bash
     npx -y @sparesparrow/mcp-prompts
     ```
   - Nebo použijte Docker:
     ```bash
     docker run -d --name mcp-prompts -p 3003:3003 sparesparrow/mcp-prompts:latest
     ```
   - _[Vložit screenshot: Terminál se spuštěným MCP-Prompts]_  

2. **Ověřte běh serveru**
   - V prohlížeči nebo terminálu zadejte:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - _[Vložit screenshot: Výstup health check]_  

3. **Nastavte LibreChat**
   - Otevřete LibreChat a přejděte do **Settings** → **Backend Resources**.
   - Klikněte na **Add Resource** a zadejte:
     - **Resource URL:** `http://localhost:3003/prompts`
   - Klikněte na **Save**.
   - _[Vložit screenshot: Nastavení resource v LibreChat]_  

4. **Otestujte integraci**
   - V LibreChat otevřete prohlížeč promptů nebo zdrojů.
   - Měli byste vidět prompty z MCP-Prompts.

#### Řešení problémů s integrací LibreChat

| Problém                     | Řešení                                                                 |
|-----------------------------|------------------------------------------------------------------------|
| Nelze se připojit k serveru | Ujistěte se, že MCP-Prompts běží a je dostupný na `http://localhost:3003`. |
| Port 3003 je již používán   | Zastavte jiné služby nebo změňte port v MCP-Prompts i LibreChat.        |
| Prompty se nezobrazují      | Zkontrolujte logy serveru; ověřte správnou URL v nastavení LibreChat.   |

#### Rychlý kontrolní seznam

- [ ] MCP-Prompts server běží (`curl http://localhost:3003/health`)
- [ ] LibreChat je nastaven se správnou resource URL
- [ ] Není blokován firewall nebo port
- [ ] Prompty jsou viditelné v LibreChat

### 3. Ostatní MCP klienti (obecné instrukce)
- **Nastavení:**
  - Spusťte MCP-Prompts server a ujistěte se, že je dostupný z klientského zařízení.
  - Ve vašem MCP klientovi (např. rozšíření prohlížeče, desktopová/webová aplikace) najděte možnost přidat nebo nastavit MCP server.
  - Zadejte URL MCP-Prompts serveru a uložte.
- **Použití:**
  - Prompty a nástroje budou dostupné v rozhraní klienta.
  - Používejte je stejně jako v Claude Desktop nebo Cursor IDE: vyberte prompt, vyplňte proměnné, spusťte nástroje a sledujte výsledky.

> **Tip:** Pro detailní informace ke konkrétnímu klientovi nahlédněte do jeho dokumentace. Většina moderních klientů podporuje MCP protokol a lze je připojit k libovolnému kompatibilnímu serveru jako MCP-Prompts. 