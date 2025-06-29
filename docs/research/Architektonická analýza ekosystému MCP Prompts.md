<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# Architektonická analýza ekosystému MCP Prompts

## Přehled architektonických rolí

Analýza čtyř repozitářů potvrdila jejich deklarované architektonické role v rámci ekosystému MCP Prompts[^1]:

### mcp-prompts (Orchestrátor)

Funguje jako **hlavní orchestrátor** poskytující centralizovaný MCP server pro správu promptů a šablon[^1]. Jeho primární funkce zahrnují:

- Implementaci hlavní aplikační logiky a API
- Správu různých typů úložišť (souborový systém, PostgreSQL, MDC formát)
- Integraci s dalšími MCP servery prostřednictvím zdrojů URI
- Poskytování HTTP serveru s health check endpointy
- Docker nasazení s více konfiguračními profily


### mcp-prompts-catalog (Datové úložiště)

Slouží jako **centrální datové úložiště** obsahující kolekci promptů ve formátu JSON[^2]. Charakteristiky:

- Struktura adresářů: `catalog/` a `prompts/` pro organizaci obsahu
- Řeší problém "prompt rot" - fragmentace a ztráty cenných promptů v týmech
- Poskytuje jednotný zdroj pravdy pro repozitář mcp-prompts
- Podporuje JavaScript jako primární jazyk (100% podle statistik)


### mcp-prompts-contracts (API kontrakt)

Definuje **API kontrakty a společné datové struktury**[^3] pro celý ekosystém:

- Generuje OpenAPI specifikace ze Zod schémat pomocí `@asteasolutions/zod-to-openapi`
- Poskytuje TypeScript typy a rozhraní v souborech `interfaces.ts` a `schemas.ts`
- Automatické generování JSON schémat přes skripty `generate-openapi.ts` a `generate-json-schema.ts`
- Umožňuje budoucí generování typů pro další jazyky (Rust, Kotlin) pomocí openapi-generator


### mcp-prompts-ts (Implementace)

Představuje **TypeScript implementaci** MCP Prompts serveru[^4] s pokročilými funkcemi:

- Obsahuje komplexní zdrojový kód v adresáři `src/` včetně adaptérů, služeb a utilit
- Podporuje Kubernetes nasazení přes Helm charts v `charts/mcp-prompts/`
- Implementuje pokročilé funkce jako workflow service, SSE (Server-Sent Events)
- Zahrnuje rozsáhlou testovací infrastrukturu v adresáři `tests/`


## Strom závislostí

### Primární závislosti

**mcp-prompts (hlavní repozitář)**[^5]:

- Konfiguruje se jako monorepo s `"workspaces": ["packages/*"]`
- Využívá workspace odkazy na ostatní komponenty: `"@sparesparrow/mcp-prompts-catalog": "workspace:*"`

