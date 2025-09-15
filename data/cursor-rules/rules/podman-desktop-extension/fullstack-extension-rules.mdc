---
description: Guidelines for implementing full-stack Podman Desktop extensions with separate frontend, backend, and shared packages
globs: ["packages/**/*"]
---

# Full-Stack Extension Implementation Rules

## Project Structure

### Package Organization
```
.
├── package.json
├── packages/
│   ├── backend/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── extension.ts
│   │   │   ├── api-impl.ts
│   │   │   └── types.ts
│   │   └── media/        # Built frontend assets
│   ├── frontend/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── App.svelte
│   │   │   ├── lib/
│   │   │   │   └── components/
│   │   │   └── main.ts
│   │   ├── index.html
│   │   └── tailwind.config.js
│   └── shared/
│       ├── package.json
│       └── src/
│           └── HelloWorldApi.ts
```

## Package Configuration

### Root Package.json
```json
{
  "name": "podman-desktop-extension-fullstack",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build -w packages/frontend && npm run build -w packages/backend",
    "watch": "concurrently \"npm run watch -w packages/frontend\" \"npm run watch -w packages/backend\"",
    "lint": "eslint packages/*/src --ext .ts,.tsx,.svelte",
    "lint:fix": "eslint packages/*/src --ext .ts,.tsx,.svelte --fix",
    "typecheck": "npm run typecheck -w packages/frontend && npm run typecheck -w packages/backend",
    "format": "prettier --check \"packages/*/src/**/*.{ts,tsx,svelte}\"",
    "format:fix": "prettier --write \"packages/*/src/**/*.{ts,tsx,svelte}\""
  },
  "devDependencies": {
    "concurrently": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "typescript": "latest"
  }
}
```

### Backend Package.json
```json
{
  "name": "@podman-desktop/extension-fullstack-backend",
  "version": "0.0.1",
  "private": true,
  "engines": {
    "podman-desktop": "^1.0.0"
  },
  "main": "./dist/extension.js",
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch"
  },
  "dependencies": {
    "@podman-desktop/api": "latest"
  },
  "devDependencies": {
    "vite": "latest"
  }
}
```

### Frontend Package.json
```json
{
  "name": "@podman-desktop/extension-fullstack-frontend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch"
  },
  "dependencies": {
    "@podman-desktop/ui-svelte": "latest",
    "svelte": "latest"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "latest",
    "autoprefixer": "latest",
    "postcss": "latest",
    "tailwindcss": "latest",
    "vite": "latest"
  }
}
```

## Backend Implementation

### Extension Entry Point (extension.ts)
```typescript
import * as podmanDesktopAPI from '@podman-desktop/api';
import { HelloWorldApiImpl } from './api-impl';
import * as path from 'path';

export async function activate(context: podmanDesktopAPI.ExtensionContext): Promise<void> {
  // Create provider
  const provider = podmanDesktopAPI.provider.createProvider({
    name: 'Full-Stack Example',
    id: 'fullstack-example',
    status: 'ready',
    images: {
      icon: './resources/icon.png',
      logo: './resources/logo.png',
    },
  });

  // Create API implementation
  const helloWorldApi = new HelloWorldApiImpl();

  // Register webview
  const disposable = podmanDesktopAPI.window.registerWebviewViewProvider(
    'fullstack-example-view',
    {
      resolveWebviewView: async (webviewView: podmanDesktopAPI.WebviewView) => {
        // Set webview options
        webviewView.webview.options = {
          enableScripts: true,
        };

        // Set HTML content
        const mediaPath = path.join(context.extensionPath, 'media');
        webviewView.webview.html = getWebviewContent(mediaPath);

        // Setup message handling
        webviewView.webview.onDidReceiveMessage(async message => {
          if (message.channel === 'hello') {
            const response = await helloWorldApi.sayHello(message.payload);
            webviewView.webview.postMessage({ channel: 'hello-response', payload: response });
          }
        });
      },
    },
  );

  context.subscriptions.push(provider, disposable);
}

function getWebviewContent(mediaPath: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Full-Stack Example</title>
        <link href="${mediaPath}/index.css" rel="stylesheet">
      </head>
      <body>
        <div id="app"></div>
        <script type="module" src="${mediaPath}/index.js"></script>
      </body>
    </html>
  `;
}
```

### API Implementation (api-impl.ts)
```typescript
import type { HelloWorldApi } from '@podman-desktop/extension-fullstack-shared';

