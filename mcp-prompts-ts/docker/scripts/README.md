# docker/scripts/

Tato složka obsahuje utility a skripty pro správu, build, testování a publikaci Docker kontejnerů a image MCP-Prompts.

| Skript                            | Popis                                                | Poznámka |
| --------------------------------- | ---------------------------------------------------- | -------- |
| build-and-publish.sh              | Build a publish Docker image na registry             |          |
| cleanup-docker-files.sh           | Odstranění nepotřebných Docker souborů               |          |
| cleanup.sh                        | Rychlý úklid dočasných souborů                       |          |
| consolidate-docker.sh             | Konsolidace Docker konfigurací                       |          |
| docker-compose-manager.sh         | Správa docker-compose konfigurací                    |          |
| dynamic-loader.sh                 | Dynamické načítání konfigurací                       |          |
| install-github-server.sh          | Instalace GitHub serveru pro testování               |          |
| publish-images.sh                 | Publikace Docker image                               |          |
| remove-version-attribute.sh       | Odstranění atributu version z konfiguračních souborů |          |
| test-docker-configurations.sh     | Testování různých docker-compose konfigurací         |          |
| update-docker-commands-in-docs.sh | Aktualizace docker příkazů v dokumentaci             |          |

## Doporučení

- Zvážit sloučení build/publish skriptů s hlavní složkou `scripts/` nebo jasné rozdělení kompetencí.
- Skripty, které nejsou využívány, lze přesunout do složky `legacy/` nebo odstranit.
- Udržovat tento README aktuální při přidávání/odstraňování skriptů.
