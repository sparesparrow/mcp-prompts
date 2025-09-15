---
description: Guidelines for implementing Podman Desktop extensions with webview frontends
globs: ["src/**/*.ts", "src/**/*.tsx", "src/webview/**/*"]
---

# Webview Extension Implementation Rules

## Project Structure

### Required Files Structure
```
.
├── package.json
├── tsconfig.json
├── vite.config.ts
├── resources/
│   ├── icon.png
│   └── logo.png
├── src/
│   ├── extension.ts
│   └── webview/
│       ├── App.tsx
│       ├── index.html
│       ├── index.tsx
│       └── style.css
```

## Package.json Configuration

### Basic Configuration
```json
{
  "name": "my-webview-extension",
  "displayName": "Webview Extension",
  "description": "Extension with webview frontend",
  "version": "0.0.1",
  "publisher": "myusername",
  "license": "Apache-2.0",
  "engines": {
    "podman-desktop": "^1.0.0"
  },
  "main": "./dist/extension.js",
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch"
  },
  "devDependencies": {
    "@podman-desktop/api": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "react": "latest",
    "react-dom": "latest",
    "typescript": "latest",
    "vite": "latest"
  }
}
```

### Webview Registration
```json
{
  "contributes": {
    "icons": {
      "icon": {
        "light": "./resources/icon.png",
        "dark": "./resources/icon.png"
      }
    },
    "menus": {
      "dashboard/navigation": [
        {
          "command": "webview.show",
          "icon": "$(extensions)"
        }
      ]
    },
    "commands": [
      {
        "command": "webview.show",
        "title": "Show Webview",
        "category": "Webview"
      }
    ]
  }
}
```

## Extension Implementation

### Main Extension File (extension.ts)
```typescript
import * as podmanDesktopAPI from '@podman-desktop/api';
import * as path from 'path';

export async function activate(context: podmanDesktopAPI.ExtensionContext): Promise<void> {
  // Create provider
  const provider = podmanDesktopAPI.provider.createProvider({
    name: 'Webview Example',
    id: 'webview-example',
    status: 'ready',
    images: {
      icon: './resources/icon.png',
      logo: './resources/logo.png',
    },
  });

  // Register webview
  context.subscriptions.push(
    podmanDesktopAPI.commands.registerCommand('webview.show', () => {
      const panel = podmanDesktopAPI.window.createWebviewPanel(
        'webviewExample',
        'Webview Example',
        {
          preserveFocus: true,
        },
      );

      // Get path to webview
      const webviewPath = path.join(context.extensionPath, 'dist', 'webview');
      panel.webview.setContentUrl(path.join(webviewPath, 'index.html'));
    }),
  );

  context.subscriptions.push(provider);
}
```

## Webview Implementation

### HTML Template (index.html)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Webview Example</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
```

### React Entry Point (index.tsx)
```typescript
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './style.css';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
```

### Main App Component (App.tsx)
```typescript
import React from 'react';

export default function App(): JSX.Element {
  return (
    <div className="container">
      <h1>Hello from Webview!</h1>
      <p>This is a webview example.</p>
    </div>
  );
}
```

### Styles (style.css)
```css
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
    'Helvetica Neue', Arial, sans-serif;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}
```

## Build Configuration

### Vite Configuration
Create `vite.config.ts` with multi-target build support:
```typescript
import { defineConfig } from 'vite';
import { join } from 'path';
import { builtinModules } from 'module';
import react from '@vitejs/plugin-react';

const PACKAGE_ROOT = __dirname;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: false,
    rollupOptions: {
      input: {
        extension: join(PACKAGE_ROOT, 'src', 'extension.ts'),
        webview: join(PACKAGE_ROOT, 'src', 'webview', 'index.html'),
      },
      output: {
        entryFileNames: ({ name }) => {
          if (name === 'extension') {
            return '[name].js';
          }
          return 'webview/[name].js';
        },
      },
      external: ['@podman-desktop/api', ...builtinModules],
    },
  },
});
```

## Communication Between Extension and Webview

### Message Passing
```typescript
// In extension.ts
panel.webview.postMessage({ type: 'update', data: someData });

// In App.tsx
window.addEventListener('message', event => {
  const message = event.data;
  switch (message.type) {
    case 'update':
      // Handle update
      break;
  }
});
```

### State Management
```typescript
// In App.tsx
import React, { useState, useEffect } from 'react';

export default function App(): JSX.Element {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'update') {
        setData(message.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="container">
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

## Best Practices

### Webview Lifecycle Management
```typescript
let currentPanel: podmanDesktopAPI.WebviewPanel | undefined = undefined;

export async function activate(context: podmanDesktopAPI.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    podmanDesktopAPI.commands.registerCommand('webview.show', () => {
      if (currentPanel) {
        currentPanel.reveal();
      } else {
        currentPanel = podmanDesktopAPI.window.createWebviewPanel(/*...*/);
        
        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });
      }
    }),
  );
}
```

### Resource Loading
```typescript
// In extension.ts
const resourcePath = panel.webview.asWebviewUri(
  podmanDesktopAPI.Uri.file(
    path.join(context.extensionPath, 'resources')
  )
);

// In App.tsx
<img src={resourcePath + '/icon.png'} alt="Icon" />
```

### Error Handling
```typescript
// In extension.ts
try {
  const result = await someOperation();
  panel.webview.postMessage({ type: 'success', data: result });
} catch (error) {
  panel.webview.postMessage({ type: 'error', message: error.message });
}

// In App.tsx
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    if (message.type === 'error') {
      setError(message.message);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Performance Optimization
- Lazy load components
- Optimize resource loading
- Use proper React patterns
```typescript
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

## Testing

### Component Testing
```typescript
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders hello message', () => {
  render(<App />);
  expect(screen.getByText('Hello from Webview!')).toBeInTheDocument();
});
```

### Message Handling Testing
```typescript
test('handles update message', () => {
  render(<App />);
  
  const message = { type: 'update', data: { test: 'data' } };
  window.postMessage(message, '*');
  
  expect(screen.getByText('"test": "data"')).toBeInTheDocument();
});
```
