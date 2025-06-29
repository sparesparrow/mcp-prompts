
- [x] **Initialize repository:** Move API and data structure definitions into `mcp-prompts-contracts/`.
  - [x] Move `src/interfaces.ts` to `mcp-prompts-contracts/src/interfaces.ts`.
  - [x] Move `src/schemas.ts` to `mcp-prompts-contracts/src/schemas.ts`.
- [x] **Establish Zod as Single Source of Truth:** Convert all type definitions to Zod schemas.
- [ ] **Set up OpenAPI Generation:** Configure automatic generation of an OpenAPI specification from the Zod schemas.
- [ ] **CI/CD Pipeline:**
  - [ ] Implement lint, test, and build pipeline.
  - [ ] Add automatic schema validation against examples.
  - [ ] Configure automatic NPM package publishing (`@sparesparrow/mcp-prompts-contracts`) on tag.
  - [ ] Trigger a `repository_dispatch` event to the meta-repo on release.

#### Repository: `mcp-prompts-collection`


- [ ] **CI/CD Pipeline:**
  - [ ] Add a pipeline to validate all prompts against the JSON schema from `mcp-prompts-contracts`.
  - [ ] Set up multi-format package publishing (NPM `@sparesparrow/mcp-prompts-collection`, Crates.io `mcp-prompts-collection`).
  - [ ] Implement automated prompt quality checks (e.g., checking for placeholders).
  - [ ] Configure versioning based on data changes.

---

#### Repository: `mcp-prompts-ts`

- [ ] **Update Dependencies:** Replace local workspace dependencies with versioned NPM packages for `@sparesparrow/mcp-prompts-contracts` and `@sparesparrow/mcp-prompts-collection`.
- [ ] **CI/CD Pipeline:**
  - [ ] Implement a comprehensive test suite (unit, integration).
  - [ ] Set up Docker image building and publishing to Docker Hub/GHCR.
  - [ ] Configure automatic NPM package publishing (`@sparesparrow/mcp-prompts`).
  - [ ] Add a step to dispatch an event to the meta-repo on release.


#### Repository: `mcp-prompts-pg`


- [ ] **CI/CD Pipeline:**
  - [ ] Add `sqlfluff` for SQL linting.
  - [ ] Implement database migration testing.
  - [ ] Set up Docker image publishing with init scripts.
  - [ ] Add performance benchmarks (target: <=100ms for 1M vectors).
  - [ ] Configure Helm chart publishing.

#### Repository: `mcp-prompts-aidl`

- [ ] **CI/CD Pipeline:**
  - [ ] Configure a Gradle/Cargo build pipeline for the AAR library and APK.
  - [ ] Set up AAR library publishing to Maven Central.
  - [ ] Configure Docker image for Android emulator testing.

#### Repository: `mcp-prompts`

- [ ] **Implement reusable workflows:** Create shared GitHub Actions workflows (`workflow_call`) for common tasks like linting, building, and publishing

- [ ] **Implement orchestration logic:**
  - [ ] Create a `repository_dispatch` handler to listen for releases from other repos.
  - [ ] Automate the building of a "suite" Docker image containing all server implementations.
  - [ ] Automate the generation of a compatibility matrix.
  - [ ] Automate the creation of consolidated release notes.

- [ ] **Develop multi-server test suite:** Create tests that validate workflows across multiple server implementations running together.
- [ ] **Create docker-compose environments:** Define test environments that spin up various combinations of the servers.

  - [ ] Configure automated execution of the E2E suite.
  - [ ] Set up scheduled nightly runs.
  - [ ] Implement comprehensive test reporting and metrics.

- [ ] **Update all cross-repository dependencies** to point to the new versioned packages.




# Průvodce CI/CD Workflows pro Ekosystém `mcp-prompts` 
 
Tento dokument poskytuje kompletní sadu GitHub Actions workflows 
navržených pro robustní a automatizovanou správu CI/CD v 
multi-repozitářové architektuře projektu `mcp-prompts`. Každá sekce 
obsahuje popis, vizuální diagram a kompletní YAML kód pro daný 
repozitář. 
 --- 
 
## 1. Meta-Repozitář (`mcp-prompts`) 
 
Tento repozitář slouží jako centrální orchestrátor. Neobsahuje 
produkční kód, ale hostuje znovupoužitelné workflows a spravuje 
celkovou dokumentaci. 
 
