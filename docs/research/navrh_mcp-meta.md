# Strategická integrace a technologická rozhodnutí pro ekosystém 
mcp-prompts 
Následující analýza poskytuje detailní odpovědi a doporučení založená 
na osvědčených postupech a stavu současného MCP prostředí. Cílem je 
validovat vaše strategická rozhodnutí a poskytnout hlubší technický 
kontext pro další implementaci. 
### 1. Integrace s FastAPI v Python repozitářích 
Váš přístup k integraci Python repozitářů, jako je 
`mcp-project-orchestrator`, pomocí frameworku FastAPI je elegantní a v 
souladu s moderními postupy. Využití komunitních knihoven, jako je 
`fastapi-mcp` (nebo podobných wrapperů), je ideální cestou. 
**Princip:** Tento přístup funguje na principu "dekorátoru" nebo 
"wrapperu". Knihovna introspektivně projde vaši existující FastAPI 
aplikaci, identifikuje definované endpointy (např. 
`/projects/{project_id}`) a jejich Pydantic modely. Následně tyto 
endpointy automaticky "přebalí" a zpřístupní je jako MCP `tools` v 
rámci MCP serveru, který běží souběžně s vaší FastAPI aplikací. 
**Příklad implementace:** 
```python 
# main.py 
from fastapi import FastAPI 
from pydantic import BaseModel 
# Assuming a library like fastapi_mcp exists or is created 
# from fastapi_mcp import FastApiMCP  
# --- Your Standard FastAPI Application --- 
app = FastAPI( 
title="Project Orchestrator API", 
description="Manages AI project lifecycle and orchestration.", 
version="1.0.0", 
) 
class Project(BaseModel): 
project_id: str 
status: str 
description: str | None = None 
@app.get("/projects/{project_id}", response_model=Project) 
def get_project(project_id: str): 
""" 
Retrieves the details of a specific project. 
This endpoint will be automatically exposed as an MCP tool. 
""" 
# Your existing business logic to fetch project data 
return {"project_id": project_id, "status": "active", 
"description": "Core prompt management server."} 
# --- Add the MCP Layer --- 
# This part would be handled by the wrapper library, 
# which discovers the endpoints and creates the MCP server. 
# mcp = FastApiMCP( 
#     
#     
#     
# ) 
app,  
name="ProjectOrchestratorMCP",  
base_url="http://localhost:8000" 
# mcp.mount_to_app() # Mounts the /mcp endpoint 
Strategická výhoda: Tento model umožňuje vašim Python službám žít dvojím životem. Mohou 
nadále fungovat jako standardní RESTful API pro tradiční webové aplikace a zároveň bez 
jakýchkoli změn v jádrové logice poskytovat své funkce AI agentům přes MCP. To maximalizuje 
jejich znovupoužitelnost. 
2. Využití MCP Inspector pro automatizované integrační testy 
Vaše úvaha o využití @modelcontextprotocol/inspector pro automatizované testy je naprosto 
správná a klíčová pro zajištění kvality. Právě jeho CLI komponenta, 
@modelcontextprotocol/inspector-cli, je navržena pro tyto scénáře. 
Postup pro robustní integrační testy v CI/CD: 
1. Spuštění prostředí: V CI pipeline se pomocí docker-compose -f 
docker-compose.test.yml up -d spustí celý testovací stack – váš mcp-prompts-ts server a 
jeho závislosti (např. testovací PostgreSQL databáze). 
2. Spuštění testovacího skriptu: Vytvoříte testovací soubor (např. 
tests/e2e/prompts.e2e.test.ts), který bude používat exec z Node.js k volání Inspector CLI. 
3. Volání a validace: Skript zavolá CLI k provedení akcí (např. vytvoření promptu) a 
následně k jeho načtení. JSON výstup z CLI je parsován a porovnán s očekávanými 
hodnotami pomocí assert. 
Příklad vylepšeného testovacího skriptu v package.json: 
"scripts": { 
"test:e2e": "docker-compose -f docker-compose.test.yml up -d && jest --testMatch '**/tests/e2e/**/*.e2e.test.ts' && docker-compose -f 
docker-compose.test.yml down" 
} 
Příklad prompts.e2e.test.ts (použití jest): 
import { execSync } from 'child_process'; 
import { describe, it, expect, beforeAll, afterAll } from 
'@jest/globals'; 
describe('MCP Prompts E2E Tests', () => { 
    const TEST_PROMPT_ID = `e2e-${Date.now()}`; 
    const TEST_PROMPT_CONTENT = "This is a test prompt for E2E 
validation."; 
 
    it('should create a new prompt via inspector-cli', () => { 
        const command = `npx @modelcontextprotocol/inspector-cli 
tools/call --tool-name add_prompt --tool-arg id='${TEST_PROMPT_ID}' --tool-arg content='${TEST_PROMPT_CONTENT}'`; 
        const output = execSync(command).toString(); 
        // A successful call should return a confirmation. 
        expect(output).toContain('Tool call successful'); 
    }); 
 
    it('should retrieve the created prompt and validate its content', 
() => { 
        const command = `npx @modelcontextprotocol/inspector-cli 
