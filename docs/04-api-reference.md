# API Reference (WIP)

This section will contain:

* MCP tool definitions (`add_prompt`, `get_prompt`, ...)
* HTTP endpoints (health check, REST-style operations)
* SSE stream docs

Until then, explore `/health` and use your MCP client for tool discovery. 

---

## Error Handling and Response Format

All HTTP API endpoints return errors in a consistent, structured JSON format. This follows best practices for modern APIs (see [RFC 9457 Problem Details](https://zuplo.com/blog/2025/02/11/best-practices-for-api-error-handling)).

### Error Response Example

```json
{
  "error": true,
  "message": "Sequence not found",
  "code": "NOT_FOUND",
  "details": { "id": "abc123" }
}
```

- `error` (boolean): Always `true` for error responses.
- `message` (string): Human-readable description of the error.
- `code` (string): Machine-readable error code (e.g., `NOT_FOUND`, `INTERNAL_ERROR`).
- `details` (object, optional): Additional context about the error (e.g., which ID was not found).

The HTTP status code will match the error type (e.g., 404 for not found, 500 for server errors).

For more details, see the [README](../README.md#faq--troubleshooting) and endpoint-specific documentation below. 