# scripts/

Tato složka obsahuje utility a pomocné skripty pro správu, build, testování a release MCP-Prompts.

| Skript                    | Popis                                                                 | Poznámka                |
|--------------------------|-----------------------------------------------------------------------|-------------------------|
| build-and-push-docker.sh | Build a push Docker image na registry                                  |                         |
| docker-manage.sh         | Správa a ovládání Docker kontejnerů                                    |                         |
| publish.sh               | Publikace balíčku na NPM                                               |                         |
| release.sh               | Bash release utility (kanonická release utilita)                       |                         |
| run-docker-tests.sh      | Spuštění testů v Dockeru                                                |                         |
| run-tests.sh             | Spuštění všech testů                                                    |                         |
| setup-claude-desktop.sh  | Nastavení prostředí pro Claude Desktop                                  |                         |
| run-mcp-inspector-tests.sh | Spuštění MCP Inspector integration testů                              | Linux/macOS             |
| run-mcp-inspector-tests.ps1 | Spuštění MCP Inspector integration testů                             | Windows PowerShell      |

## MCP Inspector Testing

Nové integration testy pro testování MCP-Prompts serveru pomocí MCP Inspector:

### Spuštění testů

**Linux/macOS:**
```bash
./scripts/run-mcp-inspector-tests.sh
```

**Windows PowerShell:**
```powershell
.\scripts\run-mcp-inspector-tests.ps1
```

### Konfigurace

Testy jsou spouštěny pouze když je nastavena environment variable:
```bash
export TEST_MCP_INSPECTOR=true
```

### Co testují

- Spuštění MCP Inspector procesu
- Připojení k MCP-Prompts serveru
- Testování MCP nástrojů (tools)
- Testování MCP zdrojů (resources)
- Správa promptů přes MCP rozhraní
- Šablony a proměnné
- Sekvence a workflow
- Error handling

## Legacy/one-off utility
Skripty `fix-esm.js`, `fix-prompt-json.js`, `fix_workflows.sh` byly přesunuty do složky `legacy/`.

## Doporučení
- Skripty označené jako legacy/one-off lze přesunout do složky `legacy/` nebo odstranit, pokud nejsou potřeba.
- Release utility je nyní pouze `release.sh` (bash).
- Přidat obdobné README i do `docker/scripts/`. 