**mcp-prompts-ts**[^4]:

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.13.0",
  "@sparesparrow/mcp-prompts-contracts": "file:../mcp-prompts-contracts",
  "@sparesparrow/mcp-prompts-catalog": "file:../mcp-prompts-catalog/catalog",
  "express": "^4.21.2",
  "pg": "^8.16.2",
  "zod": "^3.25.67"
}
```

**mcp-prompts-contracts**[^3]:

```json
"dependencies": {
  "@asteasolutions/zod-to-openapi": "^7.3.4"
},
"devDependencies": {
  "zod": "^3.23.8",
  "zod-to-json-schema": "^3.24.6"
}
```


### Vztahy mezi projekty

1. **mcp-prompts-ts** závisí na contracts pro typy a na catalog pro data
2. **mcp-prompts** orchestruje všechny komponenty přes workspace systém
3. **contracts** poskytuje společné API definice pro všechny ostatní
4. **catalog** slouží jako nezávislé datové úložiště

## Build systémy a balíčkování

### Build konfigurace

**TypeScript kompilace**[^1][^4]:

- Všechny projekty používají TypeScript s `tsc` kompilátorem
- `mcp-prompts-ts` implementuje pokročilý build systém s `build.mjs` a dual output (ESM/CJS)
- Build proces zahrnuje: `"build": "node build.mjs"` a `"prepare": "npm run build"`

**Balíčkování pro distribuci**[^4]:

- NPM konfigurace s `"main": "dist/index.mjs"` a `"type": "module"`
- Binary entry point: `"bin": {"mcp-prompts": "dist/index.mjs"}`
- Publikace pouze `dist/` adresáře: `"files": ["dist", "CHANGELOG.md", "README.md"]`

**Linting a formátování**[^6]:

- ESLint konfigurace s TypeScript podporou
- Prettier pro jednotné formátování kódu
- Automatické kontroly v CI/CD pipeline


## Verzování strategie

### Sémantické verzování

Ekosystém implementuje automatizované sémantické verzování[^6]:

```yaml
- name: Determine version bump
  run: |
    if [[ "$LATEST_COMMIT" == *"BREAKING CHANGE"* ]]; then
      echo "VERSION_TYPE=major" >> $GITHUB_OUTPUT
    elif [[ "$LATEST_COMMIT" == *"feat:"* ]]; then
      echo "VERSION_TYPE=minor" >> $GITHUB_OUTPUT
    else
      echo "VERSION_TYPE=patch" >> $GITHUB_OUTPUT
    fi
```


### Synchronizace verzí

- **Koordinované vydání**: Automatické určení typu verze na základě commit zpráv
- **Git tagy**: Automatické vytváření tagů při publikaci nových verzí
- **NPM publikace**: Koordinovaná publikace všech balíčků současně


## Testovací metodologie

### Framework a struktura[^6]

**Jest jako primární testovací framework**[^4][^7]:

- Jednotkové testy: `"test:unit": "jest --testPathPattern=\"tests/unit|src/__tests__\"`
- Integrační testy: `"test:integration": "jest --testPathPattern=\"tests/integration\"`
- Pokrytí kódu: `"test:coverage": "jest --coverage"`


### CI/CD testovací pipeline[^6]

**PostgreSQL služby pro testování**:

```yaml
services:
  postgres:
    image: postgres:14
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mcp_prompts_test
```

**Paralelní testování**:

- Jednotkové a integrační testy spouštěné odděleně
- Docker testy jako samostatný job po dokončení základních testů
- Upload výsledků testů jako artifakty pro další analýzu


### Kvalitní assurance

- **Linting**: ESLint kontroly pro konzistenci kódu
- **Formátování**: Prettier kontroly pro jednotný styl
- **Audit závislostí**: `npm audit --audit-level=moderate`
- **Build validace**: Ověření úspěšnosti build procesu


## Role Docker a kontejnerizace

### Multi-stage Docker architektura[^1]

**Produkční kontejnery**:

- Optimalizované images s multi-stage builds
- Podpora pro různé typy úložišť (file, postgres, MDC)
- Health check endpointy pro monitoring stavu


### Docker Compose orchestrace[^1]

**Více profilů pro různé scénáře**:

- **Base deployment**: Základní MCP Prompts server s file úložištěm
- **Development environment**: Hot-reloading a debugging nástroje
- **PostgreSQL integration**: Database backend s Adminer pro správu
- **Testing environment**: Optimalizováno pro automatizované testování
- **Multi-server integration**: Integrace s dalšími MCP servery


### CI/CD Docker integrace[^6]

**Automatizované Docker builds**:

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v4
  with:
    context: .
    push: true
    tags: |
      sparesparrow/mcp-prompts:latest
      sparesparrow/mcp-prompts:${{ steps.bump.outputs.VERSION_TYPE }}
