# API Reference

This section documents the HTTP API endpoints and error handling for MCP-Prompts. For MCP tool and resource APIs, see the MCP SDK documentation.

---

## Endpoints

### 1. Health Check

- **Method:** GET
- **Path:** `/health`
- **Description:** Returns a simple status object to verify the server is running.

#### Example Request
```http
GET /health HTTP/1.1
Host: localhost:3003
```

#### Example Response
```json
{
  "status": "ok"
}
```

---

### 2. Get Sequence with Prompts

- **Method:** GET
- **Path:** `/api/v1/sequence/:id`
- **Description:** Retrieves a prompt sequence and all referenced prompts by sequence ID.
- **URL Parameters:**
  - `id` (string, required): The unique sequence ID.

#### Example Request
```http
GET /api/v1/sequence/my-sequence-id HTTP/1.1
Host: localhost:3003
```

#### Example Success Response
```json
{
  "id": "my-sequence-id",
  "name": "My Sequence",
  "description": "A multi-step workflow",
  "promptIds": ["step1", "step2"],
  "createdAt": "2024-06-01T12:00:00.000Z",
  "updatedAt": "2024-06-01T12:00:00.000Z",
  "metadata": {},
  "prompts": [
    {
      "id": "step1",
      "name": "Step 1",
      "content": "...",
      "createdAt": "...",
      "updatedAt": "...",
      "version": 1
    },
    {
      "id": "step2",
      "name": "Step 2",
      "content": "...",
      "createdAt": "...",
      "updatedAt": "...",
      "version": 1
    }
  ]
}
```

#### Example Error Response
```json
{
  "error": true,
  "message": "Sequence not found",
  "code": "NOT_FOUND",
  "details": { "id": "my-sequence-id" }
}
```
- **Status Codes:**
  - `200 OK` on success
  - `404 Not Found` if the sequence does not exist
  - `500 Internal Server Error` for unexpected errors

---

### 3. Server-Sent Events (SSE) Stream

- **Method:** GET
- **Path:** `/events` (default, configurable)
- **Description:** Opens a persistent connection for real-time server events using [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).
- **Headers:**
  - `Accept: text/event-stream`

#### Example Request
```http
GET /events HTTP/1.1
Host: localhost:3003
Accept: text/event-stream
```

#### Example Response (SSE stream)
```
event: connected
data: {}

event: heartbeat
data: "2024-06-01T12:00:00.000Z"

event: test
data: {"timestamp":"2024-06-01T12:00:05.000Z","message":"Hello from SSE server!","clients":["client_1"]}

```
- **Notes:**
  - The connection remains open; events are sent as they occur.
  - Heartbeat events are sent every 30 seconds to keep the connection alive.
  - The endpoint path can be changed via configuration.
  - See [src/scripts/sse-test.ts](../src/scripts/sse-test.ts) for usage examples.

---

## CORS and Security

- All endpoints support CORS (default: `*`). You can restrict origins via configuration.
- Only GET and OPTIONS methods are supported for public endpoints.
- No authentication is required by default (add a reverse proxy or API gateway for production security).

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

For more details, see the [README](../README.md#faq--troubleshooting) and endpoint-specific documentation above.

---

## Types

### Prompt
See [src/interfaces.ts](../src/interfaces.ts) for the full definition.

Key fields:
- `id` (string): Unique prompt ID
- `name` (string): Human-readable name
- `description` (string, optional): Description
- `content` (string): Prompt content
- `isTemplate` (boolean, optional): Is this a template?
- `variables` (array, optional): Template variables
- `tags` (array, optional): Tags for filtering
- `category` (string, optional): Category
- `createdAt` (string): ISO date
- `updatedAt` (string): ISO date
- `version` (number, optional): Version
- `metadata` (object, optional): Extra info

### Sequence
See [src/interfaces.ts](../src/interfaces.ts) for the full definition.

Key fields:
- `id` (string): Unique sequence ID
- `name` (string): Name
- `description` (string, optional): Description
- `promptIds` (array): Ordered prompt IDs
- `createdAt` (string): ISO date
- `updatedAt` (string): ISO date
- `metadata` (object, optional): Extra info
- `prompts` (array): Full prompt objects (when returned by `/api/v1/sequence/:id`)

---

## See Also
- [How to document API endpoints (idratherbewriting.com)](https://idratherbewriting.com/learnapidoc/docendpoints.html)
- [Postman: API documentation best practices](https://www.postman.com/api-platform/api-documentation/)
- [MCP-Prompts README](../README.md) 