tools/call --tool-name get_prompt --tool-arg id='${TEST_PROMPT_ID}'`; 
        const output = execSync(command).toString(); 
        const result = JSON.parse(output); 
 
        expect(result.id).toBe(TEST_PROMPT_ID); 
        expect(result.content).toBe(TEST_PROMPT_CONTENT); 
    }); 
}); 
 
Tento přístup je výrazně robustnější, protože testuje plně sestavenou a spuštěnou aplikaci v 
kontejneru, nikoli jen izolované jednotky kódu. 
3. Implementace a síťové zpřístupnění MCP serveru 
Podpora HTTP/SSE: Vaše zjištění jsou správná. StreamableHttpServerTransport z 
@modelcontextprotocol/sdk je moderní a doporučený způsob implementace. Server-Sent 
Events (SSE) jsou protokolem, který tento transport využívá pod kapotou pro zajištění real-time 
obousměrné komunikace, což je klíčové pro streamování odpovědí z LLM. Vaše implementace 
v sse.ts je tedy v souladu s nejlepšími postupy [3, 4]. 
Zpřístupnění na lokální síti (Binding na 0.0.0.0): Toto je kriticky důležitý a často přehlížený 
detail. 
● localhost (nebo 127.0.0.1): Je adresa pro "loopback". Server naslouchající na této 
adrese přijímá spojení pouze ze stejného stroje. Je to bezpečný výchozí stav pro lokální 
vývoj. 
● 0.0.0.0: Je speciální adresa, která serveru říká, aby naslouchal na všech dostupných 
síťových rozhraních (Wi-Fi, Ethernet atd.). To je nezbytné, pokud chcete, aby k serveru 
běžícímu na vašem počítači přistupovala například mobilní aplikace ve stejné Wi-Fi síti. 
Bezpečnostní implikace: Zpřístupnění serveru na síti (0.0.0.0) znamená, že jakékoli zařízení 
ve stejné síti se k němu může pokusit připojit. Proto je nezbytné, aby server, který takto běží, 
měl implementovanou robustní autentizaci a autorizaci. Pro lokální vývoj to může být 
jednoduchý API klíč v hlavičce, pro produkci by to měl být plnohodnotný mechanismus jako 
OAuth 2.0. MCP protokol toto podporuje a počítá s tím. 
4. Integrace MCP serverů do VS Code 
Vaše analýza integrace do VS Code je přesná a ilustruje sílu nativní podpory MCP v moderních 
IDE. 
Příklad konfigurace v .vscode/mcp.json: 
{ 
  "servers": [ 
    { 
      "name": "Local Prompts Server (Postgres)", 
      "command": "pnpm", // Use pnpm to run script from package.json 
      "args": ["run", "dev"], // Assumes you have a "dev" script 
      "env": { 
        "STORAGE_TYPE": "postgres", 
        "DATABASE_URL": "${input:dbConnectionString}", // Securely 
prompts the user 
        "PORT": "3001" 
      } 
    } 
  ], 
  "inputs": [ 
    { 
        "id": "dbConnectionString", 
        "name": "PostgreSQL Connection String", 
        "description": "Enter the connection string for your local 
PostgreSQL database.", 
        "type": "promptString", 
        "password": true 
    } 
  ] 
} 
 
Klíčové výhody tohoto přístupu: 
● ${input:id}: Tento mechanismus je klíčový. Místo hardkódování citlivých údajů (jako je 
DATABASE_URL) do souboru, který může být omylem commitnut, VS Code zobrazí 
uživateli dialogové okno pro zadání hodnoty [6]. 
● Bezpečné uložení: Po zadání se tato hodnota bezpečně uloží do šifrovaného úložiště VS 
Code (Secret Storage), nikoli do textového souboru. 
● Přímá interakce: Po spuštění můžete v Copilot Chatu přímo používat nástroje 
(#myPromptsServer/add_prompt), prompry (/myPromptsServer/code-review-assistant) a 
zdroje (@myPromptsServer/prompts/test-prompt), což dramaticky zrychluje vývoj a 
testování. 
5. Strategická volba klientské aplikace 
Vaše zhodnocení návratnosti investic (ROI) pro různé klientské aplikace je strategicky správné. 
Klient 
VS Code 
Extension 
Android App 
Chrome 
Extension 
ROI 
Vysoké 
Složitost 
Nízká 
Střední až Vysoké Vysoká 
Nízké 
Vysoká 
Strategický soulad Doporučení 
Perfektní. Cílová 
skupina jsou 
vývojáři. 
Jednoznačná 
první volba. 
Poskytuje 
okamžitou hodnotu 
cílovému publiku v 
jejich primárním 
nástroji. 
Vynikající. V 
souladu s vaší 
Rust implementací 
a mobilní vizí. 
Nízký. Případy 
použití jsou méně 
zřejmé. 
Strategická druhá 
volba. Otevírá 
nový trh a 
demonstruje výkon 
mcp-prompts-rs. 
Nedoporučeno. 
Vysoká složitost 
(proxy, 
bezpečnostní 
omezení) s nízkou 
přidanou 
hodnotou. 
Doporučení: Zaměřte se na vytvoření špičkové VS Code extenze. To nejen uspokojí vaši 
primární uživatelskou základnu, ale také poslouží jako referenční implementace pro ostatní, jak 
integrovat mcp-prompts do svých nástrojů. 
6. Validace architektonických a technologických rozhodnutí 
Je migrace na multi-repo správná volba? Ano, jednoznačně. Vaše strategické dokumenty a 
analýza správně identifikují, že přechod na multi-repo je nutným krokem pro evoluci projektu z 
produktu na platformu [4]. Výhody (nezávislé verzování, jasné vlastnictví, efektivní CI/CD) 
výrazně převažují nad zvýšenou koordinační režií, kterou lze efektivně řídit meta-repozitářem 
[4]. Tento krok je zásadní pro budování komunity a umožnění externích příspěvků. 
Je TypeScript správná volba? Nebyl by lepší Rust nebo Python? Vaše polyglotní 
strategie je správná a představuje konkurenční výhodu. 
● TypeScript (mcp-prompts-ts): Je a měl by zůstat primární, referenční implementací. 
Je to de facto standard MCP ekosystému, má nejvyspělejší SDK a největší komunitu. 
Udržuje vás v centru dění. 
● Rust (mcp-prompts-rs): Není náhradou, ale strategickým doplněním. Je ideální pro 
vysoce výkonné a paměťově úsporné scénáře (nativní mobilní služby, edge computing), 
kam se TypeScript nehodí [9]. Umožňuje vám oslovit zcela jiný segment trhu. 
● Python (mcp-project-orchestrator): Je perfektní volbou pro orchestrační a logickou 
vrstvu. Síla Pythonu v datové vědě, skriptování a AI knihovnách z něj činí ideální nástroj 
pro psaní komplexních "agentů", kteří konzumují nástroje poskytované vašimi TS a Rust 
servery. 
FastMCP vs. oficiální SDK: FastMCP a podobné frameworky nabízejí vyšší úroveň abstrakce 
pro rychlejší vývoj, ale za cenu menší kontroly nad protokolem. Pro referenční implementaci, 
jako je mcp-prompts, je držet se oficiálního SDK a mít plnou kontrolu naprosto validní a často i 
preferovanou volbou. Ukazujete tím, jak protokol funguje bez dalších vrstev abstrakce. 
Závěr: Vaše architektonická a technologická rozhodnutí jsou solidní, dobře promyšlená a v 
souladu s nejlepšími postupy v oboru. Pokračujte v nastoleném směru, s důrazem na dokončení 
multi-repo migrace a posílení testovací strategie. 
Citace: 
[1] MCP Prompts: Migration and Integration, "Use MCP servers in VS Code (Preview)" [2] MCP 
Prompts: Migration and Integration, "Model Context Protocol - Cursor" [3] 
sparesparrow/mcp-prompts repository analysis [4] Meta-repozitář pro MCP Prompts.pdf [5] 
MCP Prompts: Migration and Integration, "mcp-remote - npm" [6] MCP Prompts: Migration and 
Integration, "Use MCP servers in VS Code (Preview)" [7] MCP Prompts: Migration and 
Integration, "The Complete MCP Experience: Full Specification Support in VS Code" [8] MCP 
Prompts: Migration and Integration, "MCP servers | Visual Studio Code Extension API" [9] 
Analýza a Strategie MCP Prompts.pdf [10] Návrh vícerepo struktury MCP Prompts.pdf [11] 
sparesparrow/mcp-project-orchestrator repository analysis 


# 
======================================================================
 =================== 
# Docker Compose pro mcp-prompts Ekosystém 
# 
# Tento soubor orchestruje spuštění všech klíčových služeb potřebných 
pro vývoj a 
# testování v multi-repo architektuře mcp-prompts. 
# 
# Pro spuštění: docker-compose up --build 
# Pro zastavení: docker-compose down 
# 
# Předpokládaná struktura adresářů (klonované repozitáře v meta-repo): 
# /mcp-prompts-meta/ 
#   ├── docker-compose.yml 
#   ├── .env 
#   ├── mcp-prompts-ts/ 
#   ├── mcp-prompts-rs/ 
#   ├── mcp-server-filesystem/ 
#   └── mcp-server-github/ 
#   ... (atd.) 
# 
======================================================================
 =================== 
 
version: '3.8' 
 
services: 
  # --------------------------------------------------------------------------------------- 
  # Databázová služba (PostgreSQL) 
  # Poskytuje perzistentní úložiště pro hlavní mcp-prompts-ts server. 
  # --------------------------------------------------------------------------------------- 
  postgres: 
    image: postgres:15-alpine 
    container_name: mcp_postgres_db 
    restart: always 
    environment: 
      POSTGRES_USER: ${POSTGRES_USER} 
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} 
      POSTGRES_DB: ${POSTGRES_DB} 
    volumes: 
      - postgres_data:/var/lib/postgresql/data 
    ports: 
      - "${POSTGRES_PORT}:5432" 
    networks: 
      - mcp-net 
    healthcheck: 
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d 
${POSTGRES_DB}"] 
      interval: 10s 
      timeout: 5s 
      retries: 5 
 
  # --------------------------------------------------------------------------------------- 
  # Hlavní Server (TypeScript implementace) 
  # Srdce ekosystému, spravuje a poskytuje prompty a workflow. 
  # --------------------------------------------------------------------------------------- 
  mcp-prompts-ts: 
    container_name: mcp_prompts_ts_server 
    build: 
      context: ./mcp-prompts-ts 
      dockerfile: Dockerfile 
    restart: unless-stopped 
    depends_on: 
      postgres: 
        condition: service_healthy 
    ports: 
      - "${MCP_PROMPTS_TS_PORT}:3000" 
    networks: 
      - mcp-net 
    environment: 
      # --- Připojení k databázi --- 
      DATABASE_URL: 
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POS
 TGRES_DB} 
      # --- Konfigurace ostatních MCP serverů pro agentní orchestraci --- 
      MCP_SERVER_FILESYSTEM_URL: http://mcp-server-filesystem:3001 
      MCP_SERVER_GITHUB_URL: http://mcp-server-github:3002 
      MCP_SERVER_POSTGRES_URL: http://mcp-server-postgres:3003 # 
Příklad, pokud by byl potřeba další 
      MCP_SERVER_MEMORY_URL: http://mcp-server-memory:3004 
      MCP_SERVER_SEQ_THINKING_URL: http://mcp-server-seq-thinking:3005 
    # --- Pro lokální vývoj s hot-reloadingem odkomentujte následující 
řádky --- 
    # volumes: 
    #   - ./mcp-prompts-ts/src:/usr/src/app/src 
    #   - ./mcp-prompts-ts/prompts:/usr/src/app/prompts 
 
  # --------------------------------------------------------------------------------------- 
  # Ostatní specializované MCP servery pro simulaci hierarchie agentů 
  # Každý server poskytuje specifickou "dovednost" pro orchestrátora. 
  # --------------------------------------------------------------------------------------- 
  mcp-server-filesystem: 
    container_name: mcp_server_filesystem 
    build: ./mcp-server-filesystem # Předpokládá existenci Dockerfile 
    restart: unless-stopped 
    ports: 
      - "3001:3000" 
    networks: 
      - mcp-net 
    volumes: 
      - ./shared-workspace:/workspace # Mapuje sdílený adresář pro 
testování 
    environment: 
      # Umožní serveru zapisovat do mapovaného adresáře 
      MCPFS_ROOT: /workspace 
      MCPFS_READONLY: "false" 
 
  mcp-server-github: 
    container_name: mcp_server_github 
    build: ./mcp-server-github # Předpokládá existenci Dockerfile 
    restart: unless-stopped 
    ports: 
      - "3002:3000" 
    networks: 
      - mcp-net 
    environment: 
      GITHUB_TOKEN: ${GITHUB_TOKEN} # Vyžaduje osobní přístupový token 
 
  mcp-server-memory: 
    container_name: mcp_server_memory 
    build: ./mcp-server-memory # Předpokládá existenci Dockerfile 
    restart: unless-stopped 
    ports: 
      - "3004:3000" 
    networks: 
      - mcp-net 
 
  mcp-server-seq-thinking: 
    container_name: mcp_server_seq_thinking 
    build: ./mcp-server-seq-thinking # Předpokládá existenci 
Dockerfile 
    restart: unless-stopped 
    ports: 
      - "3005:3000" 
    networks: 
      - mcp-net 
    environment: 
      OPENAI_API_KEY: ${OPENAI_API_KEY} # Vyžaduje klíč pro LLM 
 
  # --------------------------------------------------------------------------------------- 
  # Alternativní Server (Rust implementace) 
  # Pro testování a porovnání výkonu. 
  # --------------------------------------------------------------------------------------- 
  mcp-prompts-rs: 
    container_name: mcp_prompts_rs_server 
    build: 
      context: ./mcp-prompts-rs 
      dockerfile: Dockerfile 
    restart: unless-stopped 
    ports: 
      - "${MCP_PROMPTS_RS_PORT}:8000" 
    networks: 
      - mcp-net 
    environment: 
      # Rust server může mít vlastní konfiguraci 
      RUST_LOG: info 
      # Může se připojit ke stejné DB nebo mít vlastní 
      DATABASE_URL: 
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POS
 TGRES_DB} 
 
 
# 
======================================================================
 =================== 
# Definice sítí a volumes 
# 
======================================================================
 =================== 
networks: 
  mcp-net: 
    driver: bridge 
 
volumes: 
postgres_data: 
driver: local 

An Architectural Review and Strategic 
Implementation Guide for the 
mcp-prompts Ecosystem 
Section I: Strategic Architectural Analysis: The 
Evolution of the mcp-prompts Ecosystem 
This section provides a comprehensive analysis of the mcp-prompts project, validating the 
strategic decision to migrate from a monorepo to a multi-repo architecture. It examines the 
foundational principles of the Model Context Protocol (MCP), evaluates the limitations of the 
current project structure, and assesses the proposed multi-repo topology and the progress of 
the migration effort. 
1.1 The Model Context Protocol (MCP) as a Foundational Standard 
The Model Context Protocol (MCP) has emerged as a critical open standard designed to solve a 
fundamental challenge in the development of AI applications: the isolation of Large Language 
Models (LLMs) from real-world data and tools. Historically, connecting an LLM to a database, 
API, or local filesystem required developers to build custom, one-off integrations. This approach 
resulted in a fragmented ecosystem of brittle, unscalable, and difficult-to-maintain connectors, 
severely limiting the practical utility of AI agents. 
MCP addresses this by establishing a standardized, open protocol for these connections, 
conceptualized as a "USB-C port for AI applications". It separates the concern of providing 
context from the core logic of the LLM interaction itself, replacing a chaotic landscape of 
bespoke integrations with a single, reliable protocol. This standardization is the key to building 
more robust, scalable, and composable AI systems. 
The protocol is built upon a client-server architecture with three primary components : 
● Host: The LLM application that initiates connections and consumes the capabilities 
provided by servers. Examples include AI assistants like Claude Desktop, IDEs like Visual 
Studio Code, or specialized developer tools like Cursor. The Host acts as the ultimate 
guardian of user security and privacy, mediating all interactions and obtaining explicit user 
consent for actions. 
● Client: A connector component residing within a Host. Its purpose is to establish and 
maintain a dedicated connection with a single MCP Server, managing the transport layer 
and proxying the server's capabilities to the Host. 
● Server: A service that exposes real-world capabilities—data and functionality—to the 
LLM. Servers can be implemented in any language and run locally or remotely. 
This modular architecture allows for the creation of specialized, reusable "skills" that can be 
developed and deployed independently. The strategic goal of the mcp-prompts project—to 
become a "single source of truth" for managing prompt templates and workflows—aligns 
perfectly with this philosophy. It aims to provide a foundational, composable skill that other AI 
agents and applications can leverage. 
1.2 The Strategic Imperative: Why Migrate from Monorepo to 
Multi-Repo? 
The mcp-prompts project has reached a high level of technical maturity. The existing codebase 
is built on a modern TypeScript stack, utilizes npm workspaces for internal package 
management, and is supported by a comprehensive suite of unit and integration tests, along 
with a robust CI/CD and Docker deployment setup. However, the very monorepo structure that 
facilitated its rapid initial development has now become a strategic bottleneck, hindering the 
project from realizing its full potential as a platform. 
The monorepo architecture imposes several critical limitations in the context of a growing and 
diversifying ecosystem: 
● Versioning Lockstep: This is the most significant constraint. A minor, non-breaking 
change, such as adding a new prompt template to the prompt collection, forces a version 
bump and release of the entire server package. This is semantically incorrect and creates 
confusion for consumers of the package, who may see a new version without any 
changes to the core server logic. True modularity requires that components with different 
lifecycles can be versioned and released independently. 
● Cognitive and Ownership Burden: A single, large repository makes it difficult to 
establish clear boundaries of ownership and responsibility. A team focused on the native 
Android application, for instance, is unnecessarily burdened with the complexity of the 
PostgreSQL database adapter or the CI pipeline for the core TypeScript server. This 
increases the cognitive load on all contributors and slows down the onboarding process 
for new developers who must grapple with the entire codebase at once. 
● CI/CD Inefficiency: While the CI pipeline is sophisticated, its efficiency degrades as the 
project grows. A change in an isolated package, like the prompt catalog, currently triggers 
the test suite for the entire project, including potentially slow and expensive integration 
tests for the server and database. This wastes compute resources and lengthens the 
feedback loop for developers, contradicting the principles of efficient continuous 
integration. 
The transition to a multi-repo architecture directly addresses these limitations. It introduces the 
necessary separation of concerns to enable independent lifecycles, fosters clear ownership and 
specialization, and significantly lowers the barrier for external contributions. This architectural 
evolution is not merely a technical refactoring; it is a strategic pivot that transforms mcp-prompts 
from a single product into an extensible platform, which is essential for achieving its vision of 
becoming a central component in the open MCP ecosystem. 
The following table summarizes the key trade-offs and validates the decision to migrate. 
Factor 
Dependency 
Management 
Current State 
(Monorepo) 
Unified package.json; 
simple management of 
internal dependencies. 
Proposed State 
(Multi-repo) 
Risk and Mitigation 
Clearly defined external 
dependencies; each 
implementation 
manages its own. 
Risk: Version skew of 
shared packages. 
Mitigation: Meta-repo 
generates a 
compatibility matrix to 
track valid version 
combinations. 
Factor Current State 
(Monorepo) 
Proposed State 
(Multi-repo) 
Risk and Mitigation 
CI/CD Speed A single pipeline runs 
all tests, which can be 
slow and costly for 
small changes. 
CI runs only for the 
changed component, 
leading to faster, 
cheaper pipelines. 
Risk: More complex 
orchestration of 
cross-repo integration 
tests. Mitigation: 
Meta-repo orchestrates 
"suite" integration tests 
that pull together the 
latest versions of all 
components. 
Code Ownership & 
Access 
All contributors have 
access to the entire 
codebase. 
Fine-grained access 
control can be applied 
at the repository level. 
Risk: Fragmentation of 
knowledge. Mitigation: 
Centralized, high-level 
documentation in the 
meta-repository serves 
as the canonical source 
of information. 
Atomic Changes Refactoring across 
components is 
straightforward within a 
single commit. 
Cross-component 
changes require 
coordinated pull 
requests across 
multiple repositories. 
Risk: Increased 
coordination overhead. 
Mitigation: The 
proposed CI/CD 
orchestration model 
using reusable 
workflows helps 
streamline and 
automate this process. 
Onboarding New 
Languages 
Adding a new language 
(e.g., Python) 
complicates the central 
build system and 
increases repository 
bloat. 
A new team can create 
a repository and start 
development 
immediately, depending 
only on the versioned 
contracts and collection 
packages. 
N/A 
1.3 Analysis of the Proposed Multi-Repo Topology 
The proposed multi-repo architecture is a well-reasoned implementation of Domain-Driven 
Design principles, deconstructing the monolith into a set of specialized, logically coherent 
repositories. Each repository represents a distinct "bounded context" with a clear purpose and 
API. 
● mcp-prompts-contracts: This is correctly identified as the foundational cornerstone of 
the entire ecosystem. It will house the language-agnostic API definitions: TypeScript 
interfaces, Zod validation schemas, and, as will be recommended later in this report, the 
formal OpenAPI specification. By centralizing the API contract, this repository ensures 
that all implementations (TypeScript, Rust, Python, etc.) are building against the same 
stable, versioned specification, which dramatically simplifies integration and the 
onboarding of new language support. The existence of a 
packages/mcp-prompts-contracts directory in the current monorepo confirms that this is 
the correct and intended path forward. 
● mcp-prompts-collection: This repository correctly isolates the project's core intellectual 
property—the prompt templates themselves—into a shared, independently versioned 
asset. By packaging the prompt collection for distribution via both NPM (for the TypeScript 
ecosystem) and Cargo (for the Rust ecosystem), the design decouples the prompt data 
from the server implementations. This ensures that all servers, regardless of language, 
consume an identical, validated set of prompts. 
● mcp-prompts-ts & mcp-prompts-rs: The separation of the TypeScript and Rust server 
implementations into their own repositories is a critical step towards enabling autonomy. 
Each team can manage its own dependencies, testing frameworks, and release cycles in 
a manner idiomatic to its respective ecosystem. The dual-language strategy itself is a 
significant advantage. The TypeScript server caters to the vast and popular Node.js 
ecosystem, ideal for cloud and standard server deployments. The Rust server, with its 
explicit goals of high performance (>1000 req/s) and a low memory footprint (<10MB), 
targets a different and strategically important niche: resource-constrained environments 
such as edge computing, high-throughput sidecars, or native mobile services, as planned 
for Android. This dual offering maximizes the platform's potential addressable market. 
● mcp-prompts-pg & mcp-prompts-aidl: Extracting highly specialized components is a 
sound architectural decision. The PostgreSQL adapter involves a specific database 
schema and dependencies, justifying its isolation into a dedicated package. Similarly, the 
Android implementation, with its complex mix of a native Rust service, AIDL for 
inter-process communication, and the Kotlin application code, will benefit immensely from 
having its own repository to manage its unique build and deployment pipeline. 
● mcp-prompts (Meta-Repo): The proposal to use the root mcp-prompts repository as a 
non-code, meta-orchestration hub is a mature pattern for managing multi-repo 
ecosystems. Its responsibilities—orchestrating "suite" builds, generating compatibility 
matrices, managing releases, and hosting high-level documentation—are essential for 
mitigating the "coordination overhead" that can otherwise plague distributed projects. It 
becomes the central "lighthouse" for the entire project. 
Target Repository 
The following table provides a clear, actionable migration map for the engineering team, defining 
the boundaries and responsibilities of each new repository. 
Source Path (in 
sparesparrow/mcp-pro
 mpts) 
Published Package 
Name 
src/interfaces.ts, 
src/schemas.ts 
mcp-prompts-contracts @sparesparrow/mcp-pr
 ompts-contracts 
Key Responsibilities 
Defines the 
language-agnostic data 
contracts and API 
specifications for the 
entire ecosystem. 
packages/mcp-prompts-catalog/, prompts/ 
src/prompt-service.ts, 
src/adapters/*, etc. 
mcp-prompts-collection @sparesparrow/mcp-pr
 ompts-collection 
mcp-prompts-ts 
@sparesparrow/mcp-pr
 ompts-ts 
Manages and versions 
the curated collection of 
default and community 
prompt templates. 
The primary TypeScript 
server implementation, 
containing all business 
Source Path (in 
sparesparrow/mcp-pro
 mpts) 
Target Repository Published Package 
Name 
Key Responsibilities 
logic and storage 
adapters. 
rust/ mcp-prompts-rs mcp-prompts-rs (Cargo 
Crate) 
The high-performance 
Rust server 
implementation, 
optimized for native 
and 
resource-constrained 
environments. 
storage/postgres/, 
docker/postgres/init/ 
mcp-prompts-pg @sparesparrow/mcp-pr
 ompts-pg 
A specialized package 
for the PostgreSQL 
storage adapter, 
including its schema 
and deployment 
configurations. 
android/, android_app/, 
mcp-prompts-aidl/ 
mcp-prompts-aidl (AAR/APK) The complete Android 
application, including 
the native Rust service 
and AIDL interfaces. 
.github/, docs/, 
README.md 
mcp-prompts (Meta) N/A Manages overall 
project documentation, 
issue tracking, and 
CI/CD orchestration for 
the ecosystem. 
1.4 Review of Migration Progress 
While direct access to the specific pull requests (#34 and #35) was unavailable , an analysis of 
the repository branches mentioned in the query (feature/migration-preparation and master) and 
the newly created repositories confirms that the migration is underway and following the 
proposed plan. The branches show a clear and deliberate deconstruction of the monolith, with 
foundational components being extracted into their respective new homes. The creation and 
population of repositories like mcp-prompts-contracts, mcp-prompts-collection, and 
mcp-prompts-rs align perfectly with the architectural strategy documents. This work successfully 
executes the most critical first phase of the migration: establishing the shared, foundational 
packages that all other components will depend on. The project is well-positioned to proceed 
with the migration of the remaining language-specific implementations. 
Section II: Ecosystem Leverage and Agentic Design 
Patterns 
To realize its full potential, mcp-prompts must not exist in isolation. It should be designed to 
leverage the rich and growing MCP ecosystem and serve as a fundamental component within 
sophisticated, multi-agent systems. This section explores how to achieve this by integrating with 
existing MCP packages and adopting modern agentic architectural patterns. 
2.1 Leveraging Higher-Level Frameworks and Utilities 
The MCP ecosystem offers several packages that can accelerate development, inform design 
decisions, or bridge compatibility gaps. 
● Scaffolding and Frameworks: 
○ @modelcontextprotocol/create-server: This package is a CLI tool for quickly 
scaffolding a new, simple MCP server. While the mcp-prompts project has 
advanced far beyond this initial stage, understanding the "happy path" this tool 
creates for new developers is valuable. It can inform the project's own 
documentation and getting-started guides to ensure a smooth onboarding 
experience for new contributors. 
○ mcp-framework and fastmcp: These are higher-level, opinionated frameworks built 
on top of the official @modelcontextprotocol/sdk. They offer features like automatic 
directory-based discovery of tools, built-in session management, and simplified 
APIs using Zod schemas. While adopting such a framework wholesale would add 
an extra layer of abstraction—potentially undesirable for a reference 
implementation like mcp-prompts—analyzing their design patterns can provide 
excellent ideas for refining the mcp-prompts-ts implementation. For example, the 
automatic schema validation and type inference patterns in mcp-framework are 
best practices that could be emulated. 
● Connectivity and Compatibility Utilities: 
○ mcp-proxy and mcp-remote: The existence of these packages is a crucial indicator 
of the current state of the MCP ecosystem. They were created to bridge the gap 
between local, stdio-based clients (like older versions of Claude Desktop) and the 
growing number of remote, HTTP-based servers. While mcp-prompts should 
prioritize being a first-class citizen in the remote-first future by providing a robust 
StreamableHttpServerTransport, it is important to acknowledge that users may 
initially need tools like mcp-remote to connect. For advanced use cases, mcp-proxy 
could be used within a docker-compose setup to aggregate the mcp-prompts server 
alongside other specialized MCP servers, exposing them all through a single, 
unified endpoint. 
The following table provides a strategic overview of relevant ecosystem packages and their 
potential utility to the mcp-prompts project. 
Package 
Primary Function 
@modelcontextprotocol/sdk 
Official TypeScript SDK 
providing core MCP 
server/client classes. 
Recommended Use Case for 
mcp-prompts 
Core Dependency. The project 
should continue to use this as 
its foundational library to 
remain a canonical reference 
implementation. 
@modelcontextprotocol/create
server 
Scaffolds a new, basic MCP 
server project. 
Informational. Use as a 
reference for creating simple, 
clear "Getting Started" 
documentation for new 
contributors. 
Package Primary Function Recommended Use Case for 
mcp-prompts 
mcp-framework / fastmcp Opinionated frameworks that 
simplify server creation. 
Inspiration. Do not adopt as a 
direct dependency, but analyze 
their design patterns (e.g., Zod 
integration, session 
management) for potential 
improvements to 
mcp-prompts-ts. 
mcp-proxy / mcp-remote Bridge the gap between stdio 
clients and HTTP servers. 
User Guidance & Advanced 
Deployment. Document for 
users as a potential 
connectivity solution. 
mcp-proxy can be used in 
advanced docker-compose 
setups to create a unified 
gateway for multiple MCP 
servers. 
@modelcontextprotocol/inspect
 or 
A comprehensive suite for 
testing and debugging MCP 
servers. 
Essential Dev/Test Tool. 
Integrate deeply into the 
development workflow for both 
interactive debugging and 
automated CI testing. 
2.2 Architecting a Multimodal Hierarchy of Agents 
The true power of MCP is realized when it is used to orchestrate multiple, specialized AI agents 
into a cohesive system capable of solving complex, multi-step problems. Modern agentic 
architectures are moving away from monolithic agents toward collaborative, multi-agent systems 
that employ patterns like "LLM as a Router" or a "Supervisor/Worker" hierarchy. MCP provides 
the standardized communication backbone necessary to build these systems in a robust and 
governable way. 
In such an architecture, mcp-prompts evolves from a simple prompt database into a strategic 
cognitive core or skill library for the entire agentic system. It holds the persistent, versioned 
knowledge of how to perform complex tasks. 
Consider the following agentic workflow for a sophisticated task like "Refactor the UserProfile 
component to use the new design system, update the associated documentation, and create a 
pull request." 
1. Intent & Planning (Orchestrator Agent): A primary "Orchestrator" agent receives the 
high-level goal. It uses the @modelcontextprotocol/server-sequential-thinking server 
to perform a "chain of thought" reasoning process, breaking the goal into a logical 
sequence of steps: "1. Analyze current component code. 2. Fetch new design system 
specifications. 3. Apply code changes. 4. Generate new documentation from code. 5. 
Create a GitHub pull request for review.". 
2. Prompt & Workflow Retrieval: For each step in the plan, the Orchestrator agent queries 
the mcp-prompts server to retrieve the appropriate, structured prompt template (e.g., 
code-refactoring-template, docs-from-code-template). These are not just simple text 
strings; the MutablePrompt interface allows them to be rich, structured objects containing 
metadata, required tools, and example inputs/outputs. 
3. Context Gathering & Delegation: The Orchestrator delegates context-gathering tasks to 
specialized, single-purpose agents (other MCP servers): 
○ It invokes the @modelcontextprotocol/server-filesystem to read the source code 
of the current UserProfile component and its related files. 
○ It could use a hypothetical figma-mcp-server to fetch visual design specifications as 
a multimodal resource (e.g., an image). 
○ It might use the @modelcontextprotocol/server-postgres to query a project 
management database for the original feature ticket associated with this 
component, providing additional context. 
4. Execution & Action: The Orchestrator synthesizes the context from the specialized 
agents with the workflow from mcp-prompts to construct a final prompt for the LLM. The 
LLM generates the refactored code. The Orchestrator then uses the write_file and 
edit_file tools from the server-filesystem to apply these changes to the user's local 
workspace. 
5. Version Control & Completion: Finally, the Orchestrator agent uses the tools provided 
by @modelcontextprotocol/server-github (e.g., create_branch, create_or_update_file, 
create_pull_request) to commit the changes and open a pull request for human review. 
6. Persistent Memory: Throughout this entire multi-step process, the Orchestrator agent 
uses the @modelcontextprotocol/server-memory to log its state (e.g., "Step 3 
completed," "PR #123 created"). This provides crucial persistence, allowing the workflow 
to be paused and resumed, as well as providing a complete, auditable trace of the agent's 
actions. 
This architecture demonstrates that mcp-prompts is not merely a passive tool being called. It is 
an active and essential participant in the agent's cognitive loop, providing the structured plans 
and workflows that guide the entire process. This positions the project not just as a prompt 
management utility, but as a foundational component for building the next generation of reliable, 
auditable, and composable enterprise AI systems. 
Section III: Multi-Language Interoperability via API 
Contracts 
A primary challenge in any multi-language, multi-repository architecture is ensuring that different 
implementations of the same service remain perfectly synchronized. For mcp-prompts, with its 
parallel TypeScript and Rust implementations, preventing "implementation drift" is paramount. 
The most robust and modern solution to this problem is to establish a single, machine-readable 
API contract that serves as the undisputed source of truth for all implementations. 
3.1 OpenAPI as the Single Source of Truth 
The OpenAPI Specification (OAS) is the industry-standard, language-agnostic interface 
definition language for describing RESTful APIs. By adopting an OpenAPI-first strategy, the 
mcp-prompts project can create a canonical definition of its API before a single line of 
TypeScript or Rust code is written. This "design-first" approach is considered a best practice 
because it forces clarity and agreement on the API contract upfront and enables a wealth of 
automation. 
This OpenAPI definition, likely a openapi.yaml or openapi.json file, will become the most 
important asset within the mcp-prompts-contracts repository. It will formally describe every 
tool, its parameters, its request body, and its response schemas. By making this versioned 
artifact the central dependency for both the mcp-prompts-ts and mcp-prompts-rs repositories, 
the project establishes a clear and enforceable source of truth. 
3.2 Best Practices for OpenAPI in a Multi-Repo Architecture 
To effectively manage the OpenAPI definition within the new architecture, the following best 
practices should be adopted: 
● Centralized and Modular: The primary OpenAPI definition file should reside in the 
mcp-prompts-contracts repository. To maintain readability and manageability as the API 
grows, the definition should be split into multiple files (e.g., one file for path definitions, 
another for component schemas) and then bundled into a single, distributable file as part 
of the CI process. This approach is supported by tools like Redocly's bundler. 
● Reusable Components: Common data structures, such as the Prompt object or 
standard error responses, should be defined once in the components/schemas section of 
the OpenAPI file. These schemas can then be referenced ($ref) throughout the API 
definition, which reduces duplication, enforces consistency, and makes the API easier to 
maintain. 
● CI/CD Validation: The CI/CD pipeline for the mcp-prompts-contracts repository must 
include a robust validation and linting step. This ensures that any proposed change to the 
OpenAPI definition is syntactically correct, adheres to the specification, and follows 
project-specific style conventions. This prevents invalid contracts from ever being 
published. 
3.3 Automated Code Generation Workflow 
The true power of an OpenAPI-first strategy is realized through automated code generation. The 
CI/CD pipeline in the mcp-prompts-contracts repository should be configured to do more than 
just validate the spec; it should actively generate code for its downstream consumers. This 
workflow fundamentally de-risks the multi-language architecture by eliminating the possibility of 
manual implementation errors and ensuring the different codebases can never drift out of sync. 
The recommended workflow is as follows: 
1. A developer proposes a change to the API by submitting a pull request to the 
openapi.yaml file in the mcp-prompts-contracts repository. 
2. The PR triggers a CI job that lints and validates the proposed OpenAPI changes. 
3. Once the PR is approved and merged, a release workflow is triggered. 
4. This release workflow publishes a new version of the 
@sparesparrow/mcp-prompts-contracts package to NPM. This package contains the 
OpenAPI specification itself. 
5. Crucially, the workflow then uses code generation tools to create language-specific clients 
and types: 
○ For TypeScript (mcp-prompts-ts): The pipeline uses a tool like openapi-typescript 
or @hey-api/openapi-ts to generate up-to-date TypeScript interfaces and Zod 
schemas directly from the new OpenAPI spec. These generated artifacts can be 
automatically published as a new version of a private 
@sparesparrow/internal-ts-types package or committed to the mcp-prompts-ts 
repository via a bot. 
○ For Rust (mcp-prompts-rs): The pipeline uses a tool like the openapi-generator-cli 
with the rust generator. This generates the corresponding Rust struct definitions 
and serde annotations. These artifacts are then published as a new version of an 
internal mcp-prompts-internal-rust-types crate or committed to the mcp-prompts-rs 
repository. 
6. This automated process triggers downstream CI pipelines in the mcp-prompts-ts and 
mcp-prompts-rs repositories. If the API change was breaking, these pipelines will fail at 
the compilation stage, immediately notifying the respective teams that they need to 
update their implementation to conform to the new contract. 
This automated, contract-driven workflow transforms the API specification from a piece of 
passive documentation into an active, enforced, and integral part of the development and CI/CD 
process. It makes the mcp-prompts-contracts repository the most critical piece of infrastructure 
in the ecosystem, and its governance must be managed with a clear understanding of its 
cascading impact. 
Section IV: Project Configuration and Tooling Deep 
Dive 
A successful multi-repo architecture requires meticulous configuration of the underlying 
toolchain. This section provides a detailed, file-by-file audit of the project's key configuration 
files, offering prescriptive recommendations to optimize for a modern, dual-module TypeScript 
environment and a robust, federated CI/CD system. 
4.1 package.json: The Project Manifest 
The package.json file serves as the central manifest for each Node.js project. The current file 
(visible in the provided image) shows a comprehensive set of scripts but can be refined for 
clarity, performance, and correctness. 
● Scripts: The existing scripts demonstrate a mature build process but can be streamlined. 
○ The test:unit and test:integration scripts should be unified under a single test 
command. Jest is capable of routing tests based on file paths or project 
configurations, which simplifies the command surface. 
○ The build:esm and build:cjs scripts should be run in parallel to reduce overall build 
time. This can be achieved using packages like npm-run-all or concurrently. 
○ The various publish:* and release:* scripts indicate a manual release process. This 
should be consolidated and automated. Adopting a tool like Changesets or 
release-it would automate version bumping, changelog generation, and publishing 
across all packages in the new multi-repo setup, ensuring consistency and reducing 
human error. 
● Dependencies: A critical best practice is the strict separation of runtime dependencies 
from development dependencies. The production deployment should be as lean and 
secure as possible. A full audit of package.json is required to move any package that is 
not strictly necessary for the server to run in production (e.g., @types/*, eslint, prettier, 
jest, ts-node, typescript) from the dependencies section to the devDependencies section. 
This action minimizes the final Docker image size, reduces application startup time, and 
shrinks the potential attack surface from third-party vulnerabilities. 
The following table provides a prescriptive dependency manifest for the primary mcp-prompts-ts 
package. 
Package Recommended Section Justification 
@modelcontextprotocol/sdk dependencies The core SDK is essential for 
the server to function at runtime 
in all environments. 
pg dependencies The PostgreSQL client library is 
required at runtime for the 
PostgreSQL storage adapter to 
connect to the database. 
dotenv dependencies While primarily used for loading 
.env files in local development, 
keeping it as a runtime 
dependency ensures it is 
available for pre-start scripts in 
automated testing 
environments, preventing CI 
pipeline failures. 
@modelcontextprotocol/inspect
 or 
devDependencies An indispensable tool for local 
debugging and interactive 
testing. It has no role in 
automated tests or production. 
@types/* (e.g., @types/node) devDependencies Provides TypeScript type 
definitions used only during 
development and compilation. 
They are not required by the 
compiled JavaScript at runtime. 
typescript devDependencies The TypeScript compiler (tsc) is 
a development tool needed to 
transpile .ts files to .js. It is not 
needed in a production 
environment running the 
compiled code. 
eslint, prettier devDependencies Static analysis tools for 
enforcing code quality and 
style. They are used exclusively 
during the development and CI 
process. 
jest, ts-jest, supertest devDependencies Frameworks and libraries for 
writing and executing unit and 
integration tests. They are 
required only when running the 
test suite. 
● Module System (exports field): The project is building both CommonJS (CJS) and 
ECMAScript Modules (ESM) outputs. To ensure that consumers of the package (both 
Node.js and bundlers) can correctly resolve the appropriate module format, the 
package.json file must include a properly configured exports field. This is a critical and 
often misconfigured aspect of modern dual-package publishing. 
4.2 CJS vs. ESM: Resolving the Dual-Module Challenge 
The Node.js ecosystem is in a prolonged transition from its legacy module system, CommonJS 
(require), to the web-standard ECMAScript Modules (import). ESM is the future of JavaScript 
modularity, offering key advantages like asynchronous loading, static analysis (which enables 
"tree-shaking" to reduce bundle sizes), and top-level await. 
The project's configuration files reveal a "technical debt" stemming from this transition. While the 
build scripts correctly produce both CJS and ESM outputs, the testing scripts appear to be 
configured for a CJS-only environment. This creates a "split-brain" scenario where application 
code and test code operate under different module systems, leading to complex configurations 
and potential compatibility bugs. The multi-repo migration is the ideal moment to resolve this by 
adopting an ESM-first philosophy across the entire toolchain. 
● TypeScript Configuration (tsconfig.*.json): 
○ tsconfig.json: This base file should contain settings common to both module targets 
(e.g., target: "ES2022", strict: true). 
○ tsconfig.esm.json: This file will extend the base configuration and specify "module": 
"NodeNext" and "moduleResolution": "NodeNext". This modern setting correctly 
configures TypeScript to output native ESM with the appropriate file extensions and 
import paths. The outDir should be set to ./dist/esm. 
○ tsconfig.cjs.json: This file will also extend the base configuration but will specify 
"module": "CommonJS". The outDir should be set to ./dist/cjs. This build should be 
considered a compatibility layer for consumers who have not yet migrated to ESM. 
4.3 Jest Configuration for Modern TypeScript and ESM 
Configuring the Jest testing framework to work with TypeScript and native ESM is notoriously 
challenging, as it requires specific Node.js flags and Jest settings to override its CJS-centric 
defaults. 
● Current State: The test:unit script in the provided package.json image invokes Jest via 
node_modules/jest/bin/jest.js, which typically runs in a CJS context. This is in direct 
conflict with an ESM-first development strategy. 
● Recommended Migration Path: 
1. Convert to TypeScript Config: Migrate jest.config.js to jest.config.ts. This provides 
type safety for the configuration object itself, preventing typos and incorrect value 
types. 
2. Use ESM Preset: Utilize the ts-jest preset specifically designed for ESM. The 
ts-jest documentation provides an ESM-ready preset that correctly configures the 
transformer. 
3. Update Test Script: The test script in package.json must be updated to pass the 
required Node.js flag to enable experimental VM modules, which Jest uses for its 
ESM implementation: NODE_OPTIONS='--experimental-vm-modules' jest. 
4. Update Mocks: Since ESM evaluates import statements statically before code 
execution, the traditional jest.mock() hoisting does not work. All module mocks must 
be updated to use the jest.unstable_mockModule() API, which is designed to work 
with the asynchronous nature of ESM import(). 
4.4 Containerization and CI/CD Orchestration 
● Dockerfile Optimization: For production deployments, the Dockerfile must be optimized 
for size and security by implementing a multi-stage build. 
○ Stage 1 (builder): Start from a full Node.js image. Copy package.json and 
package-lock.json, run npm install (which installs both dependencies and 
devDependencies), copy the source code, and then run the build script (npm run 
build). 
○ Stage 2 (production): Start from a lean base image (e.g., node:20-slim). Copy the 
package.json and package-lock.json, but run npm install --omit=dev to install only 
runtime dependencies. Then, copy the compiled dist directory from the builder 
stage. The final image will be significantly smaller and more secure as it contains 
no build tools or development dependencies. 
● docker-compose.yml for Development: A dedicated docker-compose.dev.yml file 
should be created for the local development environment. This file will mount the local 
source code directory as a volume into the container, enabling hot-reloading when file 
changes are detected. This setup can be seamlessly integrated with a VS Code 
Devcontainer for a one-click, reproducible development environment. 
● CI/CD Orchestration (.github/workflows): The migration plan's analysis of CI/CD 
orchestration is sound. The choice between repository_dispatch and workflow_call is a 
choice between event-driven choreography and direct orchestration. For coordinating 
builds and releases across repositories, direct orchestration is superior. The 
recommendation to use workflow_call (reusable workflows) is strongly endorsed. This 
approach provides full visibility into the end-to-end process; the calling workflow in an 
implementation repository can see the status of all jobs from the reusable workflow in the 
meta-repo directly in its "Checks" tab. This unified view is a critical developer experience 
improvement that simplifies debugging and increases confidence in the release process 
compared to the "fire-and-forget" nature of repository_dispatch. 
The following table compares the two primary GitHub Actions orchestration strategies. 
Criterion 
Visibility 
Coupling 
repository_dispatch 
Low. The triggering 
workflow has no direct 
visibility into the status 
of the dispatched 
workflow. Debugging 
requires checking two 
separate workflow runs 
in two different 
repositories. 
workflow_call 
(Reusable Workflow) 
High. The calling 
workflow's UI displays 
the complete execution 
graph, including all jobs 
from the reusable 
workflow, providing a 
single, unified view of 
the entire process. 
Recommendation 
workflow_call 
Low (Decoupled). The 
trigger is event-based; 
the caller does not 
need to know the 
implementation details 
of the receiver. 
High (Coupled). The 
caller is explicitly 
dependent on a specific 
workflow file path in 
another repository 
(uses: 
workflow_call is 
appropriate here, as 
the meta-repo's 
purpose is explicit 
orchestration, making 
the coupling intentional 
Criterion 
Data Passing 
Security 
repository_dispatch 
Limited to a generic 
JSON client-payload. 
No type safety or 
structured inputs. 
Requires a Personal 
Access Token (PAT) 
with repo scope, which 
can be overly 
permissive. 
workflow_call 
(Reusable Workflow) 
owner/repo/.github/wor
 kflows/reusable.yml@r
 ef). 
Supports strongly-typed 
inputs (with) and 
secure secret passing 
(secrets: inherit), 
providing a more robust 
and secure interface. 
Uses the built-in 
GITHUB_TOKEN or 
can be configured with 
more granular 
permissions, aligning 
with the principle of 
least privilege. 
Recommendation 
and beneficial. 
workflow_call 
workflow_call 
Section V: A Comprehensive Testing and Debugging 
Framework 
Ensuring the quality, reliability, and correctness of the mcp-prompts server is paramount, 
especially as it becomes a foundational component for other services. This requires a 
multi-layered testing strategy that combines unit tests with robust integration and end-to-end 
(E2E) testing, leveraging the tools provided by the MCP ecosystem. 
5.1 The MCP Inspector Suite: The Primary Tool for Integration Testing 
The official @modelcontextprotocol/inspector package is an indispensable developer tool 
specifically designed for testing and debugging MCP servers. It is not a single tool but a suite of 
components that work in concert: a React-based web UI client (MCPI) for interactive testing, 
and a Node.js proxy server (MCPP) that acts as a protocol bridge, allowing the web UI to 
connect to MCP servers running over various transports, including stdio and streamable HTTP. 
● Interactive Debugging Workflow: During day-to-day development, the team should 
make the Inspector UI a core part of their workflow. When adding a new tool, resource, or 
prompt to the mcp-prompts server, a developer can immediately run it against the 
Inspector. The UI provides user-friendly forms for entering tool parameters and visualizes 
the JSON responses in real-time. This provides a rapid feedback loop that is invaluable 
for verifying logic, debugging issues, and understanding how the server will behave from 
a client's perspective. The Inspector can be launched against the local build with a simple 
command: npx @modelcontextprotocol/inspector node dist/start-server.js. 
● Configuration Export for Client Setup: A key productivity feature of the Inspector is its 
ability to generate and export mcp.json configuration files. After connecting to and 
configuring the mcp-prompts server within the Inspector UI, a developer can click the 
"Server Entry" or "Servers File" button to copy a perfectly formatted JSON snippet to their 
clipboard. This snippet can then be pasted directly into the configuration file of an MCP 
client like VS Code, Cursor, or Claude Desktop, eliminating manual configuration errors 
and dramatically speeding up the process of setting up a client for testing. 
5.2 Automating End-to-End Tests with the Inspector CLI 
While interactive testing is essential for development, automated testing is critical for ensuring 
long-term stability and preventing regressions. The MCP Inspector suite includes a powerful 
command-line interface (CLI), available via the @modelcontextprotocol/inspector-cli package, 
which is the key to automating E2E tests. 
The CLI enables programmatic interaction with any MCP server, making it a perfect fit for a 
CI/CD pipeline. A new test suite, test:e2e, should be created. This suite will contain scripts that 
perform the following steps: 
1. The CI job starts an instance of the mcp-prompts server, along with any necessary 
dependencies like a PostgreSQL database, using Docker Compose. 
2. The test script then uses the Inspector CLI to send a series of requests to the running 
server to simulate a real user workflow. 
3. The script captures the JSON output from the CLI commands and asserts that the 
responses are correct and match the expected schema. 
● Example E2E Test Case (add_prompt and get_prompt): 
# Step 1: Add a new prompt to the server 
npx @modelcontextprotocol/inspector-cli \ --method tools/call \ --tool-name add_prompt \ --tool-arg id=e2e-test-prompt \ --tool-arg content="This is an E2E test." \ --tool-arg tags='["test", "ci"]' 
# Step 2: Retrieve the prompt that was just added 
PROMPT_OUTPUT=$(npx @modelcontextprotocol/inspector-cli \ --method tools/call \ --tool-name get_prompt \ --tool-arg id=e2e-test-prompt) 
# Step 3: Assert that the retrieved content is correct 
# (Using a tool like 'jq' to parse the JSON output) 
CONTENT=$(echo $PROMPT_OUTPUT | jq -r '.content') 
if; then 
echo "E2E Test Failed: Content mismatch!" 
exit 1 
fi 
echo "E2E Test Passed!" 
This approach provides true end-to-end validation. It goes beyond unit tests, which mock 
dependencies, and verifies that the fully assembled, running server behaves exactly as its API 
contract specifies. By integrating these CLI-based E2E tests into the CI pipeline, the project 
creates a powerful safety net. This practice effectively turns the API contract itself into an 
executable test suite, ensuring that the server's public-facing behavior remains consistent and 
reliable for all its downstream consumers. 
Section VI: Client Integration and Local LLM 
Workflows 
For mcp-prompts to be successful, it must provide a seamless experience within the primary 
environments where developers and AI agents will consume it. This section provides actionable 
guidance for configuring key MCP clients and integrating with local LLM runners for robust, 
offline development and testing. 
6.1 Core MCP Client Configuration and Integration 
The three most prominent MCP Host applications in the current ecosystem are VS Code, 
Claude Desktop, and Cursor. Providing clear, copy-pasteable setup instructions for each is 
crucial for user adoption. 
● Visual Studio Code: VS Code has become a first-class MCP client, with deep integration 
into its Copilot Chat and agent mode. Server configuration is managed via a 
.vscode/mcp.json file within the workspace or through global user settings. Critically, 
recent updates to VS Code have added support for the full MCP specification, including 
not just tools but also prompts, resources, and sampling. This makes VS Code an 
exceptionally powerful environment for testing all capabilities of the mcp-prompts server. 
The project's README.md should include a pre-formatted mcp.json snippet for users to 
add. 
● Claude Desktop: As the application from the creators of the MCP protocol, Claude 
Desktop is a key integration target. Configuration is handled by editing the 
claude_desktop_config.json file, located in the user's application support directory. Similar 
to VS Code, the README.md should provide the exact JSON block necessary to add the 
mcp-prompts server. 
● Cursor: Cursor is an AI-native IDE that heavily leverages MCP to connect to external 
tools and has a growing marketplace of community-provided MCP servers. It uses a 
similar JSON configuration file for setup. One important caveat to note and document for 
users is that, as of the latest available information, Cursor's MCP implementation primarily 
supports the tools capability. Support for MCP resources is a frequently requested feature 
but is not yet fully implemented. This may affect how certain features of mcp-prompts 
(e.g., those that return ResourceLink objects) are surfaced within the Cursor environment. 
A significant opportunity to reduce user friction is to implement "one-click install" buttons in 
the project's documentation. Both Cursor and VS Code support custom URL handlers (cursor:// 
and vscode://) that can automatically open the application and pre-fill the MCP server 
configuration. Providing these links in the README.md can dramatically lower the barrier to 
entry and accelerate adoption, transforming a multi-step manual configuration process into a 
single click. 
6.2 Local LLM Development and Testing Workflows 
To ensure robust and cost-effective development, it is essential to have a workflow that does not 
depend on constant calls to external, proprietary LLM APIs. Local LLM runners provide a 
solution for fully offline, private, and free end-to-end testing, particularly for features that involve 
the MCP sampling capability. 
● LM Studio Integration: LM Studio has become one of the most popular desktop 
applications for downloading and running open-source LLMs (in formats like GGUF and 
MLX) locally on a developer's machine. Its most critical feature for this project is its built-in 
local server, which exposes the running LLM via an OpenAI-compatible API endpoint, 
typically at http://localhost:1234/v1.This is a game-changer for testing. When testing a 
feature of mcp-prompts that requires an LLM call (e.g., a tool that uses the 
sampling/createMessage capability), the test environment can be configured to point its 
LLM client to the local LM Studio endpoint instead of the official OpenAI or Anthropic 
APIs. This allows for complete, end-to-end testing of agentic workflows that involve LLM 
reasoning, all without an internet connection or incurring API costs. The project's 
development documentation should include a guide on how to set up this workflow. 
● Docker Desktop Extension (Strategic Opportunity): The Docker Extensions SDK 
allows developers to build custom functionality directly into the Docker Desktop 
dashboard. As a strategic "stretch goal," the mcp-prompts project could develop a simple 
Docker Desktop extension. Such an extension could provide a user-friendly UI for: 
○ Starting, stopping, and restarting the mcp-prompts server container with a single 
click. 
○ Viewing the server's logs directly within the Docker Desktop UI. 
○ Potentially even providing a simple interface to browse or manage the prompts 
stored by the server. 
While not a core requirement, an official Docker Desktop extension would significantly enhance 
the developer experience, making the server more accessible and easier to manage for the 
large community of developers who use Docker daily. 
Section VII: Maximizing AI-Assisted Development with 
Advanced Cursor Rules 
To accelerate development and ensure consistency, the project can leverage the advanced 
"Rules" feature of the Cursor IDE. These rules provide persistent, repository-specific context to 
the AI, effectively "training" it on the project's unique architecture, coding standards, and best 
practices. This goes far beyond simple pre-prompting; it creates a living, version-controlled 
system of architectural governance. 
7.1 A Multi-Level Rule Strategy 
Cursor supports a three-tiered hierarchy of rules, which should be used to separate concerns 
and optimize context for the AI : 
1. Global User Rules (in Cursor Settings): These are for a developer's personal, universal 
preferences that apply to all projects. For example: "Always reply in a concise style. Avoid 
unnecessary filler language.". These should not be committed to the repository. 
2. Project Root Rule (.cursor/index.mdc): This file, with Rule Type: Always, is for 
project-wide standards that should always be in the AI's context. It should contain a 
high-level overview of the mcp-prompts project, its core purpose, the technology stack 
(TypeScript, Rust, Node.js, Jest, Docker, PostgreSQL), and fundamental architectural 
principles (e.g., "This is a multi-repo project. API contracts are the single source of truth 
and live in the mcp-prompts-contracts repository."). 
3. Context-Aware Rules (.cursor/rules/*.mdc): This is the most powerful feature. These 
are individual rule files stored in the .cursor/rules/ directory. Each rule is focused on a 
specific task or domain and is only loaded into the AI's context when it is relevant (either 
by being explicitly @-mentioned or automatically attached based on file patterns). This 
approach saves precious context window space and allows the AI to focus on the task at 
hand without being cluttered by irrelevant guidelines. 
7.2 Recommended Context-Aware Rules for mcp-prompts 
The project should create a suite of focused, context-aware rules to guide the AI in specific 
development scenarios. These files should be created in the .cursor/rules/ directory. 
● typescript-style.mdc: This rule will enforce the project's specific TypeScript coding 
standards. 
○ Description: "Guidelines for writing high-quality, consistent, and strict TypeScript 
code." 
○ Content: 
■ "All tsconfig.json files must enable strict: true and noImplicitAny: true." 
■ "Never use the any type. If a type is unknown, use the unknown type and 
perform type narrowing." 
■ "Explicitly type all function parameters and return types. The only exception is 
for React components returning JSX." 
■ "Do not use TypeScript enums. Use string literal union types instead (e.g., 
type Status = 'pending' | 'success' | 'error';)." 
■ "Use readonly modifiers for immutable properties and arrays (Readonly<T> 
and readonly T)." 
■ "Organize imports in the following order: Node built-ins, external packages, 
internal workspace packages, local modules." 
● api-design.mdc: This rule will guide the development of new MCP tools and resources. 
○ Description: "Best practices for designing and implementing new MCP tools and 
resources in the mcp-prompts server." 
○ Content: 
■ "All new tools must be defined in the openapi.yaml file in the 
mcp-prompts-contracts repository FIRST." 
■ "Tools should be single-purpose, verb-based functions (e.g., getPrompt, 
applyTemplate)." 
■ "Resource names should be plural nouns (e.g., prompts, templates)." 
■ "All tool and resource inputs coming from external sources MUST be 
validated using a Zod schema. Never trust incoming data." 
● testing-strategy.mdc: This rule will enforce the project's testing policies. 
○ Description: "Rules and guidelines for writing unit, integration, and end-to-end 
tests for the project." 
○ Content: 
■ "Every new tool added to the server must have a corresponding end-to-end 
test case in the test:e2e suite that uses the 
@modelcontextprotocol/inspector-cli to call the tool and validate its output." 
■ "Unit tests should focus on pure business logic within services. Dependencies 
like storage adapters or external APIs should be mocked." 
■ "When writing Jest tests in ESM, remember to import globals from 
@jest/globals and use jest.unstable_mockModule for mocking." 
● release-process.mdc: This rule will serve as a reference for the multi-repo release 
workflow. 
○ Description: "Instructions for creating a new release across the multi-repo 
ecosystem." 
○ Content: 
■ "This project uses Changesets for versioning and releases." 
■ "To contribute a change that requires a new version, run npx changeset and 
follow the prompts to create a changeset file." 
■ "The release process is automated via the 'Release' GitHub Action in the 
meta-repository. Do not manually publish packages to npm." 
By investing time in creating this comprehensive suite of rules, the mcp-prompts project is doing 
more than just improving AI suggestions. It is creating a form of executable architectural 
documentation. Unlike traditional documents that live in a wiki and quickly become stale, these 
rules are version-controlled alongside the code and actively enforce the project's architecture 
and standards with every AI-assisted code change. This creates a scalable, self-enforcing 
system of governance that will be invaluable as the project and the team grow. 
Section VIII: Conclusion and Strategic 
Recommendations 
The mcp-prompts project stands at a pivotal moment. The planned migration from a monorepo 
to a federated, multi-repo architecture is not merely a technical refactoring but a necessary 
strategic evolution. This transformation will unlock the project's potential to move beyond being 
a single tool and establish itself as a foundational platform within the rapidly expanding Model 
Context Protocol ecosystem. The analysis conducted in this report validates this direction and 
provides a detailed roadmap for its successful execution. 
The key strategic recommendations are as follows: 
1. Embrace the Platform Vision: The architectural shift to a multi-repo structure, centered 
around the mcp-prompts-contracts and mcp-prompts-collection packages, is the correct 
technical foundation for a platform strategy. It enables independent lifecycles, clear 
ownership, and lowers the barrier for community and third-party contributions, which will 
be critical for long-term growth and adoption. 
2. Adopt an OpenAPI-First, Contract-Driven Workflow: The single greatest risk in a 
multi-language, multi-repo project is implementation drift. This risk can be almost entirely 
mitigated by establishing the OpenAPI specification in the mcp-prompts-contracts 
repository as the single source of truth. By automating the generation of TypeScript and 
Rust types and client stubs from this contract, the project ensures that its various 
implementations can never become inconsistent. This transforms the API contract from 
passive documentation into an active, enforced component of the CI/CD pipeline. 
3. Modernize the Toolchain with an ESM-First Philosophy: The current configuration 
exhibits a "split-brain" between CJS-based testing and ESM-based application code. The 
migration presents a perfect opportunity to resolve this technical debt. The entire 
toolchain—from development to testing to building—should be unified around a modern, 
ESM-first approach. This will simplify configuration files (tsconfig.json, jest.config.js), 
improve compatibility with the modern JavaScript ecosystem, and unlock ESM-native 
features like top-level await. 
4. Build a Hierarchical, Agentic System: The project should be positioned not just as a 
tool, but as a core "reasoning and planning" component for more sophisticated, 
multi-agent systems. By demonstrating clear integration patterns with other official MCP 
servers (filesystem, github, postgres, sequential-thinking, memory), mcp-prompts can 
showcase its role as the cognitive core that provides structured workflows for orchestrator 
agents, solidifying its strategic importance in the ecosystem. 
5. Prioritize Developer Experience and Adoption: Lowering the barrier to entry is critical 
for community growth. This involves providing "one-click install" buttons for major clients 
like VS Code and Cursor, creating clear documentation for local development workflows 
with tools like LM Studio, and investing in a comprehensive suite of .cursor/rules to create 
a highly efficient, AI-assisted development environment. 
By executing this multi-faceted strategy, the mcp-prompts project is well-positioned to not only 
navigate its architectural evolution successfully but also to emerge as a leading, reference 
implementation and a cornerstone of the future of composable AI. 
Works cited 
1. Use MCP servers in VS Code (Preview) - Visual Studio Code, 
https://code.visualstudio.com/docs/copilot/chat/mcp-servers 2. Model Context Protocol - Cursor, 
https://docs.cursor.com/context/model-context-protocol 3. sparesparrow/mcp-prompts: Model 
Context Protocol server ... - GitHub, https://github.com/sparesparrow/mcp-prompts 4. 
mcp-framework - npm, https://www.npmjs.com/package/mcp-framework 5. 
sparesparrow/mcp-prompts-rs: Rust-based server for ... - GitHub, 
https://github.com/sparesparrow/mcp-prompts-rs 6. @modelcontextprotocol/create-server - 
npm, https://www.npmjs.com/package/@modelcontextprotocol/create-server 7. fastmcp - npm, 
https://www.npmjs.com/package/fastmcp 8. mcp-proxy - npm, 
https://www.npmjs.com/package/mcp-proxy 9. mcp-remote - npm, 
https://www.npmjs.com/package/mcp-remote 10. pyleeai/mcp-proxy-server - A CDN for npm 
and GitHub - jsDelivr, https://www.jsdelivr.com/package/npm/@pyleeai/mcp-proxy-server 11. 
Architectural Patterns for the Agentic Era - MuleSoft Blog, 
https://blogs.mulesoft.com/automation/architectural-patterns-for-the-agentic-era/ 12. 7 Practical 
Design Patterns for Agentic Systems - MongoDB, 
https://www.mongodb.com/resources/basics/artificial-intelligence/agentic-systems 13. 
@modelcontextprotocol/server-sequential-thinking - npm, 
https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking 14. 
@modelcontextprotocol/server-filesystem - npm, 
https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem 15. 
@modelcontextprotocol/server-postgres - npm, 
https://www.npmjs.com/package/@modelcontextprotocol/server-postgres 16. 
@modelcontextprotocol/server-github - npm, 
https://www.npmjs.com/package/@modelcontextprotocol/server-github 17. 
@modelcontextprotocol/server-memory - npm, 
https://www.npmjs.com/package/@modelcontextprotocol/server-memory 18. en.wikipedia.org, 
https://en.wikipedia.org/wiki/Cursor_(code_editor) 19. Best Practices | OpenAPI Documentation, 
https://learn.openapis.org/best-practices.html 20. OpenAPI Microservices Guide | Open API 
Spec Format | Stoplight, https://stoplight.io/microservices-guide 21. Where to store your 
OpenAPI definitions - Redocly, https://redocly.com/blog/store-openapi-definitions 22. 
OpenAPI.Tools - an Open Source list of great tools for OpenAPI., https://openapi.tools/ 23. SDK 
- OpenAPI Tooling, https://tools.openapis.org/categories/sdk.html 24. Working with OpenAPI 
using Rust | Shuttle, https://www.shuttle.dev/blog/2024/04/04/using-openapi-rust 25. Code 
Generators - OpenAPI Tooling, https://tools.openapis.org/categories/code-generators.html 26. 
ESM vs CJS - electrovir, https://electrovir.com/2024-10-11-esm-cjs/ 27. CommonJS vs. ES 
Modules | Better Stack Community, 
https://betterstack.com/community/guides/scaling-nodejs/commonjs-vs-esm/ 28. ESM Support | 
ts-jest - GitHub Pages, https://kulshekhar.github.io/ts-jest/docs/guides/esm-support/ 29. 
ECMAScript Modules · Jest, https://jestjs.io/docs/ecmascript-modules 30. Setup jest for 
typescript project - GitHub Gist, 
https://gist.github.com/santoshshinde2012/02d8c8696aed13764383af036bed0df0 31. 
Configuring Jest, https://jestjs.io/docs/configuration 32. Create a Dev Container - Visual Studio 
Code, https://code.visualstudio.com/docs/devcontainers/create-dev-container 33. 
@modelcontextprotocol/inspector - npm, 
https://www.npmjs.com/package/@modelcontextprotocol/inspector 34. How to Debug MCP 
Server with Anthropic Inspector? - Snyk, 
https://snyk.io/articles/how-to-debug-mcp-server-with-anthropic-inspector/ 35. 
@modelcontextprotocol/inspector-cli - npm, 
https://www.npmjs.com/package/@modelcontextprotocol/inspector-cli?activeTab=code 36. 
mcp-cli: Inspect Model Context Protocol Implementations, 
https://mcpmarket.com/server/mcp-cli-1 37. MCP servers | Visual Studio Code Extension API, 
https://code.visualstudio.com/api/extension-guides/mcp 38. The Complete MCP Experience: 
Full Specification Support in VS Code, 
https://code.visualstudio.com/blogs/2025/06/12/full-mcp-spec-support 39. Claude AI Desktop 
App | Installation, Features, and Usage, https://claudeaihub.com/claude-ai-desktop-app/ 40. 
What is the purpose of Claude Desktop : r/ClaudeAI - Reddit, 
https://www.reddit.com/r/ClaudeAI/comments/1lbajzq/what_is_the_purpose_of_claude_desktop/ 
41. How to add MCP servers to Claude (free and paid) - Weavely, 
https://www.weavely.ai/blog/claude-mcp 42. 7 Claude MCP servers you can set up right now - 
Zapier, https://zapier.com/blog/claude-mcp-servers/ 43. Claude Desktop | - MCP Run, 
https://docs.mcp.run/mcp-clients/claude-desktop/ 44. MCP Servers for Cursor - Cursor 
Directory, https://cursor.directory/mcp 45. Cursor MCP resource feature support, 
https://forum.cursor.com/t/cursor-mcp-resource-feature-support/50987 46. LM Studio 
Accelerates LLM Performance With NVIDIA GeForce RTX GPUs and CUDA 12.8, 
https://blogs.nvidia.com/blog/rtx-ai-garage-lmstudio-llamacpp-blackwell/ 47. About LM Studio | 
LM Studio Docs, https://lmstudio.ai/docs 48. LM Studio as a Local LLM API Server | LM Studio 
Docs, https://lmstudio.ai/docs/local-server 49. OpenAI Compatible Providers: LM Studio - AI 
SDK, https://ai-sdk.dev/providers/openai-compatible-providers/lmstudio 50. Docker Extensions 
SDK, https://www.docker.com/developers/sdk/ 51. Docker Extensions, 
https://docs.docker.com/extensions/ 52. Extension UI API | Docker Docs, 
https://docs.docker.com/extensions/extensions-sdk/dev/api/overview/ 53. Cursor IDE Rules for 
AI: Guidelines for Specialized AI Assistant - Kirill Markin, 
https://kirill-markin.com/articles/cursor-ide-rules-for-ai/ 54. Rules - Cursor, 
https://docs.cursor.com/context/rules 55. Cursor Rules for TypeScript Engineers - Steve Kinney, 
https://stevekinney.com/writing/cursor-rules-typescript 56. How to Use Cursor More Efficiently! : 
r/ChatGPTCoding - Reddit, 
https://www.reddit.com/r/ChatGPTCoding/comments/1hu276s/how_to_use_cursor_more_efficie
 ntly/ 