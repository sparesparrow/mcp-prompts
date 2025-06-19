# MCP-Prompts – Quick Overview

MCP-Prompts je **MCP server**, který ukládá a doručuje prompty, šablony a nyní i sekvence/workflow pro AI klienty.

## Why use it?

* 📚 Centralizované úložiště promptů a šablon
* 🔄 Verzování + validace JSON schématem
* 🧩 Více backendů – File / PostgreSQL / In-Memory (+ další)
* 🔗 Integrace s ostatními MCP servery (filesystem, GitHub, memory…)
* ⚡ Rychlé API + CLI (`npx mcp-prompts ...`)

### Architecture at a glance

```mermaid
graph TD;
  subgraph Clients
    CLI[CLI] 
    API[HTTP API] 
    Other[Other MCP Servers]
  end
  CLI --> SERVER(MCP-Prompts)
  API --> SERVER
  Other --> SERVER
  subgraph Storage
    File[File Adapter]
    Postgres[PostgreSQL Adapter]
    Memory[In-Memory Adapter]
  end
  SERVER --> File
  SERVER --> Postgres
  SERVER --> Memory
  SERVER -->|"Resource links"| EXT[External MCP Servers]
```

*Podrobnou dokumentaci najdete v jednotlivých souborech v `docs/` – českou verzi přehledu viz **`docs/00-overview-cs.md`**.* 