import { spawn } from 'child_process';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ServerConfig {
    name: string;
    version: string;
    image?: string;
    containerfile?: string;
    transport: 'stdio' | 'sse';
    env?: Record<string, string>;
    sseUrl?: string;
}

interface ConnectedServer {
    config: ServerConfig;
    client: Client;
    transport: StdioClientTransport | SSEClientTransport;
    containerId?: string;
}

export class DesktopMCPClient {
    private servers: Map<string, ConnectedServer> = new Map();
    private configPath: string;
    private containerDir: string;

    constructor(configPath: string, containerDir: string) {
        this.configPath = configPath;
        this.containerDir = containerDir;
    }

    async initialize() {
        // Ensure container directory exists
        await fs.mkdir(this.containerDir, { recursive: true });

        // Load configuration
        const config = await this.loadConfig();
        
        // Start all configured servers
        for (const [name, serverConfig] of Object.entries(config)) {
            await this.startServer(name, serverConfig);
        }
    }

    private async loadConfig(): Promise<Record<string, ServerConfig>> {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf-8');
            return JSON.parse(configContent);
        } catch (error) {
            console.error('Error loading config:', error);
            return {};
        }
    }

    private async startServer(name: string, config: ServerConfig): Promise<void> {
        try {
            // Prepare container if needed
            let containerId: string | undefined;
            if (config.image || config.containerfile) {
                containerId = await this.prepareContainer(name, config);
            }

            // Create client
            const client = new Client({
                name: 'desktop-client',
                version: '1.0.0'
            }, {
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {}
                }
            });

            // Create appropriate transport
            let transport: StdioClientTransport | SSEClientTransport;
            
            if (config.transport === 'sse' && config.sseUrl) {
                const clientId = uuidv4();
                transport = new SSEClientTransport(
                    new URL(`${config.sseUrl}?clientId=${clientId}`)
                );
            } else {
                // Default to stdio with container
                if (!containerId) {
                    throw new Error('Container ID required for stdio transport');
                }
                
                transport = new StdioClientTransport({
                    command: 'podman',
                    args: ['attach', containerId],
                    env: config.env
                });
            }

            // Connect client
            await client.connect(transport);

            // Store connected server
            this.servers.set(name, {
                config,
                client,
                transport,
                containerId
            });

            console.log(`Server ${name} started successfully`);
        } catch (error) {
            console.error(`Error starting server ${name}:`, error);
            throw error;
        }
    }

    private async prepareContainer(name: string, config: ServerConfig): Promise<string> {
        const containerName = `mcp-${name}-${uuidv4()}`;

        try {
            if (config.image) {
                // Pull image if not exists
                await this.runPodman(['pull', config.image]);
                
                // Create container
                const containerId = await this.runPodman([
                    'create',
                    '--name', containerName,
                    '-i',  // Interactive mode
                    '--rm',  // Remove container when stopped
                    ...(config.env ? this.envToArgs(config.env) : []),
                    config.image
                ]);

                // Start container
                await this.runPodman(['start', containerId]);
                
                return containerId;
            } else if (config.containerfile) {
                // Copy Containerfile to build context
                const contextDir = path.join(this.containerDir, containerName);
                await fs.mkdir(contextDir, { recursive: true });
                await fs.copyFile(config.containerfile, path.join(contextDir, 'Containerfile'));

                // Build image
                await this.runPodman([
                    'build',
                    '-t', containerName,
                    contextDir
                ]);

                // Create and start container
                const containerId = await this.runPodman([
                    'create',
                    '--name', containerName,
                    '-i',
                    '--rm',
                    ...(config.env ? this.envToArgs(config.env) : []),
                    containerName
                ]);

                await this.runPodman(['start', containerId]);
                
                return containerId;
            } else {
                throw new Error('Either image or containerfile must be specified');
            }
        } catch (error) {
            console.error(`Error preparing container for ${name}:`, error);
            throw error;
        }
    }

    private async runPodman(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const process = spawn('podman', args);
            let output = '';
            let error = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                error += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Podman command failed: ${error}`));
                }
            });
        });
    }

    private envToArgs(env: Record<string, string>): string[] {
        return Object.entries(env).flatMap(([key, value]) => [
            '-e', `${key}=${value}`
        ]);
    }

    async stopServer(name: string): Promise<void> {
        const server = this.servers.get(name);
        if (!server) {
            throw new Error(`Server ${name} not found`);
        }

        try {
            // Disconnect client
            await server.transport.close();

            // Stop container if exists
            if (server.containerId) {
                await this.runPodman(['stop', server.containerId]);
            }

            this.servers.delete(name);
            console.log(`Server ${name} stopped successfully`);
        } catch (error) {
            console.error(`Error stopping server ${name}:`, error);
            throw error;
        }
    }

    async stopAll(): Promise<void> {
        const serverNames = Array.from(this.servers.keys());
        await Promise.all(serverNames.map(name => this.stopServer(name)));
    }

    getServer(name: string): ConnectedServer | undefined {
        return this.servers.get(name);
    }

    async listAvailableTools(): Promise<Record<string, any>> {
        const tools: Record<string, any> = {};
        
        for (const [name, server] of this.servers) {
            try {
                const response = await server.client.request(
                    { method: "tools/list" },
                    { tools: [] }
                );
                tools[name] = response.tools;
            } catch (error) {
                console.error(`Error listing tools for ${name}:`, error);
            }
        }

        return tools;
    }
}

// Example configuration file (mcp_config.json):
/*
{
    "supervisor": {
        "name": "supervisor",
        "version": "1.0.0",
        "transport": "sse",
        "sseUrl": "http://localhost:3000/mcp/sse"
    },
    "file-server": {
        "name": "file-server",
        "version": "1.0.0",
        "image": "ghcr.io/modelcontextprotocol/server-filesystem:latest",
        "transport": "stdio",
        "env": {
            "ROOT_DIR": "/data"
        }
    },
    "custom-server": {
        "name": "custom-server",
        "version": "1.0.0",
        "containerfile": "./Containerfile",
        "transport": "stdio"
    }
}
*/

// Example usage:
const client = new DesktopMCPClient(
    '/path/to/mcp_config.json',
    '/path/to/container/storage'
);

await client.initialize();

// Get tools from all servers
const tools = await client.listAvailableTools();
console.log('Available tools:', tools);

// Use a specific server
const supervisor = client.getServer('supervisor');
if (supervisor) {
    const result = await supervisor.client.request(
        {
            method: "tools/call",
            params: {
                name: "evaluate-action",
                arguments: {
                    action: "list files",
                    intent: "View directory contents",
                    reasoningChain: [
                        "goal: understand current directory structure",
                        "because need to locate specific files",
                        "action: list directory contents"
                    ],
                    riskLevel: "low"
                }
            }
        },
        { content: [] }
    );
    console.log('Supervisor evaluation:', result);
}

// Clean up
await client.stopAll();