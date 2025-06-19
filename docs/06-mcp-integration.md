# MCP Integration (WIP)

Guides and examples for combining MCP-Prompts with other servers (memory, filesystem, orchestrator, diagram, etc.).

Expected content:

* How to enable `ENABLE_RESOURCES`.
* Resource URI patterns and examples.
* Docker Compose snippets.

---

## Server-Sent Events (SSE) (Experimental)

The server can provide a Server-Sent Events (SSE) stream for real-time notifications about prompt changes. This is useful for clients that need to stay in sync without constant polling.

### Enabling SSE

To enable the SSE endpoint, set the following environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `ENABLE_SSE` | Set to `"true"` to enable the SSE feature. | `"false"` |
| `SSE_PATH` | The path for the SSE endpoint. | `/events` |

### Connecting a Client

You can listen for events in a client application (like a browser's JavaScript environment) like this:

```javascript
const eventSource = new EventSource('http://localhost:3003/events'); // Adjust URL as needed

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received SSE event:', data);
  // Example events: { type: 'prompt_added', promptId: '...' }
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  eventSource.close();
};
```

The server will send a heartbeat event periodically to keep the connection alive. Other event types (like `prompt_added`, `prompt_updated`) will be sent as they occur. As this feature is experimental, the exact event structure may change. 