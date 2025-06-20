# Průvodce nasazením a použitím MCP-Prompts

## Předpoklady
- **Node.js** (doporučeno v18+), pro lokální/serverové nasazení
- **Docker** (pro kontejnerové nasazení)
- **Porty:** Výchozí HTTP port je `3003`
- **API klíč (doporučeno pro produkci):** Nastavte pomocí proměnné prostředí `API_KEYS` (více klíčů oddělujte čárkou)
- **Perzistentní úložiště:** Použijte Docker volume nebo mapujte adresář na hostiteli pro file storage, případně nastavte PostgreSQL

---

## 🚀 Rychlý přehled
| Metoda         | Příkaz/konfigurace                                                                                 |
|---------------|----------------------------------------------------------------------------------------------------|
| Lokálně (npx) | `npx -y @sparesparrow/mcp-prompts`                                                                 |
| Lokálně (Node)| `git clone ... && npm install && npm run build && node build/index.js`                             |
| Docker        | `docker run -d -p 3003:3003 -e HTTP_SERVER=true -e STORAGE_TYPE=file -v $(pwd)/data:/app/data sparesparrow/mcp-prompts:latest` |
| Docker Compose| Viz níže pro příklad (Postgres nebo file)                                                          |

---

## 🖥️ Lokální nasazení (npx/Node.js)
```bash
# Nejjednodušší: npx (není potřeba instalace)
npx -y @sparesparrow/mcp-prompts

# Nebo ručně
# git clone https://github.com/sparesparrow/mcp-prompts.git
# cd mcp-prompts
# npm install && npm run build
# node build/index.js
```

### Proměnné prostředí
- `HTTP_SERVER=true` (zapne HTTP API)
- `PORT=3003` (změna portu dle potřeby)
- `STORAGE_TYPE=file|postgres` (volba úložiště)
- `PROMPTS_DIR=./data/prompts` (pro file storage)
- `POSTGRES_CONNECTION_STRING=...` (pro Postgres)
- `API_KEYS=vas_klic1,vas_klic2` (více klíčů oddělujte čárkou)

---

## 🐳 Nasazení přes Docker
```bash
docker run -d --name mcp-prompts \
  -p 3003:3003 \
  -e HTTP_SERVER=true \
  -e STORAGE_TYPE=file \
  -v $(pwd)/data:/app/data \
  sparesparrow/mcp-prompts:latest
```
- Pro perzistenci vždy mapujte adresář hostitele na `/app/data`.
- Pro produkci nastavte `API_KEYS` a zkontrolujte CORS/limity požadavků.

---

## 🐳 Docker Compose příklad (PostgreSQL)
```yaml
version: "3"
services:
  prompts:
    image: sparesparrow/mcp-prompts:latest
    environment:
      HTTP_SERVER: "true"
      STORAGE_TYPE: "postgres"
      POSTGRES_CONNECTION_STRING: "postgresql://postgres:password@db:5432/mcp_prompts"
      API_KEYS: "vas-produkcni-klic"
    ports: [ "3003:3003" ]
    depends_on: [ db ]
    volumes:
      - ./data:/app/data
  db:
    image: postgres:14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - ./pgdata:/var/lib/postgresql/data
```

---

## 🔑 API klíč a autentizace
- Nastavte proměnnou `API_KEYS` (více klíčů oddělujte čárkou)
- Všechny API požadavky (kromě `/health` a `/api-docs`) vyžadují hlavičku `x-api-key`
- **Příklad (curl):**
  ```bash
  curl -H "x-api-key: vas_klic" http://localhost:3003/prompts
  ```
- **Příklad (LM Studio/LibreChat/ostatní klienti):**
  - Většina klientů umožňuje nastavit vlastní hlavičky nebo API klíč v nastavení serveru/resource. Zadejte svůj klíč dle potřeby.
  - Pokud ne, použijte proxy nebo požádejte vývojáře klienta o podporu.
- **Tip:** Pokud dostanete chybu 401/403, zkontrolujte API klíč a správnost hlavičky.

---

## 🩺 Health check & řešení problémů
- Ověření běhu serveru:
  ```bash
  curl http://localhost:3003/health
  # { "status": "ok" }
  ```
