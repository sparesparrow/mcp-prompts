import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
  type ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils.js';
import {
  CreatePromptParams,
  PromptConflictError,
  PromptNotFoundError,
  PromptStorageError,
  PromptStore,
  PromptUsageError,
  StoredPrompt,
  UpdatePromptParams,
} from './prompt-store.js';
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
  /** The profiles the store was narrowed to, named in the usage instructions. */
  profiles?: string[];
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

/**
 * "7 of the 49 library prompts (profile software-dev)" when the store serves part of its library,
 * otherwise undefined.
 */
export function selectionNote(store: PromptStore, profiles: string[] = []): string | undefined {
  const { totals } = store.catalog();
  const total = totals.prompts + totals.templates;
  const selected = totals.selectedPrompts + totals.selectedTemplates;
  if (selected >= total) return undefined;
  const named = profiles.length > 0 ? ` (profile ${profiles.join(', ')})` : '';
  return `${selected} of the ${total} library prompts${named}`;
}

/**
 * Usage notes that MCP clients put in the model's context, so it knows how to use what this
 * install exposes without a separate skill.
 */
export function buildInstructions(options: {
  expose: Capability[];
  readOnly: boolean;
  selectionNote?: string;
  /** Changes are saved to a state directory and survive a restart. */
  persistent?: boolean;
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
      '1. list_prompts with the most specific tag you know. Tags match any of the ones given, so a broad tag also returns unrelated prompts. It returns up to `limit` prompts (default 50); when has_more is true, call it again with offset set to next_offset.',
      '2. get_prompt with the id. The result is JSON; its `variables` array names every value the template needs.',
      '3. apply_template with the id and a value for every variable. Plain {{name}} replacement: a variable you leave out stays as a literal {{name}}.',
      '4. apply_template names the variables it could not fill (`missing`); use the text only when that list is empty.',
    );
  }
  if (options.readOnly) {
    lines.push('', 'Read-only: this install has no add_prompt, update_prompt or delete_prompt.');
  } else if (tools) {
    lines.push('', options.persistent
      ? 'Persistence: add_prompt, update_prompt and delete_prompt are saved to this server\'s state directory and survive a restart. Give add_prompt an `id` to choose a stable one; otherwise it assigns a random id.'
      : 'Persistence: add_prompt, update_prompt and delete_prompt change memory only and are lost when the server restarts. Give add_prompt an `id` to choose a stable one; otherwise it assigns a random id. A prompt that must last is a JSON file under data/prompts/ with a stable id, added by pull request.');
  }
  return lines.join('\n');
}

function variableNames(prompt: StoredPrompt): Array<{ name: string; description?: string }> {
  return (prompt.variables ?? []).map(variable =>
    typeof variable === 'string' ? { name: variable } : { name: variable.name, description: variable.description }
  );
}

/** The code the MCP specification gives a resources/read for a resource that does not exist. */
export const RESOURCE_NOT_FOUND = -32002;

/**
 * A JSON-RPC error for a prompts/get or resources/read request. The SDK sends an error's code and
 * message as they are; its own McpError puts "MCP error <code>:" in the message, which the client
 * then adds a second time.
 */
function rpcError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function getOrRpcError(store: PromptStore, id: string, code: number): StoredPrompt {
  try {
    return store.get(id);
  } catch (error) {
    if (error instanceof PromptNotFoundError) throw rpcError(code, error.message);
    throw error;
  }
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
    { instructions: buildInstructions({ expose, readOnly, selectionNote: selectionNote(prompts, options.profiles), persistent: Boolean(prompts.stateDir) }) }
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

// What the tools return as structuredContent. Clients check results against these, so they
// describe exactly what the handlers produce; the prompt schema is loose because library files
// carry keys of their own (lang, status, agentConfig).
const VersionSchema = z.union([z.number(), z.string()]);
const SummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  isTemplate: z.boolean(),
  category: z.string().optional(),
  createdAt: z.string(),
  version: VersionSchema,
});
const PageSchema = z.object({
  total: z.number().int().describe('Prompts matching the filter'),
  count: z.number().int().describe('Prompts in this page'),
  offset: z.number().int(),
  limit: z.number().int(),
  has_more: z.boolean(),
  next_offset: z.number().int().optional().describe('Offset of the next page; present when has_more is true'),
  prompts: z.array(SummarySchema),
});
const PromptOutputSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
  isTemplate: z.boolean(),
  tags: z.array(z.string()),
  category: z.string().optional(),
  variables: z.array(z.union([z.string(), z.looseObject({ name: z.string() })])).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  version: VersionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
const ChangeSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: VersionSchema,
  persisted: z.boolean().describe('True when the change was saved to the state directory, false when it is in memory only'),
});
const RenderSchema = z.object({
  id: z.string(),
  text: z.string().describe('The template with the given values filled in'),
  missing: z.array(z.string()).describe('Placeholders left in the text because no value was given'),
  unused: z.array(z.string()).describe('Values given that the template does not use'),
});
const StatsSchema = z.object({
  total: z.number().int(),
  templates: z.number().int(),
  regular: z.number().int(),
  tags: z.array(z.string()),
  categories: z.array(z.string()),
  storage: z.enum(['memory', 'file']),
});

const ListPromptsInput = z.strictObject({
  tags: z.array(z.string()).optional().describe('Return prompts carrying any of these tags'),
  search: z.string().optional().describe('Text to look for in the name, description or content (case-insensitive)'),
  category: z.string().optional().describe('Return prompts of this category, e.g. "embedded" (get_stats lists the categories)'),
  isTemplate: z.boolean().optional().describe('true for templates only, false for plain prompts only'),
  limit: z.number().int().min(1).max(100).default(50).describe('Most prompts to return (1-100, default 50)'),
  offset: z.number().int().min(0).default(0).describe('Prompts to skip; use next_offset from the previous page'),
});
const IdInput = z.strictObject({ id: z.string().min(1).describe('Prompt ID, as returned by list_prompts') });
const AddPromptInput = z.strictObject(CreatePromptParams.shape);
const UpdatePromptInput = z.strictObject({
  id: z.string().min(1).describe('Prompt ID'),
  updates: z.strictObject(UpdatePromptParams.shape).describe('The fields to change; fields left out keep their value'),
});
const ApplyTemplateInput = z.strictObject({
  id: z.string().min(1).describe('ID of a template prompt'),
  variables: z.record(z.string(), z.any()).default({}).describe('Values for the template variables, by name, e.g. {"module": "app"}'),
});
const NoInput = z.strictObject({});

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

interface ToolConfig {
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  annotations: ToolAnnotations;
}

const MAX_LISTED_DESCRIPTION = 200;

function text(value: string): CallToolResult['content'][number] {
  return { type: 'text', text: value };
}

/** A tool result: text for the model to read, and the same facts as structured content. */
function result(content: CallToolResult['content'], structured: object): CallToolResult {
  return { content, structuredContent: structured as Record<string, unknown> };
}

/** What went wrong, said so the caller can fix it; internals stay in the log. */
function describeFailure(action: string, error: unknown): string {
  if (error instanceof PromptNotFoundError) return `${error.message}. Call list_prompts to see the ids this server serves.`;
  if (error instanceof PromptConflictError) return `${error.message}. Choose another id, or change the existing prompt with update_prompt.`;
  if (error instanceof PromptUsageError || error instanceof PromptStorageError) return error.message;
  if (error instanceof ZodError) {
    return `Invalid arguments: ${error.issues.map(issue => `${issue.path.join('.') || 'arguments'}: ${issue.message}`).join('; ')}`;
  }
  logger.error({ err: error }, `Unexpected error while ${action}`);
  return `Internal error while ${action}; the server log has the details.`;
}

