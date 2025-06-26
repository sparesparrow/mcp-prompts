# MCP Prompts - Contracts

Tento balíček obsahuje sdílené API kontrakty, Zod schémata a typové definice pro celý ekosystém MCP Prompts.

## Generování OpenAPI specifikace

OpenAPI specifikace je generována automaticky ze Zod schémat v `src/schemas.ts`.

**Vygenerování OpenAPI:**

```bash
npm install # nainstalujte závislosti
npm run gen:openapi
```

Výstupní soubor: `openapi.json` v kořeni balíčku.

## Přidání nového schématu nebo typu
- Všechny typy a schémata přidávejte do `src/interfaces.ts` a `src/schemas.ts`.
- Pro každou změnu spusťte `npm run gen:openapi` a commitněte i změněný `openapi.json`.
- Pokud přidáváte nový endpoint, rozšiřte schémata a typy podle potřeby.

## CI/CD a workflow
- Každý commit na hlavní větev spouští CI, který ověřuje typy, schémata a generuje OpenAPI.
- Publikování na NPM probíhá automaticky po úspěšném CI.

## Další kroky
- Typy pro další jazyky (Rust, Kotlin) budou generovány z OpenAPI pomocí `openapi-generator`.
- Pro více informací viz strategické dokumenty v meta-repozitáři.
