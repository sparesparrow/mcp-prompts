# Doplnění katalogu orchestrace

Nové šablony: 9 hlavních agentů pro všechny návratové typy detektoru v `scripts/orchestrate-project.sh`, 3 analytické subagenty a 7 úvodních kognitivních promptů. Nejde o obnovu neznámých historických souborů.

Hlavní agenti jsou v `main-agents/main_agent_<typ>.json`. `agentConfig.subagents` odkazuje na soubory v `subagents/` s description a content. Model není nastaven: launcher dále použije svůj stávající výchozí model. agentConfig je rozšíření pro launcher, nikoliv nová součást veřejného schématu add_prompt/update_prompt.

`cognitive/` obsahuje perception, episodes, semantic, procedures, meta, transfer a evaluation podle CLAUDE.md. Jde o instrukce, ne běžící vědomí, telemetrii ani automatické učení. Launcher je automaticky nezapojuje; rekurzivní MCP loader je načte jako další prompty. Každý prompt má jedinečné id, name, content, isTemplate=false, tags, version a metadata.

Offline kontrola: `python3 scripts/test-prompt-catalog.py`. Testuje strukturu, typy, reference a vrstvy, ne živý MCP transport, skutečné --agents v Claude CLI nebo kvalitu odpovědí. Lokální ověření přírůstku nezahrnuje všechny starší prompty; test v úplném klonu zkontroluje také kolize jejich ID.

Pozor: existující launcher používá --permission-mode bypassPermissions a ~/.cursor/mcp.json. Tento commit jej nemění ani nespouští. Prompty nejsou sandbox. Před živým spuštěním vyřeš izolaci, souhlasy a možné náklady modelu; zatím nejde o bezpečný automatický spouštěč pluginu Omarchy.
