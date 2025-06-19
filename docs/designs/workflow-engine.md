# MCP-Prompts – Workflow Engine: Technický návrh

> Stav dokumentu: _Draft v0.1_ • Autoři: Tým MCP-Prompts • Datum: 2025-05-15

## 1 Motivace a cíle

Současný server MCP-Prompts ukládá a distribuuje jednotlivé prompty. Uživatelé však často potřebují spouštět několik promptů v přesně definovaném sledu ("řetězení") a navázat na jejich výstupy dalšími kroky. Cílem Workflow Enginu je poskytnout:

* deklarativní popis workflow (YAML/JSON)
* deterministické a opakovatelné spouštění sekvencí (`PromptSequence`)
* předávání dat mezi kroky (context object)
* extensibilní kroky (volání externích MCP serverů, shell příkazů apod.)
* plnohodnotné API + CLI podporu
* možnost paralelizace (v budoucnu)

## 2 Základní koncepty

| Pojem            | Popis                                                                                                               |
|------------------|----------------------------------------------------------------------------------------------------------------------|
| **Workflow**     | Kořenový objekt, který popisuje celý proces, jeho kroky a sdílený kontext.                                           |
| **Step**         | Jednotlivá akce v rámci workflow (vyvolání promptu, shell, HTTP request…).                                           |
| **Input**        | Vstupní data kroku – mohou pocházet z konstant, env, nebo výstupu předchozího kroku.                                 |
| **Output**       | Výstup kroku – ukládá se do shared context pod zadaným klíčem.                                                        |
| **Condition**    | (volitelné) podmínka, zda krok vykonat (`expression` evaluovaná nad contextem).                                      |
| **ErrorPolicy**  | Strategie při chybě (`continue`, `skip`, `abort`, `retry<n>`).                                                       |

## 3 Formát definice (`workflow.yaml`)

```yaml
id: generate-release
name: Release Notes Generator
version: 1

# Proměnné použitelné v celém workflow
variables:
  repo: modelcontextprotocol/mcp-prompts
  tag: v1.3.0

steps:
  - id: fetch_commits
    type: prompt
    promptId: repository-explorer
    input:
      owner: "{{ repo.split('/')![0] }}"
      repo_name: "{{ repo.split('/')![1] }}"
      since_tag: "{{ tag }}"
    output: commits

  - id: summarize
    type: prompt
    promptId: sequential-data-analysis
    input:
      data_type: commits
      data_sample: "{{ context.commits }}"
    output: release_notes

  - id: write_file
    type: shell
    command: "echo '{{ context.release_notes }}' > RELEASE_NOTES.md"
```

### 3.1 Podporované typy kroků (MVP)

* `prompt` – spuštění existujícího promptu z MCP-Prompts
* `shell` – spuštění shell příkazu (běží v sandboxu serveru)
* `http` – volání HTTP metody (GET/POST…)

## 4 Architektura

```
              +---------------+
              |  HTTP Client  |
              +---------------+
                     | REST
         +-----------v-----------+
         |  WorkflowController   |
         +-----------+-----------+
                     |
          +----------v-----------+
          |  WorkflowService     |
          +----------+-----------+
                     |
      +--------------v--------------+
      |  StepRunner (strategy)      |
      +--------------+--------------+
                     |
           +---------v--------+
           | PromptRunner     |
           | ShellRunner      |
           | HttpRunner       |
           +-----------------+
```

* **WorkflowController** – REST endpoint `POST /api/v1/workflows/run` + CRUD.
* **WorkflowService** – parsování definice, validace, orchestrace kroků.
* **StepRunner** – strategický pattern, vždy konkrétní runner dle `type`.
* Shared **Context Store** (in-memory Map) – uchovává `context` mezi kroky.
* Časovače / Queue (future) – pro plánované nebo paralelní spouštění.

## 5 API rozhraní (MVP)

| Metoda | URL | Popis |
|--------|-----|-------|
| `POST` | `/api/v1/workflows/run` | Spustit ad-hoc workflow (tělo = definice) |
| `POST` | `/api/v1/workflows`     | Uložit workflow definici |
| `GET`  | `/api/v1/workflows/:id` | Detail uloženého workflow |
| `POST` | `/api/v1/workflows/:id/run` | Spustit uložený workflow |

## 6 CLI integrace

Nové příkazy:

```bash
mcp-prompts workflow run ./release.yaml      # ad-hoc
mcp-prompts workflow save ./release.yaml     # uložit
mcp-prompts workflow run saved-id            # spustit uložený
```

## 7 Validace & schéma

* JSON Schema `workflow.schema.json` bude publikováno v `src/schemas.ts`.
* `npm run validate:workflow <file>` provede validaci (rozšíříme `validate-json.ts`).

## 8 Bezpečnostní a výkonové aspekty

* **Sandbox** – shell kroky běží s omezenými oprávněními (Docker exec nebo child_process bez root).
* **Timeout** – implicitní limit (např. 60 s) na krok.
* **Rate limit** – omezení paralelních workflow pro jednoho uživatele.
* **Audit log** – zaznamenáme spuštění a výsledky.

## 9 Budoucí rozšíření

* Paralelní kroky (`dependsOn`, `runAfter`)
* Stavový stroj a vizualizace dag-u
* UI v Claude Desktop / Web konzole
* Pokročilé condition expression (`jq`, `JMESPath`)
* Integrace s externími frontami (Redis, BullMQ)

## 10 Otevřené otázky

1. Serializace velkých výstupů (uložit jen hash vs. celá data?)
2. Mechanismus `secrets` pro shell & http kroky
3. Distribuované běhy (sharding, worker pool)

---

_Diskusi nad dokumentem prosím otevírejte v Issues nebo komunikujte na Slacku #mcp-prompts._ 