### 1.1. Znovupoužitelný Workflow: `reusable-ts-ci.yml` 
 
Tento workflow definuje standardizovaný proces CI pro všechny 
TypeScript balíčky v ekosystému. Zajišťuje konzistenci při instalaci 
závislostí, lintování, testování a sestavování. 
 
**Mermaid Diagram:** 
 
```mermaid 
flowchart TD 
    A[Start: Workflow Triggered] --> B{Checkout Code}; 
    B --> C{Setup Node.js & PNPM}; 
    C --> D{Install Dependencies}; 
    D --> E{Lint & Format Check}; 
    E --> F{Run Unit Tests}; 
    F --> G{Build Project}; 
    G --> H[End: Success/Failure]; 
 
YAML Kód: 
Cesta: .github/workflows/reusable-ts-ci.yml 
# This reusable workflow defines the standard CI process for all 
TypeScript packages. 
# It can be called by other repositories to ensure consistency. 
name: Reusable TypeScript CI 
 
on: 
  workflow_call: 
    inputs: 
      node-version: 
        required: false 
        type: string 
        default: '20.x' 
    secrets: 
      NPM_TOKEN: 
        required: true 
 
jobs: 
  ci-pipeline: 
    runs-on: ubuntu-latest 
    steps: 
      - name: Checkout Repository 
        uses: actions/checkout@v4 
 
      - name: Setup PNPM 
        uses: pnpm/action-setup@v4 
        with: 
          version: 9 
 
      - name: Setup Node.js 
        uses: actions/setup-node@v4 
        with: 
          node-version: ${{ inputs.node-version }} 
          cache: 'pnpm' 
 
      - name: Install Dependencies 
        run: pnpm install --frozen-lockfile 
 
      - name: Lint Code 
        run: pnpm run lint 
 
      - name: Run Unit Tests 
        run: pnpm run test 
 
      - name: Build Project 
        run: pnpm run build 
 
1.2. Workflow pro Publikaci Balíčku a Vytvoření Release: 
reusable-publish.yml 
Tento workflow, spouštěný po úspěšném CI, automatizuje proces verzování a publikování 
pomocí Changesets. 
Mermaid Diagram: 
flowchart TD 
    A[Start: CI Success] --> B{Checkout Code}; 
    B --> C{Setup Node.js & PNPM}; 
    C --> D{Install Dependencies}; 
    D --> E{Create Release Pull Request or Publish}; 
    E -- If changes exist --> F[Create PR: "Version Packages"]; 
    E -- If publishing --> G{Publish to NPM}; 
    G --> H[Create GitHub Release]; 
    F --> I[End]; 
    H --> I[End]; 
 
YAML Kód: 
Cesta: .github/workflows/reusable-publish.yml 
# This reusable workflow handles versioning with Changesets and 
publishing to NPM. 
name: Reusable Package Publisher 
 
on: 
  workflow_call: 
    inputs: 
      node-version: 
        required: false 
        type: string 
        default: '20.x' 
    secrets: 
      NPM_TOKEN: 
        required: true 
      GITHUB_TOKEN: 
        required: true 
 
jobs: 
  publish-package: 
    runs-on: ubuntu-latest 
    steps: 
      - name: Checkout Repository 
        uses: actions/checkout@v4 
        with: 
          # Fetch all history for accurate versioning 
          fetch-depth: 0 
 
      - name: Setup PNPM 
        uses: pnpm/action-setup@v4 
        with: 
          version: 9 
 
      - name: Setup Node.js 
        uses: actions/setup-node@v4 
        with: 
          node-version: ${{ inputs.node-version }} 
          cache: 'pnpm' 
          registry-url: 
'[https://registry.npmjs.org](https://registry.npmjs.org)' 
 
      - name: Install Dependencies 
        run: pnpm install --frozen-lockfile 
 
      - name: Create Release Pull Request or Publish 
        id: changesets 
        uses: changesets/action@v1 
        with: 
          # This command will create a PR if there are new changesets, 
          # or publish packages if the PR has been merged. 
          publish: pnpm run release 
        env: 
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} 
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }} 
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} 
 
2. Repozitář Kontraktů (mcp-prompts-contracts) 
Tento repozitář je základním kamenem. Jeho CI/CD proces validuje API kontrakt a publikuje ho 
jako NPM balíček. 
Workflow: ci-and-publish.yml 
Tento workflow volá znovupoužitelné workflows z meta-repozitáře pro spuštění CI a následné 
publikování. 
Mermaid Diagram: 
flowchart TD 
    A[Start: Push to main or PR] --> B{Call Reusable TypeScript CI}; 
    B -- On Success --> C{Check Trigger Condition}; 
    C -- If push to main --> D{Call Reusable Package Publisher}; 
    C -- If PR --> E[End]; 
    D --> E[End]; 
 
YAML Kód: 
Cesta: .github/workflows/ci-and-publish.yml 
name: CI and Publish Contracts 
 
on: 
  push: 
    branches: 
      - main 
  pull_request: 
    branches: 
      - main 
 
jobs: 
  # Job to run the Continuous Integration pipeline 
  continuous-integration: 
    uses: 
sparesparrow/mcp-prompts/.github/workflows/reusable-ts-ci.yml@main 
    secrets: 
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }} 
 
  # Job to publish the package if CI is successful and the trigger is 
a push to main 
  publish-package: 
    needs: continuous-integration 
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' 
    uses: 
sparesparrow/mcp-prompts/.github/workflows/reusable-publish.yml@main 
    secrets: 
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }} 
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} 
 
3. TypeScript Server (mcp-prompts-ts) 
Tento repozitář obsahuje hlavní TS implementaci serveru. CI/CD proces ho testuje, sestavuje a 
publikuje jako Docker obraz. 
Workflow: ci-and-publish-docker.yml 
Podobně jako u kontraktů, tento workflow nejprve provede CI a poté sestaví a publikuje Docker 
obraz na GitHub Container Registry. 
Mermaid Diagram: 
flowchart TD 
    A[Start: Push to main or PR] --> B{Call Reusable TypeScript CI}; 
    B -- On Success and Push to main --> C{Login to GitHub Container 
Registry}; 
    C --> D{Extract Docker Metadata}; 
    D --> E{Build and Push Docker Image}; 
    E --> F[End]; 
    B -- On PR or CI Failure --> F[End]; 
 
YAML Kód: 
Cesta: .github/workflows/ci-and-publish-docker.yml 
name: CI and Publish Docker Image 
 
on: 
  push: 
    branches: 
      - main 
  pull_request: 
    branches: 
      - main 
 
jobs: 
  continuous-integration: 
    uses: 
sparesparrow/mcp-prompts/.github/workflows/reusable-ts-ci.yml@main 
    secrets: 
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }} 
 
  publish-docker-image: 
    needs: continuous-integration 
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' 
    runs-on: ubuntu-latest 
    permissions: 
      contents: read 
      packages: write 
 
    steps: 
      - name: Checkout repository 
        uses: actions/checkout@v4 
 
      - name: Log in to GitHub Container Registry 
        uses: docker/login-action@v3 
        with: 
          registry: ghcr.io 
          username: ${{ github.actor }} 
          password: ${{ secrets.GITHUB_TOKEN }} 
 
      - name: Extract Docker metadata 
        id: meta 
        uses: docker/metadata-action@v5 
        with: 
          images: ghcr.io/sparesparrow/mcp-prompts-ts 
 
      - name: Build and push Docker image 
        uses: docker/build-push-action@v6 
        with: 
          context: . 
          push: true 
          tags: ${{ steps.meta.outputs.tags }} 
          labels: ${{ steps.meta.outputs.labels }} 
 
4. Rust Server (mcp-prompts-rs) 
Tento repozitář obsahuje vysoce výkonnou Rust implementaci. Jeho CI/CD je specifické pro 
Rust ekosystém (Cargo, clippy, atd.). 
Workflow: ci-and-publish-crate.yml 
Workflow pro Rust: kontroluje formátování, spouští linter (clippy), testuje a nakonec publikuje 
novou verzi na crates.io. 
Mermaid Diagram: 
flowchart TD 
    A[Start: Push to main or PR] --> B{Checkout Code}; 
    B --> C{Setup Rust & Cache}; 
    C --> D{Check Formatting}; 
    D --> E{Run Clippy Linter}; 
    E --> F{Run Tests}; 
    F --> G{Build Release}; 
    G -- On Push to main --> H{Publish to Crates.io}; 
    G -- On PR or CI Failure --> I[End]; 
    H --> I[End]; 
 
 
YAML Kód: 
Cesta: .github/workflows/ci-and-publish-crate.yml 
name: CI and Publish Rust Crate 
 
on: 
  push: 
    branches: 
      - main 
  pull_request: 
    branches: 
      - main 
 
env: 
  CARGO_TERM_COLOR: always 
 
jobs: 
  ci-pipeline: 
    runs-on: ubuntu-latest 
    steps: 
      - name: Checkout Repository 
        uses: actions/checkout@v4 
 
      - name: Setup Rust toolchain 
        uses: dtolnay/rust-toolchain@stable 
 
      - name: Cache Cargo dependencies 
        uses: actions/cache@v4 
        with: 
          path: | 
            ~/.cargo/bin/ 
            ~/.cargo/registry/index/ 
            ~/.cargo/registry/cache/ 
            ~/.cargo/git/db/ 
            target/ 
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') 
}} 
 
      - name: Check Formatting 
        run: cargo fmt -- --check 
 
      - name: Run Clippy 
        run: cargo clippy -- -D warnings 
 
      - name: Run Tests 
        run: cargo test --verbose 
 
      - name: Build in Release Mode 
        run: cargo build --release --verbose 
 
  publish-crate: 
    needs: ci-pipeline 
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' 
&& startsWith(github.event.head_commit.message, 'release:') 
    runs-on: ubuntu-latest 
    steps: 
      - name: Checkout Repository 
        uses: actions/checkout@v4 
 
      - name: Publish to Crates.io 
        uses: katyo/publish-crates@v2 
        with: 
          registry-token: ${{ secrets.CARGO_REGISTRY_TOKEN }} 


# Praktická Příručka: Skripty a Příkazy pro Ekosystém mcp-prompts 
Tento dokument slouží jako "kuchařka" pro vývojáře. Obsahuje sbírku 
nejpoužívanějších `npm` skriptů a `docker` příkazů pro build, 
testování, nasazení a CI/CD v rámci `mcp-prompts` multi-repo 
architektury. --- 
## Část 1: Lokální vývoj s PNPM Workspaces 
Všechny tyto příkazy se spouští z kořenového adresáře meta-repozitáře. 
### Základní operace 
```bash 
# Instalace všech závislostí ve všech balíčcích (workspaces) 
pnpm install 
# Spuštění vývojového serveru pro všechny balíčky paralelně (s 
hot-reloadingem) 
pnpm run dev 
# Sestavení (build) všech balíčků pro produkci 
pnpm run build 
# Spuštění unit testů ve všech balíčcích 
pnpm run test 
# Spuštění linteru ve všech balíčcích 
pnpm run lint 
# Kompletní úklid (odstranění node_modules, dist, .turbo) 
pnpm run clean 
# Kompletní přestavění celého projektu 
pnpm run rebuild 
Práce s jedním balíčkem 
Použijte příznak --filter pro cílení na konkrétní balíček. 
# Sestavení pouze balíčku s kontrakty 
pnpm --filter @sparesparrow/mcp-prompts-contracts run build 
# Spuštění testů pouze v TypeScript serveru 
pnpm --filter @sparesparrow/mcp-prompts-ts run test 
# Spuštění dev serveru pouze pro Rust implementaci 
pnpm --filter mcp-prompts-rs run dev 
Část 2: Správa verzí a publikování s Changesets 
Tento proces zajišťuje správné verzování balíčků a generování CHANGELOG.md. 
# Krok 1: Vytvoření nového changeset souboru po provedení změn 
# Nástroj se vás interaktivně zeptá, které balíčky byly změněny a 
jakého typu změny jsou (patch, minor, major). 
pnpm changeset 
# Krok 2: Commitněte vygenerovaný changeset soubor do Gitu 
git add .changeset/ 
git commit -m "feat(contracts): Add new metadata field to Prompt" 
# Krok 3: Aplikace změn a publikování (typicky se děje v CI/CD, ale 
lze i lokálně) 
# Tento příkaz zaktualizuje verze v package.json a vygeneruje 
changelogy 
pnpm changeset version 
# Tento příkaz publikuje balíčky s novou verzí do NPM registru 
pnpm changeset publish 
Část 3: Orchestrace s Docker Compose 
Tyto příkazy se spouští z kořenového adresáře, kde se nachází docker-compose.yml. 
Správa celého stacku 
# Sestavení obrazů a spuštění všech služeb na pozadí 
docker-compose up --build -d 
# Zastavení a odstranění všech kontejnerů 
docker-compose down 
# Zastavení bez odstranění 
docker-compose stop 
# Restartování všech služeb 
docker-compose restart 
Práce s jednotlivými službami 
# Zobrazení logů v reálném čase pro TypeScript server 
docker-compose logs -f mcp-prompts-ts 
 