```


## Architektonické shrnutí

Ekosystém MCP Prompts představuje sofistikovanou modulární architekturu, která úspěšně separuje zodpovědnosti:

1. **Orchestrátor** (mcp-prompts) poskytuje hlavní funkcionalitu a integrační vrstvu
2. **Datové úložiště** (catalog) udržuje centralizovanou kolekci promptů
3. **API kontrakt** (contracts) zajišťuje typovou bezpečnost a konzistenci rozhraní
4. **Implementace** (ts) dodává pokročilé funkce a produkční nasazení

Celá architektura podporuje **skalabilitu** přes mikroservisový přístup, **maintainability** přes jasnou separaci zodpovědností, a **spolehlivost** přes rozsáhlé testování a automatizované CI/CD procesy[^8][^9][^6]. Docker kontejnerizace umožňuje flexibilní nasazení v různých prostředích, zatímco workspace-based dependency management zajišťuje efektivní development workflow.

# Doporučený další postup (červen 2025)

Na základě aktuálního stavu repozitářů a roadmapy doporučuji:

1. **Katalog promptů (mcp-prompts-catalog):**
   - Rozšířit validaci o kontrolu duplicitních id a obsahu, povinných příkladů a jazykové správnosti.
   - Zajistit, že všechny prompty odpovídají aktuálnímu schématu z contracts.
   - Zlepšit dokumentaci a onboarding pro přispěvatele.

2. **Kontrakty (mcp-prompts-contracts):**
   - Dokončit generování OpenAPI a typů z Zod schémat.
   - Přidat testy, které ověří, že schémata odpovídají reálným datům z katalogu.
   - Automatizovat synchronizaci schémat mezi contracts a catalog.

3. **Orchestrátor (meta-repo):**
   - Zajistit synchronizované CI/CD workflow a sdílené šablony napříč repozitáři.
   - Přidat centrální dokumentaci a onboarding pro nové přispěvatele.

4. **Testování a integrace:**
   - Přidat integrační testy mezi contracts, catalog a implementace.
   - Zvážit E2E testy pro celý ekosystém.

Tento plán zajistí další růst kvality, udržitelnosti a rozšiřitelnosti MCP Prompts ekosystému.

<div style="text-align: center">⁂</div>

[^1]: https://github.com/sparesparrow/mcp-prompts

[^2]: https://github.com/sparesparrow/mcp-prompts-catalog

[^3]: https://github.com/sparesparrow/mcp-prompts-contracts

[^4]: https://github.com/sparesparrow/mcp-prompts-contracts/blob/main/package.json

[^5]: https://github.com/sparesparrow/mcp-prompts-contracts/blob/main/index.ts

[^6]: https://github.com/sparesparrow/mcp-prompts/blob/main/.github/workflows/build-and-test.yml

[^7]: https://github.com/sparesparrow/mcp-prompts/blob/main/.github/workflows/ci.yml

[^8]: https://langfuse.com/docs/prompts/mcp-server

[^9]: https://playbooks.com/mcp/github-actions

[^10]: https://github.com/sparesparrow/mcp-prompts-contracts/blob/main/src/schemas.ts

[^11]: https://github.com/sparesparrow/mcp-prompts-ts

[^12]: https://github.com/sparesparrow/mcp-prompts-ts/blob/main/package.json

[^13]: https://github.com/sparesparrow/mcp-prompts-ts/tree/main/src

[^14]: https://github.com/sparesparrow/mcp-prompts-ts/blob/main/TODO.md

[^15]: https://github.com/sparesparrow/mcp-prompts/blob/main/package.json

[^16]: https://playbooks.com/mcp/sparesparrow-prompt-manager

[^17]: https://glama.ai/mcp/servers/@sparesparrow/mcp-prompts

[^18]: https://www.capicua.com/blog/jest-vs-vitest

[^19]: https://lobehub.com/mcp/tanker327-prompts-mcp-server

[^20]: https://github.com/ko1ynnky/github-actions-mcp-server

[^21]: https://www.linkedin.com/pulse/pros-cons-different-test-tools-jest-craig-risi

[^22]: https://github.com/sparesparrow/mcp-prompts/blob/main/.github/workflows/release.yml

[^23]: https://github.com/sparesparrow/mcp-prompts/blob/main/.github/workflows/reusable-ts-ci.yml

[^24]: https://github.com/sparesparrow/mcp-prompts/blob/main/.github/workflows/npm-publish.yml

[^25]: https://github.com/sparesparrow/mcp-project-orchestrator

