import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils.js';
import { CreatePromptParams, PromptNotFoundError, PromptStore, StoredPrompt, UpdatePromptParams } from './prompt-store.js';
import type { Capability } from './server-options.js';

// Builds the MCP server for one install: the prompts it serves (a store, possibly a selection of
// the library) and the capabilities it exposes. No side effects, so both the stdio entry point and
// the HTTP /mcp endpoint use it.

export interface McpServerOptions {
  /** Prompts to serve. Default: the bundled library (or PROMPTS_DIR), all of it. */
  store?: PromptStore;
  /** MCP capabilities to expose. Default: tools only. */
  expose?: Capability[];
  /** Leave out add_prompt, update_prompt and delete_prompt. */
  readOnly?: boolean;
}

export const RESOURCE_SCHEME = 'prompts://';

/** Report the installed package version rather than a hard-coded one that drifts. */
export function packageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** "7 of 49 library prompts" when the store serves part of its library, otherwise undefined. */
export function selectionNote(store: PromptStore): string | undefined {
  const { totals } = store.catalog();
  const total = totals.prompts + totals.templates;
  const selected = totals.selectedPrompts + totals.selectedTemplates;
  return selected < total ? `${selected} of the ${total} library prompts` : undefined;
}

/**
 * Usage notes that MCP clients put in the model's context, so it knows how to use what this
 * install exposes without a separate skill.
 */
export function buildInstructions(options: {
  expose: Capability[];
  readOnly: boolean;
  selectionNote?: string;
}): string {
  const tools = options.expose.includes('tools');
  const prompts = options.expose.includes('prompts');
  const resources = options.expose.includes('resources');
  const lines: string[] = [];

  if (tools && !prompts && !resources) {
    lines.push('Prompt library. This server exposes tools only (no MCP prompts capability), so prompts are not slash commands.');
  } else {
    lines.push(`Prompt library. This server exposes MCP ${options.expose.join(', ')}.`);
  }
  if (prompts) {
    lines.push('Each prompt is also an MCP prompt named by its id (a slash command in clients that support them). A template\'s arguments are its variables; getting the prompt fills them in, and any left out stay as literal {{name}}.');
  }
  if (resources) {
    lines.push(`Each prompt is also a resource at ${RESOURCE_SCHEME}<id> holding its raw content, for attaching as context.`);
  }
  if (options.selectionNote) {
    lines.push(`This install serves ${options.selectionNote}; prompts outside that selection are not available here.`);
  }
  if (tools) {
    lines.push(
      '',
      'Using a template:',
      '1. list_prompts with the most specific tag you know. Tags match any of the ones given, so a broad tag also returns unrelated prompts.',
      '2. get_prompt with the id. The result is JSON; its `variables` array names every value the template needs.',
      '3. apply_template with the id and a value for every variable. Plain {{name}} replacement: a variable you leave out stays as a literal {{name}}.',
      '4. Check the result contains no leftover {{ before you use it.',
    );
  }
  if (options.readOnly) {
    lines.push('', 'Read-only: this install has no add_prompt, update_prompt or delete_prompt.');
  } else if (tools) {
    lines.push('', 'Persistence: add_prompt and update_prompt change memory only. They are lost when the server restarts, and add_prompt assigns a random id. A prompt that must last is a JSON file under data/prompts/ with a stable id, added by pull request.');
  }
  return lines.join('\n');
}

function variableNames(prompt: StoredPrompt): Array<{ name: string; description?: string }> {
  return (prompt.variables ?? []).map(variable =>
    typeof variable === 'string' ? { name: variable } : { name: variable.name, description: variable.description }
  );
}

function notFound(error: unknown): never {
  if (error instanceof PromptNotFoundError) throw new McpError(ErrorCode.InvalidParams, error.message);
  throw error;
}

