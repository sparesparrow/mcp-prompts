# Configuration

All configuration for MCP-Prompts is handled via environment variables. This enables flexible deployment across local, Docker, and cloud environments.

> **MCP-Prompts** is built with hexagonal architecture: configuration is validated at the boundary, keeping core logic portable and testable. See [Overview](00-overview.md) for architecture and [Quickstart](01-quickstart.md) for setup.

MCP-Prompts validates all variables at startup using [Zod](https://github.com/colinhacks/zod). If any required variable is missing or invalid, the server prints a clear error and exits.

Below is a complete list of supported environment variables, grouped by section. Types and defaults are shown where applicable.

---

## Core Server Settings

| Variable     | Type    | Default        | Description                                                 |
| ------------ | ------- | -------------- | ----------------------------------------------------------- |
| NAME         | string  | mcp-prompts    | Name of the server                                          |
| VERSION      | string  | 1.0.0          | Version string                                              |
| STORAGE_TYPE | enum    | file           | Storage backend: file, postgres, memory, mdc, elasticsearch |
| PROMPTS_DIR  | string  | ./data/prompts | Directory for prompt files                                  |
| BACKUPS_DIR  | string  | ./data/backups | Directory for backups                                       |
| PORT         | number  | 3003           | HTTP port                                                   |
| LOG_LEVEL    | enum    | info           | Log level: debug, info, warn, error                         |
| HTTP_SERVER  | boolean | true           | Enable HTTP server                                          |
| MCP_SERVER   | boolean | false          | Enable MCP server                                           |
| HOST         | string  | localhost      | Hostname                                                    |
| ENABLE_SSE   | boolean |                | Enable SSE (optional)                                       |
| SSE_PATH     | string  |                | SSE endpoint path (optional)                                |
| CORS_ORIGIN  | string  |                | CORS allowed origin (optional)                              |

## Streaming

| Variable             | Type    | Default | Description                         |
| -------------------- | ------- | ------- | ----------------------------------- |
| STREAMING_ENABLED    | boolean |         | Enable streaming (optional)         |
| STREAMING_CHUNK_SIZE | number  |         | Streaming chunk size (optional)     |
| STREAMING_MAX_TOKENS | number  |         | Max tokens for streaming (optional) |

## Sequences

| Variable                 | Type   | Default | Description                        |
| ------------------------ | ------ | ------- | ---------------------------------- |
| SEQUENCES_MAX_STEPS      | number |         | Max steps in a sequence (optional) |
| SEQUENCES_TIMEOUT        | number |         | Sequence timeout in ms (optional)  |
| SEQUENCES_RETRY_ATTEMPTS | number |         | Sequence retry attempts (optional) |

## PostgreSQL

| Variable                 | Type    | Default     | Description                                       |
| ------------------------ | ------- | ----------- | ------------------------------------------------- |
| POSTGRES_HOST            | string  |             | Postgres host (required if STORAGE_TYPE=postgres) |
| POSTGRES_PORT            | number  | 5432        | Postgres port                                     |
| POSTGRES_DATABASE        | string  | mcp_prompts | Postgres database name                            |
| POSTGRES_USER            | string  | postgres    | Postgres user                                     |
| POSTGRES_PASSWORD        | string  |             | Postgres password                                 |
| POSTGRES_SSL             | boolean |             | Use SSL for Postgres (optional)                   |
| POSTGRES_MAX_CONNECTIONS | number  |             | Max Postgres connections (optional)               |

## MDC (Markdown Cursor Rules)

| Variable            | Type    | Default | Description                                            |
| ------------------- | ------- | ------- | ------------------------------------------------------ |
| MDC_RULES_DIR       | string  |         | Directory for MDC rules (required if STORAGE_TYPE=mdc) |
| MDC_BACKUP_ENABLED  | boolean |         | Enable MDC backup (optional)                           |
| MDC_BACKUP_INTERVAL | number  |         | MDC backup interval in ms (optional)                   |

## ElasticSearch

| Variable                     | Type   | Default | Description                                                     |
| ---------------------------- | ------ | ------- | --------------------------------------------------------------- |
| ELASTICSEARCH_NODE           | string |         | ElasticSearch node URL (required if STORAGE_TYPE=elasticsearch) |
| ELASTICSEARCH_USERNAME       | string |         | ElasticSearch username (optional)                               |
| ELASTICSEARCH_PASSWORD       | string |         | ElasticSearch password (optional)                               |
| ELASTICSEARCH_INDEX          | string |         | ElasticSearch index (optional)                                  |
| ELASTICSEARCH_SEQUENCE_INDEX | string |         | ElasticSearch sequence index (optional)                         |

## ElevenLabs (Text-to-Speech)

| Variable                      | Type    | Default | Description                                             |
| ----------------------------- | ------- | ------- | ------------------------------------------------------- |
| ELEVENLABS_API_KEY            | string  |         | ElevenLabs API key (optional)                           |
| ELEVENLABS_MODEL_ID           | string  |         | ElevenLabs model ID (optional)                          |
| ELEVENLABS_VOICE_ID           | string  |         | ElevenLabs voice ID (optional)                          |
| ELEVENLABS_OPTIMIZATION_LEVEL | enum    |         | Optimization level: speed, quality, balanced (optional) |
| ELEVENLABS_STABILITY          | number  |         | Stability (0-1, optional)                               |
| ELEVENLABS_SIMILARITY_BOOST   | number  |         | Similarity boost (0-1, optional)                        |
| ELEVENLABS_SPEAKER_BOOST      | boolean |         | Speaker boost (optional)                                |
| ELEVENLABS_STYLE              | number  |         | Style (0-1, optional)                                   |
| ELEVENLABS_USE_CACHING        | boolean |         | Enable audio caching (optional)                         |
| ELEVENLABS_CACHE_DIR          | string  |         | Audio cache directory (optional)                        |

---

**Note:** All variables are validated at startup using Zod. If any required variable is missing or invalid, the server will print a clear error and exit. See `src/config.ts` for the authoritative schema.

For now see the `src/http-server.ts` and `src/index.ts` files for defaults and `tests/` for examples.
