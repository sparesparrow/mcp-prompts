#!/usr/bin/env node

/**
 * Prompt Templates Validation Script (MCP-Prompts)
 * ------------------------------------------------
 * Ověří, že všechny JSON soubory ve složkách `prompts`, `fixed_prompts` a `data/prompts`
 * odpovídají minimálnímu schématu šablony.
 *
 * Použití:
 *   npm run validate:prompts [cesta_ke_kořenovému_adresáři]
 */

import Ajv from 'ajv';
import fs from 'fs/promises';
import path from 'path';
import { cwd } from 'process';
import { fileURLToPath } from 'url';

import { FileAdapter } from '../adapters.js';
import { PromptService } from '../prompt-service.js';

// resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  isTemplate?: boolean;
  variables?: string[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  metadata?: Record<string, unknown>;
  examples?: unknown[];
}

// JSON schema definition (minimal)
const schema: Record<string, unknown> = {
  additionalProperties: true,
  properties: {
    content: { minLength: 1, type: 'string' },
    createdAt: { format: 'date-time', nullable: true, type: 'string' },
    description: { minLength: 1, type: 'string' },
    examples: { items: {}, nullable: true, type: 'array' },
    id: { minLength: 1, type: 'string' },
    isTemplate: { nullable: true, type: 'boolean' },
    metadata: { additionalProperties: true, nullable: true, type: 'object' },
    name: { minLength: 1, type: 'string' },
    tags: {
      items: { type: 'string' },
      nullable: true,
      type: 'array',
      uniqueItems: true,
    },
    updatedAt: { format: 'date-time', nullable: true, type: 'string' },
    variables: {
      items: { type: 'string' },
      nullable: true,
      type: 'array',
      uniqueItems: true,
    },
    version: { minimum: 0, nullable: true, type: 'integer' },
  },
  required: ['id', 'name', 'description', 'content'],
  type: 'object',
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

/**
 *
 * @param filePath
 * @param promptService
 */
async function validateFile(filePath: string, promptService: PromptService): Promise<boolean> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const json: unknown = JSON.parse(raw);
    // Use PromptService validation
    await promptService['validatePrompt'](json as any, false);
    console.log(`✓ ${filePath}`);
    return true;
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'details' in err) {
      console.error(`✗ ${filePath} is invalid:`, err.details || err);
    } else if (err instanceof Error) {
      console.error(`✗ ${filePath} is invalid:`, err.message);
    } else {
      console.error(`✗ ${filePath} is invalid:`, err);
    }
    return false;
  }
}

/**
 *
 * @param dir
 * @param cb
 */
async function walk(dir: string, cb: (file: string) => Promise<boolean>): Promise<boolean> {
  let allOk = true;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const ok = await walk(full, cb);
      if (!ok) allOk = false;
    } else if (entry.name.endsWith('.json')) {
      const ok = await cb(full);
      if (!ok) allOk = false;
    }
  }
  return allOk;
}

/**
 *
 */
async function main() {
  const baseDir = process.argv[2] || path.resolve(cwd());
  const targetDirs = [
    path.join(baseDir, 'prompts'),
    path.join(baseDir, 'fixed_prompts'),
    path.join(baseDir, 'data', 'prompts'),
  ];
  // Use FileAdapter with string path
  const fileAdapter = new FileAdapter('./prompts');
  const promptService = new PromptService(fileAdapter);
  let success = true;
  for (const dir of targetDirs) {
    const exists = await fs
      .access(dir)
      .then(() => true)
      .catch(() => false);
    if (!exists) continue;
    const ok = await walk(dir, file => validateFile(file, promptService));
    if (!ok) success = false;
  }
  if (!success) {
    console.error('Some prompt files are invalid');
    process.exit(1);
  } else {
    console.log('All prompt templates are valid ✔️');
  }
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});
