---
description: Guidelines for using the Podman Desktop extension API
globs: ["src/extension.ts", "src/**/provider.ts"]
---

# Extension API Development Rules

## Extension Lifecycle

### Activation
- Implement async activate function
- Handle all setup operations
- Register disposables with context
```typescript
export async function activate(context: extensionApi.ExtensionContext): Promise<void> {
  // Setup providers
  const provider = extensionApi.provider.createProvider({
    name: 'MyProvider',
    id: 'my-provider',
    status: 'not-installed',
    images: {
      icon: './resources/icon.png',
      logo: './resources/logo.png',
    },
  });
  
  // Register disposables
  context.subscriptions.push(provider);
  
  // Initialize async resources
  await provider.initialize();
}
```

### Deactivation
- Implement deactivate function for cleanup
- Handle async cleanup operations
```typescript
export async function deactivate(): Promise<void> {
  // Perform cleanup
  await provider.dispose();
}
```

## Provider Management

### Provider Status
- Use appropriate ProviderStatus values
- Update status based on actual state
```typescript
const validStates: ProviderStatus[] = [
  'not-installed',
  'installed',
  'configured',
  'ready',
  'started',
  'stopped',
  'starting',
  'stopping',
  'error',
  'unknown'
];

// Update status appropriately
provider.updateStatus('starting');
await performStartup();
provider.updateStatus('started');
```

### Connection Status
- Handle connection state changes
- Implement proper error handling
```typescript
provider.updateStatus('starting');
try {
  await establishConnection();
  provider.updateStatus('started');
} catch (error) {
  provider.updateStatus('error');
  throw new Error(`Connection failed: ${error.message}`);
}
```

## Command Registration

### Command Definition
- Register commands with unique identifiers
- Implement command handlers
```typescript
const command = extensionApi.commands.registerCommand('my-provider.start', async () => {
  try {
    await provider.start();
    await extensionApi.window.showInformationMessage('Provider started successfully');
  } catch (error) {
    await extensionApi.window.showErrorMessage(`Failed to start provider: ${error.message}`);
  }
});
context.subscriptions.push(command);
```

### Command Categories
- Group related commands
- Use consistent naming patterns
```typescript
{
  "contributes": {
    "commands": [
      {
        "command": "my-provider.start",
        "title": "Start Provider",
        "category": "My Provider"
      },
      {
        "command": "my-provider.stop",
        "title": "Stop Provider",
        "category": "My Provider"
      }
    ]
  }
}
```

## UI Integration

### Status Bar Items
- Create informative status bar items
- Update status bar items based on state
```typescript
const statusBarItem = extensionApi.window.createStatusBarItem(
  extensionApi.StatusBarAlignLeft,
  100
);
statusBarItem.text = 'My Provider';
statusBarItem.command = 'my-provider.showMenu';
context.subscriptions.push(statusBarItem);
```

### Notifications
- Use appropriate notification types
- Provide actionable information
```typescript
// DO
await extensionApi.window.showInformationMessage(
  'Provider requires configuration',
  'Configure Now',
  'Later'
);

// DON'T
await extensionApi.window.showInformationMessage(
  'Provider error occurred'
);
```

## Configuration Management

### Settings Definition
- Define settings in package.json
- Use appropriate types and validation
```json
{
  "contributes": {
    "configuration": {
      "title": "My Provider",
      "properties": {
        "my-provider.endpoint": {
          "type": "string",
          "default": "http://localhost:8080",
          "description": "Provider endpoint URL"
        }
      }
    }
  }
}
```

### Settings Access
- Use configuration API to access settings
- Handle configuration changes
```typescript
const config = extensionApi.workspace.getConfiguration('my-provider');
const endpoint = config.get<string>('endpoint');

extensionApi.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('my-provider.endpoint')) {
    // Handle configuration change
    updateEndpoint();
  }
});
```

## Resource Management

### Disposables
- Register all disposables with extension context
- Implement proper cleanup
```typescript
// DO
const disposables: extensionApi.Disposable[] = [];
disposables.push(
  extensionApi.commands.registerCommand('my-provider.command', () => {}),
  extensionApi.window.createStatusBarItem()
);
context.subscriptions.push(...disposables);

// DON'T
extensionApi.commands.registerCommand('my-provider.command', () => {});
```

### Event Handling
- Use proper event subscription patterns
- Clean up event listeners
```typescript
const listener = provider.onDidChangeStatus(status => {
  updateUI(status);
});
context.subscriptions.push(listener);
```

## Error Handling

### API Errors
- Handle API-specific errors
- Provide user feedback
```typescript
try {
  await provider.performOperation();
} catch (error) {
  if (error instanceof extensionApi.ProviderError) {
    await extensionApi.window.showErrorMessage(
      `Provider error: ${error.message}`,
      'Retry',
      'Cancel'
    );
  } else {
    throw error;
  }
}
```

### Recovery Strategies
- Implement graceful degradation
- Provide recovery options
```typescript
async function handleProviderFailure(): Promise<voi