# Přestavění a znovuspuštění pouze jedné služby (např. po změně v 
jejím Dockerfile) 
docker-compose up --build -d mcp-prompts-ts 
 
# Spuštění shellu uvnitř běžícího kontejneru pro ladění 
docker-compose exec postgres psql -U mcpuser -d mcp_prompts_db 
docker-compose exec mcp-prompts-ts sh 
 
Část 4: Integrační testy s MCP Inspector 
Tato sekce předpokládá, že máte v docker-compose.yml přidanou službu pro 
mcp-inspector-server. 
docker-compose.override.yml pro inspekci 
Vytvořte si soubor docker-compose.override.yml (bude automaticky načten), který přidá 
inspector. 
# docker-compose.override.yml 
version: '3.8' 
services: 
  inspector-server: 
    image: ghcr.io/modelcontextprotocol/inspector-server:latest 
    container_name: mcp_inspector_server 
    ports: 
      - "7777:7777" # Web UI 
      - "7778:7778" # MCP Proxy Port 
    networks: 
      - mcp-net 
 
  mcp-prompts-ts: 
    environment: 
      # Přesměrujeme komunikaci přes inspector 
      MCP_SERVER_GITHUB_URL: 
http://inspector-server:7778/mcp-server-github:3002 
      # ... další servery, které chcete sledovat 
 