export async function createMcpServer(options: McpServerOptions = {}): Promise<McpServer> {
  const expose = options.expose ?? ['tools'];
  const readOnly = options.readOnly ?? false;
  let store = options.store;
  if (!store) {
    store = new PromptStore();
    store.loadDefault();
  }
  const prompts: PromptStore = store;

  const server = new McpServer(
    { name: 'mcp-prompts', version: packageVersion() },
    { instructions: buildInstructions({ expose, readOnly, selectionNote: selectionNote(prompts) }) }
  );

  // Clients that list prompts or resources hear about changes made through the tools.
  const notifyListChanged = () => {
    if (!server.isConnected()) return;
    if (expose.includes('prompts')) server.server.sendPromptListChanged().catch(() => undefined);
    if (expose.includes('resources')) server.server.sendResourceListChanged().catch(() => undefined);
  };

  if (expose.includes('tools')) registerTools(server, prompts, readOnly, notifyListChanged);
  if (expose.includes('prompts')) registerPrompts(server, prompts);
  if (expose.includes('resources')) registerResources(server, prompts);

  return server;
}

function registerTools(server: McpServer, store: PromptStore, readOnly: boolean, changed: () => void): void {
  // Each handler validates its own arguments with zod, so the SDK's generic overloads add nothing
  // here except type instantiation too deep for tsc (TS2589) on these schemas.
  const registerTool = server.tool.bind(server) as (...args: unknown[]) => void;

  if (!readOnly) {
    registerTool(
      'add_prompt',
      'Add a new prompt. Set isTemplate and variables to make it a template that apply_template can fill.',
      CreatePromptParams.shape,
      async (params: unknown) => {
        try {
          const prompt = store.add(CreatePromptParams.parse(params));
          changed();
          return { content: [{ type: 'text', text: `Prompt "${prompt.name}" added successfully with ID: ${prompt.id}` }] };
        } catch (error) {
          logger.error('Error adding prompt:', error);
          throw new Error(`Failed to add prompt: ${error}`);
        }
      }
    );
  }

  registerTool(
    'get_prompt',
    'Get a prompt by its ID.',
    { id: z.string().describe('Prompt ID, as returned by list_prompts') },
    async (params: unknown) => {
      try {
        const { id } = z.object({ id: z.string() }).parse(params);
        return { content: [{ type: 'text', text: JSON.stringify(store.get(id), null, 2) }] };
      } catch (error) {
        logger.error('Error getting prompt:', error);
        throw new Error(`Failed to get prompt: ${error}`);
      }
    }
  );

  registerTool(
    'list_prompts',
    'List prompts, optionally filtered by tags (any match) or a search term.',
    {
      tags: z.array(z.string()).optional().describe('Return prompts carrying any of these tags'),
      search: z.string().optional().describe('Text to look for in the name, description or content')
    },
    async (params: unknown) => {
      try {
        const validatedParams = z.object({
          tags: z.array(z.string()).optional(),
          search: z.string().optional()
        }).optional().parse(params);
        const summaryList = store.list({ tags: validatedParams?.tags, search: validatedParams?.search });
        return {
          content: [{
            type: 'text',
            text: `Found ${summaryList.length} prompts:\n\n${summaryList.map(p =>
              `- **${p.name}** (${p.id}): ${p.description} [${p.tags.join(', ')}]`
            ).join('\n')}`
          }]
        };
      } catch (error) {
        logger.error('Error listing prompts:', error);
        throw new Error(`Failed to list prompts: ${error}`);
      }
    }
  );

  if (!readOnly) {
    registerTool(
      'update_prompt',
      'Update fields of an existing prompt; its version is incremented.',
      { id: z.string().describe('Prompt ID'), updates: UpdatePromptParams },
      async (params: unknown) => {
        try {
          const { id, updates } = z.object({ id: z.string(), updates: UpdatePromptParams }).parse(params);
          const updatedPrompt = store.update(id, updates);
          changed();
          return { content: [{ type: 'text', text: `Prompt "${updatedPrompt.name}" updated successfully` }] };
        } catch (error) {
          logger.error('Error updating prompt:', error);
          throw new Error(`Failed to update prompt: ${error}`);
        }
      }
    );

    registerTool(
      'delete_prompt',
      'Delete a prompt by its ID.',
      { id: z.string().describe('Prompt ID') },
      async (params: unknown) => {
        try {
          const { id } = z.object({ id: z.string() }).parse(params);
          const prompt = store.delete(id);
          changed();
          return { content: [{ type: 'text', text: `Prompt "${prompt.name}" deleted successfully` }] };
        } catch (error) {
          logger.error('Error deleting prompt:', error);
          throw new Error(`Failed to delete prompt: ${error}`);
        }
      }
    );
  }

  registerTool(
    'apply_template',
    'Fill a template prompt\'s {{variables}} and return the resulting text.',
    {
      id: z.string().describe('ID of a template prompt'),
      variables: z.record(z.string(), z.any()).describe('Values for the template variables, by name')
    },
    async (params: unknown) => {
      try {
        const { id, variables } = z.object({
          id: z.string(),
          variables: z.record(z.string(), z.any())
        }).parse(params);
        return { content: [{ type: 'text', text: store.applyTemplate(id, variables) }] };
      } catch (error) {
        logger.error('Error applying template:', error);
        throw new Error(`Failed to apply template: ${error}`);
      }
    }
  );

  registerTool(
    'get_stats',
    'Counts of prompts and templates, with the tags and categories in use.',
    async () => {
      try {
        return { content: [{ type: 'text', text: JSON.stringify(store.stats(), null, 2) }] };
      } catch (error) {
        logger.error('Error getting stats:', error);
        throw new Error(`Failed to get stats: ${error}`);
      }
    }
  );
}