function registerTools(server: McpServer, store: PromptStore, readOnly: boolean, changed: () => void): void {
  // The SDK's generic registerTool overloads make tsc give up on these schemas (TS2589, type
  // instantiation too deep). The SDK still validates arguments against inputSchema before a
  // handler runs and results against outputSchema after, so the handlers take the parsed type.
  const register = server.registerTool.bind(server) as unknown as (
    name: string,
    config: ToolConfig,
    handler: (args: never) => CallToolResult
  ) => unknown;

  const tool = <Schema extends z.ZodType>(
    name: string,
    config: Omit<ToolConfig, 'inputSchema'> & { inputSchema: Schema },
    action: string,
    run: (args: z.output<Schema>) => CallToolResult
  ) => {
    register(name, config, ((args: z.output<Schema>) => {
      try {
        return run(args);
      } catch (error) {
        return { isError: true, content: [text(describeFailure(action, error))] };
      }
    }) as (args: never) => CallToolResult);
  };

  const persisted = () => Boolean(store.stateDir);
  const storageNote = () => persisted()
    ? 'Saved to the state directory; it survives a restart.'
    : 'Kept in memory only; it is lost when the server restarts.';
  const change = (prompt: StoredPrompt) => ({ id: prompt.id, name: prompt.name, version: prompt.version, persisted: persisted() });

  tool('list_prompts', {
    title: 'List prompts',
    description:
      'List the prompts this server serves, as summaries (id, name, description, tags, isTemplate, category, version). ' +
      'Filter with tags (any match), category, isTemplate and search (name, description and content). ' +
      'Returns up to `limit` prompts starting at `offset`; when has_more is true, call again with offset = next_offset. ' +
      'Use get_prompt for the content of one prompt.',
    inputSchema: ListPromptsInput,
    outputSchema: PageSchema,
    annotations: READ_ONLY,
  }, 'listing prompts', ({ limit, offset, ...filter }) => {
    const page = store.page(filter, { limit, offset });
    const range = page.count === 0
      ? (page.total > 0 ? `, none at offset ${page.offset}` : '')
      : page.count < page.total ? `, showing ${page.offset + 1}-${page.offset + page.count}` : '';
    const lines = page.prompts.map(p => {
      const description = p.description.length > MAX_LISTED_DESCRIPTION
        ? `${p.description.slice(0, MAX_LISTED_DESCRIPTION - 1)}…`
        : p.description;
      return `- **${p.name}** (${p.id}): ${description} [${p.tags.join(', ')}]${p.isTemplate ? ' (template)' : ''}`;
    });
    const more = page.has_more ? `\n\nMore: call list_prompts again with offset=${page.next_offset}.` : '';
    return result([text(`Found ${page.total} prompts${range}:\n\n${lines.join('\n')}${more}`)], page);
  });

  tool('get_prompt', {
    title: 'Get a prompt',
    description:
      'Get one prompt by id, as JSON: its content, description, tags, and for a template the `variables` it needs. ' +
      'Fails with an error naming the id when no such prompt is served.',
    inputSchema: IdInput,
    outputSchema: PromptOutputSchema,
    annotations: READ_ONLY,
  }, 'getting the prompt', ({ id }) => {
    const prompt = store.get(id);
    return result([text(JSON.stringify(prompt, null, 2))], prompt);
  });

  tool('apply_template', {
    title: 'Fill a template',
    description:
      'Fill a template prompt\'s {{variables}} and return the resulting text. Only prompts with isTemplate true can be applied. ' +
      'A placeholder with no value stays in the text as written and is named in `missing`; a value the template does not use is named in `unused`. ' +
      '{{name^}} inserts the value with its first letter upper-cased.',
    inputSchema: ApplyTemplateInput,
    outputSchema: RenderSchema,
    annotations: READ_ONLY,
  }, 'applying the template', ({ id, variables }) => {
    const rendered = store.render(id, variables);
    const notes: string[] = [];
    if (rendered.missing.length > 0) {
      const shown = rendered.missing.slice(0, 10).map(name => `{{${name}}}`).join(', ');
      const rest = rendered.missing.length > 10 ? ` and ${rendered.missing.length - 10} more` : '';
      notes.push(`Not filled: ${shown}${rest}. Call apply_template again with a value for each; get_prompt lists the template's variables.`);
    }
    if (rendered.unused.length > 0) {
      notes.push(`Not used by this template: ${rendered.unused.join(', ')} (check the spelling against get_prompt's variables).`);
    }
    // The filled text stays a block of its own so it can be used as it is.
    return result(
      [text(rendered.text), ...(notes.length > 0 ? [text(`[mcp-prompts] ${notes.join(' ')}`)] : [])],
      { id, ...rendered }
    );
  });

  tool('get_stats', {
    title: 'Library statistics',
    description: 'Counts of prompts and templates, the tags and categories in use, and whether changes are saved to disk (`storage`).',
    inputSchema: NoInput,
    outputSchema: StatsSchema,
    annotations: READ_ONLY,
  }, 'getting the statistics', () => {
    const stats = store.stats();
    return result([text(JSON.stringify(stats, null, 2))], stats);
  });

  if (readOnly) return;

  tool('add_prompt', {
    title: 'Add a prompt',
    description:
      'Add a new prompt. Set isTemplate and variables to make it a template that apply_template can fill. ' +
      'Give `id` to choose a stable id (it fails if the id is taken); otherwise a random one is assigned. ' +
      'The result says whether the prompt was saved to disk or is kept in memory only.',
    inputSchema: AddPromptInput,
    outputSchema: ChangeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, 'adding the prompt', params => {
    const prompt = store.add(params);
    changed();
    return result([text(`Prompt "${prompt.name}" added successfully with ID: ${prompt.id}\n${storageNote()}`)], change(prompt));
  });

  tool('update_prompt', {
    title: 'Update a prompt',
    description:
      'Change fields of an existing prompt; fields left out of `updates` keep their value, and the version goes up. ' +
      'Replaces the previous values, which are not kept.',
    inputSchema: UpdatePromptInput,
    outputSchema: ChangeSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, 'updating the prompt', ({ id, updates }) => {
    const prompt = store.update(id, updates);
    changed();
    return result([text(`Prompt "${prompt.name}" updated successfully (version ${prompt.version})\n${storageNote()}`)], change(prompt));
  });

  tool('delete_prompt', {
    title: 'Delete a prompt',
    description: 'Delete a prompt by its id. This cannot be undone through the tools.',
    inputSchema: IdInput,
    outputSchema: ChangeSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, 'deleting the prompt', ({ id }) => {
    const prompt = store.delete(id);
    changed();
    const note = persisted()
      ? 'The deletion is saved; it stays deleted after a restart.'
      : 'Deleted from memory only; a prompt from the library comes back when the server restarts.';
    return result([text(`Prompt "${prompt.name}" deleted successfully\n${note}`)], change(prompt));
  });
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
    const prompt = getOrRpcError(store, request.params.name, ErrorCode.InvalidParams);
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
      throw rpcError(ErrorCode.InvalidParams, `Unknown resource ${uri}: expected ${RESOURCE_SCHEME}<id>`);
    }
    let id: string;
    try {
      id = decodeURIComponent(uri.slice(RESOURCE_SCHEME.length));
    } catch {
      // A stray % is the caller's mistake; it used to be reported as an internal error.
      throw rpcError(ErrorCode.InvalidParams, `Malformed resource URI ${uri}: the id after ${RESOURCE_SCHEME} is not valid percent-encoding`);
    }
    const prompt = getOrRpcError(store, id, RESOURCE_NOT_FOUND);
    return { contents: [{ uri, mimeType: 'text/plain', text: prompt.content }] };
  });
}