Spuštění a použití 
# Spuštění celého prostředí včetně inspectoru 
docker-compose up -d 
 
# 1. Spusťte vaše integrační testy (např. pomocí Postmana nebo 
skriptu) 
#    
Testy musí posílat požadavky na mcp-prompts-ts server. 
# 2. Otevřete v prohlížeči webové UI inspectoru 
#    
URL: http://localhost:7777 
# 3. V UI uvidíte veškerou MCP komunikaci, která prošla přes 
inspector. 
#    
Můžete si prohlédnout requesty, response a ladit případné 
problémy. 
Část 5: CI/CD Snippety a Lokální Simulace 
Před pushnutím do Gitu si můžete lokálně ověřit, zda projdete CI. 
Simulace CI pipeline 
# Spuštění stejných kroků jako v reusable-ts-ci.yml 
pnpm install --frozen-lockfile && pnpm run lint && pnpm run test && 
pnpm run build 
Spouštění workflow napříč repozitáři 
Pokud potřebujete manuálně spustit workflow v jiném repozitáři (např. po aktualizaci kontraktů 
spustit testy v mcp-prompts-ts), můžete použít gh CLI. 
# Příklad: Spuštění workflow 'run-integration-tests.yml' v repozitáři 
'mcp-prompts-ts' 
gh workflow run run-integration-tests.yml --repo 
sparesparrow/mcp-prompts-ts -f contract-version=1.2.0 
Část 6: Dynamické přidání komunitního MCP serveru 
Ukázka, jak snadno lze ekosystém rozšířit o další nástroj, např. server pro lokální LLM. 
Krok 1: Přidejte novou službu do docker-compose.yml 
# ... v docker-compose.yml 
services: 
# ... stávající služby 
mcp-server-ollama: 
image: ghcr.io/some-community/mcp-server-ollama:latest # Příklad 
container_name: mcp_server_ollama 
restart: always 
ports: - "3006:3000" 
networks: 
- mcp-net 
environment: 
OLLAMA_HOST: 
[http://host.docker.internal:11434](http://host.docker.internal:11434) 
# Pokud Ollama běží lokálně na hostiteli 
Krok 2: Aktualizujte .env soubor 
Přidejte novou proměnnou prostředí, aby váš hlavní server věděl o novém nástroji. 
# ... v .env 
MCP_SERVER_OLLAMA_URL=http://mcp-server-ollama:3000 
Krok 3: Znovu spusťte Docker Compose 
Docker Compose inteligentně vytvoří a spustí pouze novou službu a restartuje ty, kterým se 
změnila konfigurace (díky .env). 
docker-compose up -d 
 
 