// Prompts and resources are served by handlers that read the store on every request, so prompts
// added or removed through the tools show up without re-registering anything.

function registerPrompts(server: McpServer, store: PromptStore): void {
  server.server.registerCapabilities({ prompts: { listChanged: true } });

  server.server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: store.all().map(prompt => ({
      name: prompt.id,
      title: prompt.name,
      ...(prompt.description ? { description: prompt.description } : {}),
      ...(prompt.isTemplate
        ? { arguments: variableNames(prompt).map(variable => ({ ...variable, required: false })) }
        : {}),
    })),
  }));

  server.server.setRequestHandler(GetPromptRequestSchema, request => {
    let prompt: StoredPrompt;
    try {
      prompt = store.get(request.params.name);
    } catch (error) {
      notFound(error);
    }
    const text = prompt.isTemplate ? store.applyTemplate(prompt.id, request.params.arguments ?? {}) : prompt.content;
    return {
      ...(prompt.description ? { description: prompt.description } : {}),
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
    };
  });
}

function registerResources(server: McpServer, store: PromptStore): void {
  server.server.registerCapabilities({ resources: { listChanged: true } });

  const uriOf = (id: string) => `${RESOURCE_SCHEME}${encodeURIComponent(id)}`;

  server.server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: store.all().map(prompt => ({
      uri: uriOf(prompt.id),
      name: prompt.id,
      title: prompt.name,
      ...(prompt.description ? { description: prompt.description } : {}),
      mimeType: 'text/plain',
    })),
  }));

  server.server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({
    resourceTemplates: [{
      uriTemplate: `${RESOURCE_SCHEME}{id}`,
      name: 'prompt',
      title: 'Prompt by id',
      description: 'The raw content of the prompt with this id',
      mimeType: 'text/plain',
    }],
  }));

  server.server.setRequestHandler(ReadResourceRequestSchema, request => {
    const { uri } = request.params;
    if (!uri.startsWith(RESOURCE_SCHEME)) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown resource ${uri}: expected ${RESOURCE_SCHEME}<id>`);
    }
    let prompt: StoredPrompt;
    try {
      prompt = store.get(decodeURIComponent(uri.slice(RESOURCE_SCHEME.length)));
    } catch (error) {
      notFound(error);
    }
    return { contents: [{ uri, mimeType: 'text/plain', text: prompt.content }] };
  });
}