- Logy jsou na stdout (Docker: `docker logs mcp-prompts`)

### Časté problémy a řešení
| Problém                 | Řešení                                                                  |
|-------------------------|-------------------------------------------------------------------------|
| Port je obsazen         | Změňte proměnnou `PORT` nebo zastavte kolidující službu                 |
| Chyby úložiště          | Zkontrolujte volume mapping nebo připojení k Postgres                   |
| Chyby autentizace       | Ověřte správnou hlavičku `x-api-key` a hodnotu                          |
| Data nejsou perzistentní| Mapujte adresář hostitele na `/app/data` v Dockeru nebo použijte Postgres|
| API dokumentace nefunguje| Ověřte, že server běží a navštivte `/api-docs`                         |
| SSE nefunguje           | Nastavte `ENABLE_SSE=true` a ověřte endpoint `/events`                  |

---

## 🛡️ Produkční bezpečnostní checklist
- [ ] Nastavte silné, unikátní `API_KEYS` (nikdy nepoužívejte výchozí nebo veřejné klíče)
- [ ] Omezte povolené domény pomocí CORS
- [ ] Zapněte a nastavte rate limiting (viz README pro proměnné)
- [ ] Používejte HTTPS (přes reverse proxy nebo orchestraci)
- [ ] Používejte perzistentní úložiště (volume nebo Postgres)
- [ ] Pravidelně aktualizujte server a závislosti
- [ ] Sledujte logy a health endpoint
- [ ] Pravidelně zálohujte data adresář nebo Postgres

---

## ⬆️ Jak bezpečně upgradovat
1. **Zálohujte data** (adresář data nebo Postgres DB)
2. **Stáhněte nejnovější image nebo aktualizujte npm balíček**
   - Docker: `docker pull sparesparrow/mcp-prompts:latest`
   - npm: `npm install -g @sparesparrow/mcp-prompts`
3. **Restartujte server/kontejner**
4. **Ověřte health endpoint a logy pro chyby**
5. **Otestujte API a integrace s klienty**

---

## Použití s klienty
- **LM Studio, Cursor IDE, LibreChat, Tasker, Android:**
  - Přidejte URL MCP-Prompts serveru do nastavení klienta
  - Pokud je nastaven API klíč, nakonfigurujte klienta pro posílání `x-api-key`
  - Podrobné instrukce pro klienty najdete dále v této příručce

