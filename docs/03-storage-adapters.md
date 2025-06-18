# Storage Adapters

The server supports multiple storage backends. You can configure the desired adapter via the `STORAGE_TYPE` environment variable.

## Implemented

*   **`file` (default)**: Stores each prompt as a JSON file on disk. Simple, human-readable, and great for getting started.
*   **`postgres`**: Stores prompts in a PostgreSQL database. Recommended for production or multi-instance deployments. Supports JSONB for metadata and arrays for tags. Can be extended for vector/embedding search with PGAI.
*   **`memory`**: A volatile, in-memory adapter used for testing and development. Data is not persisted.

## Planned / In-Progress

*   **`mdc`**: An adapter to read prompts directly from [Cursor's](https://cursor.sh/) `.cursor/rules` directory (MDC format). This will allow you to manage prompts as plain markdown files. **(Status: Conceptual)**
*   **`elasticsearch`**: An adapter for storing and searching prompts in ElasticSearch, including support for dense vector (k-NN) search. **(Status: On Roadmap for v1.3)**

Configuration examples will be added soon. 