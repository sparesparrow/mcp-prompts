# Storage Adapters

MCP-Prompts supports multiple storage backends, each implemented as a pluggable adapter. This follows the **hexagonal architecture** principle: storage logic is isolated from core business logic, making it easy to add new backends or swap existing ones.

Configure the desired adapter via the `STORAGE_TYPE` environment variable. See [Configuration](02-configuration.md) for all options.

## Implemented

- **`file` (default)**: Stores each prompt as a JSON file on disk. Simple, human-readable, and great for getting started.
- **`postgres`**: Stores prompts in a PostgreSQL database. Recommended for production or multi-instance deployments. Supports JSONB for metadata and arrays for tags. Can be extended for vector/embedding search with PGAI.
- **`memory`**: A volatile, in-memory adapter used for testing and development. Data is not persisted.

## Planned / In-Progress

- **`mdc`**: Adapter to read prompts directly from [Cursor's](https://cursor.sh/) `.cursor/rules` directory (MDC format). Manage prompts as plain markdown files. **(Status: Conceptual)**
- **`elasticsearch`**: Adapter for storing and searching prompts in ElasticSearch, including support for dense vector (k-NN) search. **(Status: On Roadmap for v1.3)**

> Want to add your own adapter? See [Developer Guide](07-developer-guide.md) for extension patterns.

---

Configuration examples will be added soon.
