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

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { cwd } from 'process';
import Ajv from 'ajv';

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
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    content: { type: 'string', minLength: 1 },
    isTemplate: { type: 'boolean', nullable: true },
    variables: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      uniqueItems: true,
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      uniqueItems: true,
    },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
    version: { type: 'integer', minimum: 0, nullable: true },
    metadata: { type: 'object', nullable: true, additionalProperties: true },
    examples: { type: 'array', nullable: true, items: {} },
  },
  required: ['id', 'name', 'description', 'content'],
  additionalProperties: true,
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

async function validateFile(filePath: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const json: unknown = JSON.parse(raw);

    const ok = validate(json);
    if (!ok) {
      console.error(`✗ ${filePath} is invalid:`);
      console.error(validate.errors);
      return false;
    }

    // Extra: ensure variables referenced in content exist
    if (typeof json === 'object' && json && 'content' in json) {
      const matches = (json as any).content.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) as string[] | null;
      const tplVars: string[] = (matches ? Array.from(matches) : []).map(v => v.replace(/{{\s*|\s*}}/g, ''));
      const declared: string[] = (json as any).variables || [];
      const missing = tplVars.filter(v => !declared.includes(v));
      if (missing.length) {
        console.warn(`⚠️  ${filePath}: nedefinované variables ${missing.join(', ')}`);
      }
    }

    console.log(`✓ ${filePath}`);
    return true;
  } catch (err) {
    console.error(`✗ Error parsing ${filePath}:`, err);
    return false;
  }
}

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

async function main() {
  const baseDir = process.argv[2] || path.resolve(cwd());
  const targetDirs = [
    path.join(baseDir, 'prompts'),
    path.join(baseDir, 'fixed_prompts'),
    path.join(baseDir, 'data', 'prompts'),
  ];

  let success = true;
  for (const dir of targetDirs) {
    const exists = await fs
      .access(dir)
      .then(() => true)
      .catch(() => false);
    if (!exists) continue;
    const ok = await walk(dir, validateFile);
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