## API & Swagger/OpenAPI
- Interaktivní API dokumentace: [http://localhost:3003/api-docs](http://localhost:3003/api-docs)
- Prozkoumejte endpointy, schémata a vyzkoušejte požadavky v prohlížeči
- Všechny endpointy (kromě `/health` a `/api-docs`) vyžadují API klíč pokud je nastaven

## Server-Sent Events (SSE)
- Zapněte pomocí `ENABLE_SSE=true` (volitelné)
- Výchozí endpoint: `/events`
- Viz docs/06-mcp-integration.md pro použití

## Konfigurace úložiště
- **File:** Výchozí, ukládá prompty/workflow do `/app/data` (mapujte na hostitele pro perzistenci)
- **Postgres:** Nastavte `STORAGE_TYPE=postgres` a `POSTGRES_CONNECTION_STRING`
- **MDC (Cursor Rules):** Viz pokročilou dokumentaci

## Podpora & zdroje
- [GitHub Issues](https://github.com/sparesparrow/mcp-prompts/issues)
- [Oficiální MCP dokumentace](https://github.com/modelcontextprotocol)
- Plný uživatelský a API průvodce najdete níže

---

## 🌐 Pokročilé scénáře nasazení

### Reverse proxy (HTTPS, směrování domény)
- **Doporučeno pro produkci:** Použijte Nginx, Caddy nebo Traefik pro HTTPS a vlastní doménu.
- **Příklad (Nginx):**
  ```nginx
  server {
    listen 443 ssl;
    server_name prompts.example.com;
    ssl_certificate /etc/letsencrypt/live/prompts.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prompts.example.com/privkey.pem;

    location / {
      proxy_pass http://localhost:3003;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```
- **Caddy (auto HTTPS):**
  ```caddyfile
  prompts.example.com {
    reverse_proxy localhost:3003
  }
  ```
- **Tip:** V produkci vždy omezte přímý přístup na port 3003 (firewall, security group).

### Cloud/VPS nasazení
- Otevřete pouze potřebné porty (např. 443 pro HTTPS, 3003 pro lokální testování).
- Použijte Docker nebo systemd pro správu procesu.
- Nastavujte proměnné prostředí bezpečně (nikdy neukládejte tajné údaje do repozitáře).

### Multi-instanční / vysoká dostupnost
- Pro škálování použijte Docker Compose nebo Kubernetes.
- Sdílejte Postgres databázi pro prompty/workflow.
- Umístěte load balancer (např. Nginx, Traefik) před více instancí MCP-Prompts.
- Pro file storage použijte sdílený volume (NFS, cloud storage) nebo preferujte Postgres pro distribuovaná nasazení.

---

## 🤖 Integrace klientů: krok za krokem

### LM Studio
1. **Otevřete LM Studio → Settings → Custom Servers**
2. **Přidejte server:**
   - Name: `MCP Prompts`
   - URL: `https://vase-domena.cz` nebo `http://localhost:3003`
3. **API klíč:** Pokud je vyžadován, zadejte do pole pro custom header nebo API key (pokud je dostupné). Pokud ne, použijte reverse proxy nebo požádejte o podporu.
4. **Test:** Otevřete správce promptů. Prompty by se měly zobrazit.
5. **Řešení problémů:**
   - 401/403: Zkontrolujte API klíč a URL serveru.
   - Nenačítá se: Zkontrolujte síť, firewall a logy serveru.

### Cursor IDE
1. **Otevřete Cursor IDE → Settings → AI → Prompt Management**
2. **Přidejte resource server:**
   - URL: `https://vase-domena.cz/prompts` nebo `http://localhost:3003/prompts`
3. **API klíč:** Zadejte do pole pro custom header pokud je podporováno.
4. **Test:** Prompty by měly být viditelné v resource browseru.
5. **Řešení problémů:**
   - 401/403: Zkontrolujte API klíč.
   - Nenačítá se: Zkontrolujte URL a stav serveru.

### LibreChat
1. **Otevřete LibreChat → Settings → Backend Resources**
2. **Přidejte resource:**
   - Resource URL: `https://vase-domena.cz/prompts` nebo `http://localhost:3003/prompts`
3. **API klíč:** Zadejte v konfiguraci resource pokud je podporováno.
4. **Test:** Prompty by se měly zobrazit v resource browseru.
5. **Řešení problémů:**
   - 401/403: Zkontrolujte API klíč.
   - Nenačítá se: Zkontrolujte URL a stav serveru.

### Tasker (Android)
1. **Vytvořte HTTP Request akci:**
   - Method: GET
   - URL: `http://<server>:3003/prompts`
   - Headers: `x-api-key: vas_klic` (přidejte custom header)
2. **Test:** Spusťte task a ověřte načtení dat.
3. **Řešení problémů:**
   - Chyba připojení: Zkontrolujte síť a stav serveru.
   - 401/403: Zkontrolujte hlavičku API klíče.

---

## 🖼️ Vizualizace & screenshoty
- **[ZÁSTUPCE ARCHITEKTONICKÉHO DIAGRAMU]**
  - (Přispěvatelé: přidejte diagram znázorňující klient(y) → reverse proxy → MCP-Prompts → úložiště)
- **[ZÁSTUPCE SÍŤOVÉHO DIAGRAMU]**
  - (Přispěvatelé: přidejte diagram znázorňující tok API klíče, HTTPS a SSE)
- **[ZÁSTUPCE SCREENSHOTŮ]**
  - LM Studio: obrazovka konfigurace serveru
  - Cursor IDE: konfigurace resource serveru
  - LibreChat: konfigurace backend resource
  - Tasker: nastavení HTTP requestu

---

## 🛠️ Pokročilé použití & API příklady

### Běžné API volání (curl)
- **Výpis promptů:**
  ```bash
  curl -H "x-api-key: vas_klic" http://localhost:3003/prompts
  ```
- **Přidání promptu:**
  ```bash
  curl -X POST -H "x-api-key: vas_klic" -H "Content-Type: application/json" \
    -d '{"id":"muj-prompt","name":"Test","content":"Řekni ahoj!"}' \
    http://localhost:3003/prompts
  ```
- **Úprava promptu:**
  ```bash
  curl -X PUT -H "x-api-key: vas_klic" -H "Content-Type: application/json" \
    -d '{"name":"Upravený název"}' \
    http://localhost:3003/prompts/muj-prompt
  ```
- **Smazání promptu:**
  ```bash
  curl -X DELETE -H "x-api-key: vas_klic" http://localhost:3003/prompts/muj-prompt
  ```
- **Výpis workflow:**
  ```bash
  curl -H "x-api-key: vas_klic" http://localhost:3003/workflows
  ```
- **Spuštění workflow:**
  ```bash
  curl -X POST -H "x-api-key: vas_klic" http://localhost:3003/workflows/run/<workflowId>
  ```

### Použití HTTPie (alternativa k curl)
```bash
http GET :3003/prompts x-api-key:vas_klic
http POST :3003/prompts x-api-key:vas_klic id=muj2 name=Test2 content='Ahoj!'
```

### Použití Postmanu
- Nastavte URL a metodu dle výše uvedených příkladů.
- Přidejte hlavičku `x-api-key` s vaším klíčem.
- Pro POST/PUT nastavte tělo na raw JSON.

---

### Workflow & šablony
- **Šablony** umožňují proměnné v obsahu promptu, např.:
  ```json
  {
    "id": "code-review-assistant",
    "name": "Code Review Assistant",
    "content": "Zkontroluj: {{code}}",
    "isTemplate": true,
    "variables": ["code"]
  }
  ```
- **Použití:**
  - V klientovi vyberte šablonu, vyplňte proměnné a odešlete.
  - Přes API: POST na `/prompts/apply-template` (viz API dokumentace).
- **Workflow** řetězí více kroků (viz endpoint `/workflows` a API dokumentace).

---

### Server-Sent Events (SSE) příklad
- **Zapnutí SSE:** Nastavte `ENABLE_SSE=true` a připojte se na `/events`.
- **Ukázka JS klienta:**
  ```js
  const es = new EventSource('http://localhost:3003/events');
  es.onmessage = e => console.log('SSE:', e.data);
  es.onerror = err => es.close();
  ```
- **Využití:** Získávejte v reálném čase změny promptů a workflow.

---

## 🧩 Troubleshooting & FAQ (pokročilé)
| Problém                        | Řešení/tip                                                                 |
|--------------------------------|-----------------------------------------------------------------------------|
| CORS chyba v prohlížeči        | Nastavte povolené domény přes CORS proměnné (viz README); v produkci používejte HTTPS |
| Překročen rate limit (429)     | Zvyšte limity přes proměnné nebo zpomalte požadavky                        |
| Potřeba migrace Postgres       | Exportujte prompty do souboru, importujte do nové DB; viz migrační utilita (pokud je k dispozici) |
| Odepřen přístup k souboru      | Ujistěte se, že Docker volume/adresář je zapisovatelný uživatelem kontejneru|
| Nejasné logy                   | Zvyšte úroveň logování (pokud je podporováno); sledujte stack trace a kódy chyb |
| SSE nefunguje                  | Zkontrolujte síť/firewall, zapněte SSE, použijte správný endpoint           |
| API klíč funguje v curl, ne v klientovi | Zkontrolujte překlepy v hlavičce, proxy klienta, nebo CORS         |
| Workflow neběží                | Zkontrolujte definici workflow, logy a API dokumentaci pro povinná pole     |

---

# Uživatelská příručka MCP-Prompts

## Jak přispívat screenshoty
Uvítáme příspěvky screenshotů pro vylepšení této příručky! Prosíme:
- Ukládejte obrázky ve formátu PNG.
- Pojmenovávejte soubory popisně (např. `lm-studio-server-config.png`).
- Umístěte je do adresáře `images/` v kořeni projektu.
- Odevzdejte pull request s vaším screenshotem a aktualizujte příslušný Markdown odkaz.

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
   - ![Terminál se spuštěným MCP-Prompts](images/terminal-mcp-prompts.png) (Screenshot needed! Please contribute.)

2. **Ověřte běh serveru**
   - V prohlížeči nebo terminálu zadejte:
     ```bash
     curl http://localhost:3003/health
     # → { "status": "ok" }
     ```
   - ![Výstup health check](images/health-check-output.png) (Screenshot needed! Please contribute.)

3. **Nastavte Claude Desktop**
   - Otevřete Claude Desktop a přejděte do **Settings** → **Developer** → **Prompt Management**.
   - Přidejte nový server s adresou `http://localhost:3003` nebo adresou vašeho MCP-Prompts serveru.
   - ![Nastavení serveru v Claude Desktop](images/claude-desktop-server-config.png) (Screenshot needed! Please contribute.)

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

---

## 🤝 Přispěvatelé

Uvítáme příspěvky do dokumentace i kódu MCP-Prompts!

### Dokumentace
- **Screenshoty:** Přidejte PNG do složky `images/` a aktualizujte odkazy v Markdownu.
- **Diagramy:** Přidejte architektonické nebo síťové diagramy (SVG/PNG) do `images/` a odkažte je v příručce.
- **Překlady:** Pomozte udržovat českou a anglickou příručku synchronizovanou, případně přidejte další jazyky.
- **FAQ & příklady:** Rozšiřte FAQ nebo přidejte reálné příklady použití.
- **Jak přispět:** Forkněte repozitář, proveďte změny a odešlete pull request (PR).

### Kód
- **Fork a větev:** Forkněte repozitář a vytvořte si feature větev.
- **Styl kódu:** Dodržujte styl a linting pravidla (viz README a `.eslintrc.js`).
- **Testy:** Přidejte nebo upravte testy pro nové funkce nebo opravy chyb.
- **Pull requesty:** Odesílejte PR s jasným popisem a případně odkazem na související issue.

### Dotazy & návrhy funkcí
- **GitHub Issues:** [https://github.com/sparesparrow/mcp-prompts/issues](https://github.com/sparesparrow/mcp-prompts/issues)
- **Diskuze:** Použijte GitHub Discussions nebo založte issue pro dotazy, nápady či zpětnou vazbu.

### Synchronizace příruček
- Pokud upravíte anglickou příručku, aktualizujte i českou (a naopak), aby zůstaly sladěné.

---

## 🏷️ Verzování & aktualizace

- **Zjištění aktuální verze:**
  - CLI: `mcp-prompts --version` nebo `npx @sparesparrow/mcp-prompts --version`
  - Docker: `docker run sparesparrow/mcp-prompts:latest --version`
  - npm: `npm list @sparesparrow/mcp-prompts` nebo zkontrolujte `package.json`
- **Upgrade:**
  - Docker: `docker pull sparesparrow/mcp-prompts:latest`
  - npm: `npm install -g @sparesparrow/mcp-prompts`
- **Changelog & poznámky k vydání:**
  - Viz [CHANGELOG.md](./CHANGELOG.md) v repozitáři nebo stránku GitHub Releases
- **Verzování:**
  - MCP-Prompts používá [semver](https://semver.org/lang/cz/). Změna major verze může znamenat nekompatibilní změny; minor/patch jsou zpětně kompatibilní.

---

## 🫂 Podpora & komunita

- **GitHub Issues:** Pro hlášení chyb, návrhy funkcí a dotazy: [https://github.com/sparesparrow/mcp-prompts/issues](https://github.com/sparesparrow/mcp-prompts/issues)
- **Diskuze:** Pro nápady, pomoc a komunitní chat: záložka GitHub Discussions
- **Discord/komunita:** (Pokud je k dispozici, vložte odkaz)
- **Etiketa:** Buďte slušní, přikládejte detaily (logy, kroky, verzi), a před založením issue zkontrolujte existující
- **Odezva:** Maintaineři se snaží odpovídat do několika dnů; komunita může být rychlejší

---

_Naposledy aktualizováno: [RRRR-MM-DD]_ 