export class HelloWorldApiImpl implements HelloWorldApi {
  async sayHello(name: string): Promise<string> {
    return `Hello, ${name}! From the backend.`;
  }
}
```

## Frontend Implementation

### Main App Component (App.svelte)
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Input } from '@podman-desktop/ui-svelte';
  import type { HelloWorldApi } from '@podman-desktop/extension-fullstack-shared';

  let name = '';
  let response = '';
  let api: HelloWorldApi;

  onMount(() => {
    // Setup message handling
    window.addEventListener('message', event => {
      if (event.data.channel === 'hello-response') {
        response = event.data.payload;
      }
    });
  });

  async function handleSayHello() {
    const vscode = (window as any).acquireVsCodeApi();
    vscode.postMessage({ channel: 'hello', payload: name });
  }
</script>

<div class="p-4">
  <h1 class="text-2xl font-bold mb-4">Full-Stack Example</h1>
  
  <div class="space-y-4">
    <Input 
      bind:value={name} 
      placeholder="Enter your name"
    />
    
    <Button 
      on:click={handleSayHello}
      disabled={!name}
    >
      Say Hello
    </Button>

    {#if response}
      <p class="mt-4">{response}</p>
    {/if}
  </div>
</div>
```

### Tailwind Configuration (tailwind.config.js)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

## Shared Package

### API Definition (HelloWorldApi.ts)
```typescript
export interface HelloWorldApi {
  sayHello(name: string): Promise<string>;
}
```

## Build Configuration

### Backend Vite Config
```typescript
import { defineConfig } from 'vite';
import { join } from 'path';
import { builtinModules } from 'module';

const PACKAGE_ROOT = __dirname;

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/extension.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['@podman-desktop/api', ...builtinModules],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
```

### Frontend Vite Config
```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../backend/media',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index.[ext]',
      },
    },
  },
});
```

## Communication Patterns

### Message Passing
```typescript
// Frontend to Backend
const vscode = (window as any).acquireVsCodeApi();
vscode.postMessage({ 
  channel: 'channel-name',
  payload: data 
});

// Backend to Frontend
webviewView.webview.postMessage({ 
  channel: 'channel-name',
  payload: data 
});
```

### API Implementation Pattern
1. Define interface in shared package
2. Implement in backend
3. Call from frontend via message passing

## Best Practices

### Type Safety
- Use shared types across packages
- Validate message payloads
- Use strict TypeScript configuration

### Package Organization
- Keep packages focused and minimal
- Share common code through shared package
- Use proper versioning for packages

### State Management
- Use Svelte stores for frontend state
- Keep backend state minimal and focused
- Clear state reset patterns

### Error Handling
```typescript
// Backend
try {
  const result = await operation();
  webviewView.webview.postMessage({
    channel: 'response',
    payload: result,
  });
} catch (error) {
  webviewView.webview.postMessage({
    channel: 'error',
    payload: error.message,
  });
}

// Frontend
window.addEventListener('message', event => {
  if (event.data.channel === 'error') {
    // Handle error
    console.error(event.data.payload);
  }
});
```

### Performance
- Lazy load components
- Minimize message passing
- Optimize build output
```typescript
// Lazy loading example
const HeavyComponent = () => import('./HeavyComponent.svelte');
```

## Testing

### Backend Testing
```typescript
import { HelloWorldApiImpl } from './api-impl';

describe('HelloWorldApi', () => {
  let api: HelloWorldApiImpl;

  beforeEach(() => {
    api = new HelloWorldApiImpl();
  });

  it('should return greeting', async () => {
    const result = await api.sayHello('Test');
    expect(result).toBe('Hello, Test! From the backend.');
  });
});
```

### Frontend Testing
```typescript
import { render, fireEvent } from '@testing-library/svelte';
import App from './App.svelte';

describe('App', () => {
  it('should render hello button', () => {
    const { getByText } = render(App);
    expect(getByText('Say Hello')).toBeInTheDocument();
  });
});
```

## Development Workflow

### Building
```bash
# Build all packages
npm run build

# Watch mode
npm run watch

# Build specific package
npm run build -w packages/frontend
```

### Code Quality
```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run typecheck

# Format code
npm run format:fix
```

### Debugging
- Use Chrome DevTools for frontend
- Use VS Code debugging for backend
- Enable source maps in build
