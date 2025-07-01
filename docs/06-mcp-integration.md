# MCP Integration

MCP-Prompts can be combined with other MCP servers (memory, filesystem, orchestrator, diagram, etc.) to build powerful, composable AI workflows. Integration is enabled by the MCP protocol and the modular, hexagonal architecture of the server.

> See [Overview](00-overview.md) for architecture, [API Reference](04-api-reference.md) for endpoints, and [Workflow Guide](09-workflow-guide.md) for multi-step orchestration.

---

## Server-Sent Events (SSE) (Experimental)

The server can provide a Server-Sent Events (SSE) stream for real-time notifications about prompt changes. This is useful for clients that need to stay in sync without constant polling.

### Enabling SSE

To enable the SSE endpoint, set the following environment variables:

| Variable     | Description                                | Default   |
| ------------ | ------------------------------------------ | --------- |
| `ENABLE_SSE` | Set to `"true"` to enable the SSE feature. | `"false"` |
| `SSE_PATH`   | The path for the SSE endpoint.             | `/events` |

### Connecting a Client

You can listen for events in a client application (like a browser's JavaScript environment) like this:

```javascript
const eventSource = new EventSource('http://localhost:3003/events'); // Adjust URL as needed

eventSource.onmessage = event => {
  const data = JSON.parse(event.data);
  console.log('Received SSE event:', data);
  // Example events: { type: 'prompt_added', promptId: '...' }
};

eventSource.onerror = error => {
  console.error('SSE connection error:', error);
  eventSource.close();
};
```

The server will send a heartbeat event periodically to keep the connection alive. Other event types (like `prompt_added`, `prompt_updated`) will be sent as they occur. As this feature is experimental, the exact event structure may change.
