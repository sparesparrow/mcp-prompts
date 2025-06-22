# scripts/

Tato složka obsahuje utility a pomocné skripty pro správu, build, testování a release MCP-Prompts.

| Skript                   | Popis                                            | Poznámka |
| ------------------------ | ------------------------------------------------ | -------- |
| build-and-push-docker.sh | Build a push Docker image na registry            |          |
| docker-manage.sh         | Správa a ovládání Docker kontejnerů              |          |
| publish.sh               | Publikace balíčku na NPM                         |          |
| release.sh               | Bash release utility (kanonická release utilita) |          |
| run-docker-tests.sh      | Spuštění testů v Dockeru                         |          |
| run-tests.sh             | Spuštění všech testů                             |          |
| setup-claude-desktop.sh  | Nastavení prostředí pro Claude Desktop           |          |

## Legacy/one-off utility

Skripty `fix-esm.js`, `fix-prompt-json.js`, `fix_workflows.sh` byly přesunuty do složky `legacy/`.

## Doporučení

- Skripty označené jako legacy/one-off lze přesunout do složky `legacy/` nebo odstranit, pokud nejsou potřeba.
- Release utility je nyní pouze `release.sh` (bash).
- Přidat obdobné README i do `docker/scripts/`.
