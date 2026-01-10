#!/usr/bin/env node
/**
 * Import VoltAgent subagents from awesome-claude-code-subagents repository
 *
 * Usage:
 *   npx tsx scripts/import-voltAgent-subagents.ts [--dry-run] [--output-dir=./data/prompts/subagents]
 */

import fs from 'fs';
import path from 'path';

// Configuration
const VOLTACENT_REPO = '/home/sparrow/projects/mcp/awesome-claude-code-subagents';
const OUTPUT_DIR = './data/prompts/subagents';

interface SubagentFrontmatter {
  name: string;
  description: string;
  tools: string;
  model?: string;
  tags?: string;
}

interface SubagentJSON {
  id: string;
  type: 'subagent_registry';
  name: string;
  description: string;
  category: string;
  tags: string[];
  model: 'claude-opus' | 'claude-sonnet' | 'claude-haiku';
  system_prompt: string;
  tools: string[];
  mcp_servers?: string[];
  version: string;
  author: string;
  source_url: string;
  compatible_with?: string[];
  created_at: string;
  updated_at: string;
}

// Category mapping from directory structure
const CATEGORY_MAPPING: Record<string, string> = {
  '01-core-development': 'dev',
  '02-language-specialists': 'language',
  '03-infrastructure': 'infra',
  '04-quality-security': 'quality',
  '05-data-ai': 'data',
  '06-developer-experience': 'dx',
  '07-specialized-domains': 'specialized',
  '08-business-product': 'business',
  '09-meta-orchestration': 'meta',
  '10-research-analysis': 'research'
};

/**
 * Parse YAML frontmatter from markdown file
 */
function parseFrontmatter(content: string): { frontmatter: SubagentFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error('No frontmatter found');
  }

  const [, frontmatterText, body] = match;
  const frontmatter: any = {};

  // Parse YAML-like frontmatter
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  });

  return {
    frontmatter: frontmatter as SubagentFrontmatter,
    body: body.trim()
  };
}

/**
 * Slugify a name for use as ID
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Determine model based on subagent role
 */
function determineModel(name: string, description: string, category: string): SubagentJSON['model'] {
  // Use Haiku for simple/fast tasks
  if (name.includes('explorer') || name.includes('scanner') || category === 'research') {
    return 'claude-haiku';
  }

  // Use Opus for complex orchestration
  if (category === 'meta' || name.includes('architect') || name.includes('coordinator')) {
    return 'claude-opus';
  }

  // Default to Sonnet for most development tasks
  return 'claude-sonnet';
}

/**
 * Extract tags from description and category
 */
function extractTags(frontmatter: SubagentFrontmatter, category: string): string[] {
  const tags: string[] = [category];

  // Add language/framework tags
  const description = frontmatter.description.toLowerCase();
  const techKeywords = [
    'nodejs', 'python', 'golang', 'rust', 'typescript', 'javascript',
    'react', 'vue', 'angular', 'flutter', 'kotlin', 'java',
    'api', 'backend', 'frontend', 'fullstack', 'mobile',
    'devops', 'kubernetes', 'docker', 'terraform', 'aws', 'azure', 'gcp',
    'security', 'testing', 'qa', 'performance', 'database',
    'embedded', 'iot', 'esp32', 'arduino'
  ];

  techKeywords.forEach(keyword => {
    if (description.includes(keyword)) {
      tags.push(keyword);
    }
  });

  // Add explicit tags if provided
  if (frontmatter.tags) {
    tags.push(...frontmatter.tags.split(',').map(t => t.trim()));
  }

  return [...new Set(tags)]; // Deduplicate
}

/**
 * Process a single subagent markdown file
 */
async function processSubagent(filePath: string): Promise<SubagentJSON> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  // Extract category from file path
  const pathParts = filePath.split('/');
  const categoryDir = pathParts.find(p => p.match(/^\d{2}-/));
  const categoryKey = categoryDir || '01-core-development';
  const category = CATEGORY_MAPPING[categoryKey] || 'dev';

  // Parse tools
  const tools = frontmatter.tools.split(',').map(t => t.trim());

  // Generate ID
  const id = `${category}/${slugify(frontmatter.name)}`;

  // Determine model
  const model = frontmatter.model as SubagentJSON['model'] ||
                determineModel(frontmatter.name, frontmatter.description, category);

  // Extract tags
  const tags = extractTags(frontmatter, category);

  // Build JSON
  const subagent: SubagentJSON = {
    id,
    type: 'subagent_registry',
    name: frontmatter.name,
    description: frontmatter.description,
    category,
    tags,
    model,
    system_prompt: body,
    tools,
    mcp_servers: ['filesystem', 'github'], // Default MCP servers
    version: '1.0.0',
    author: 'VoltAgent',
    source_url: `https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/${path.relative(VOLTACENT_REPO, filePath)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return subagent;
}

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main import function
 */
async function importSubagents(dryRun: boolean = false, outputDir: string = OUTPUT_DIR) {
  console.log('🔍 Scanning VoltAgent repository...');
  console.log(`   Repository: ${VOLTACENT_REPO}`);

  // Find all markdown files in categories
  const categoriesDir = path.join(VOLTACENT_REPO, 'categories');
  const files = findMarkdownFiles(categoriesDir);

  console.log(`   Found ${files.length} subagent files`);

  const results: SubagentJSON[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    try {
      const subagent = await processSubagent(file);
      results.push(subagent);
      console.log(`   ✓ ${subagent.id}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ file, error: errorMsg });
      console.error(`   ✗ ${file}: ${errorMsg}`);
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   Total processed: ${files.length}`);
  console.log(`   Successful: ${results.length}`);
  console.log(`   Errors: ${errors.length}`);

  // Group by category
  const byCategory = results.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n📁 By Category:`);
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} subagents`);
  });

  if (dryRun) {
    console.log(`\n🏃 Dry run - no files written`);
    console.log(`\nSample output (first 3):`);
    results.slice(0, 3).forEach(s => {
      console.log(`\n${s.id}:`);
      console.log(JSON.stringify(s, null, 2).substring(0, 500) + '...');
    });
    return;
  }

  // Write files
  console.log(`\n💾 Writing files to ${outputDir}...`);

  for (const subagent of results) {
    const categoryDir = path.join(outputDir, subagent.category);
    fs.mkdirSync(categoryDir, { recursive: true });

    const filename = `${slugify(subagent.name)}.json`;
    const filePath = path.join(categoryDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(subagent, null, 2));
    console.log(`   ✓ ${filePath}`);
  }

  // Write index file
  const indexPath = path.join(outputDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify({
    total: results.length,
    categories: byCategory,
    subagents: results.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      model: s.model,
      tags: s.tags
    }))
  }, null, 2));

  console.log(`\n✅ Import complete!`);
  console.log(`   Index: ${indexPath}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered:`);
    errors.forEach(({ file, error }) => {
      console.log(`   ${path.basename(file)}: ${error}`);
    });
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outputDirArg = args.find(a => a.startsWith('--output-dir='));
const outputDir = outputDirArg ? outputDirArg.split('=')[1] : OUTPUT_DIR;

// Run
importSubagents(dryRun, outputDir).catch(console.error);
