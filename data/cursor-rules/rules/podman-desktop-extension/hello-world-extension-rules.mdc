---
description: Guidelines for implementing a basic hello world Podman Desktop extension
globs: ["src/extension.ts", "package.json"]
---

# Hello World Extension Implementation Rules

## Project Structure

### Required Files
Maintain the following minimal project structure:
```
.
├── package.json
├── tsconfig.json
├── vite.config.ts
├── resources/
│   ├── icon.png
│   └── logo.png
└── src/
    └── extension.ts
```

## Package.json Configuration

### Basic Configuration
- Include required metadata and dependencies
```json
{
  "name": "my-hello-world-extension",
  "displayName": "Hello World Extension",
  "description": "A simple hello world extension for Podman Desktop",
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
    "typescript": "latest",
    "vite": "latest"
  }
}
```

### Command Contribution
- Define the hello world command
```json
{
  "contributes": {
    "commands": [
      {
        "command": "hello-world.showMessage",
        "title": "Show Hello World Message",
        "category": "Hello World"
      }
    ]
  }
}
```

## Extension Implementation

### Basic Extension Structure
```typescript
import * as podmanDesktopAPI from '@podman-desktop/api';

export async function activate(context: podmanDesktopAPI.ExtensionContext): Promise<void> {
  // Implementation here
}

export function deactivate(): void {
  console.log('Extension deactivated');
}
```

### Provider Setup
- Create a basic provider with minimal configuration
```typescript
const provider = podmanDesktopAPI.provider.createProvider({
  name: 'Hello World',
  id: 'hello-world',
  status: 'ready',
  images: {
    icon: './resources/icon.png',
    logo: './resources/logo.png',
  },
});

context.subscriptions.push(provider);
```

### Command Implementation
- Register the hello world command
```typescript
const helloCommand = podmanDesktopAPI.commands.registerCommand('hello-world.showMessage', async () => {
  await podmanDesktopAPI.window.showInformationMessage('Hello World from Podman Desktop!');
});

context.subscriptions.push(helloCommand);
```

### Status Bar Integration
- Add a status bar item for quick access
```typescript
const statusBarItem = podmanDesktopAPI.window.createStatusBarItem(
  podmanDesktopAPI.StatusBarAlignLeft,
  100
);
statusBarItem.text = 'Hello World';
statusBarItem.command = 'hello-world.showMessage';
statusBarItem.show();

context.subscriptions.push(statusBarItem);
```

## Build Configuration

### TypeScript Configuration
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "esnext",
    "lib": ["ES2017"],
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "dist",
    "target": "esnext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "types/*.d.ts"]
}
```

### Vite Configuration
Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import { join } from 'path';
import { builtinModules } from 'module';

const PACKAGE_ROOT = __dirname;

export default defineConfig({
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: process.cwd(),
  resolve: {
    alias: {
      '/@/': join(PACKAGE_ROOT, 'src') + '/',
    },
  },
  build: {
    sourcemap: 'inline',
    target: 'esnext',
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE === 'production' ? 'esbuild' : false,
    lib: {
      entry: 'src/extension.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['@podman-desktop/api', ...builtinModules.flatMap(p => [p, `node:${p}`])],
      output: {
        entryFileNames: '[name].js',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
});
```

## Development Workflow

### Building the Extension
- Run the following commands:
```bash
# Install dependencies
npm install

# Build the extension
npm run build

# For development with auto-rebuild
npm run watch
```

### Testing in Podman Desktop
- Test the extension in Podman Desktop development environment:
```bash
# In Podman Desktop repo
npm run watch --extension-folder /path/to/your/extension
```

### Verification Steps
1. Check if extension appears in Extensions section
2. Verify the hello world notification appears on activation
3. Test the status bar item functionality
4. Ensure command can be triggered from command palette

## Packaging for Distribution

### Containerfile Setup
Create a Containerfile for packaging:
```dockerfile
FROM scratch

# Add extension files
COPY package.json ./
COPY dist ./dist
COPY resources ./resources

# Add metadata labels
LABEL org.opencontainers.image.title="Hello World Extension" \
      org.opencontainers.image.description="A simple hello world extension for Podman Desktop" \
      org.opencontainers.image.vendor="My Organization" \
      org.opencontainers.image.version="0.0.1"
```

### Build and Push
```bash
# Build the container image
podman build -t quay.io/myusername/hello-world-extension .

# Push to registry
podman push quay.io/myusername/hello-world-extension
```

## Best Practices

### Error Handling
- Implement proper error handling for commands
```typescript
const helloCommand = podmanDesktopAPI.commands.registerCommand('hello-world.showMessage', async () => {
  try {
    await podmanDesktopAPI.window.showInformationMessage('Hello World from Podman Desktop!');
  } catch (error) {
    console.error('Failed to show hello world message:', error);
    await podmanDesktopAPI.window.showErrorMessage('Failed to show hello world message');
  }
});
```

### Resource Cleanup
- Ensure all resources are properly disposed
```typescript
export function deactivate(): void {
  // Any specific cleanup if needed
  console.log('Hello World extension deactivated');
}
```

### Version Management
- Follow semantic versioning in package.json
- Update version numbers before publishing
```json
{
  "version": "0.0.1"
}
```
