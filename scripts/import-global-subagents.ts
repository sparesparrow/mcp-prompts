#!/usr/bin/env node
/**
 * Import Global Subagents from improved-agents.json
 *
 * These are the generic subagents referenced by main agent templates
 */

import fs from 'fs';
import path from 'path';

// Source file
const IMPROVED_AGENTS_FILE = path.join(__dirname, '../AGENTS/improved-agents.json');

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../data/prompts/subagents');

interface ImprovedAgentsFile {
  global_subagents: Record<string, GlobalSubagent>;
  main_agent_templates: Record<string, any>;
}

interface GlobalSubagent {
  description: string;
  model: string;
  tools: string[];
  prompt: string;
}

interface PromptJSON {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  isTemplate: boolean;
  variables: string[];
  version: string;
  promptType: 'subagent_registry';
  agentConfig: {
    model: 'claude-opus' | 'claude-sonnet' | 'claude-haiku';
    systemPrompt: string;
    tools: string[];
    mcpServers: string[];
  };
}

// Model mapping
const MODEL_MAPPING: Record<string, 'claude-opus' | 'claude-sonnet' | 'claude-haiku'> = {
  'opus': 'claude-opus',
  'sonnet': 'claude-sonnet',
  'haiku': 'claude-haiku'
};

/**
 * Convert a global subagent to Prompt entity format
 */
function convertGlobalSubagent(subagentId: string, subagent: GlobalSubagent): PromptJSON {
  // Generate name from ID
  const name = subagentId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Map model
  const model = MODEL_MAPPING[subagent.model] || 'claude-sonnet';

  // Determine category from subagent type
  let category = 'analysis';
  if (subagentId.includes('test')) category = 'testing';
  else if (subagentId.includes('doc')) category = 'documentation';
  else if (subagentId.includes('review')) category = 'quality';
  else if (subagentId.includes('git')) category = 'dev-tools';
  else if (subagentId.includes('diagram')) category = 'visualization';
  else if (subagentId.includes('refactor')) category = 'refactoring';
  else if (subagentId.includes('dependency') || subagentId.includes('config')) category = 'infrastructure';

  // Generate tags
  const tags = [
    'subagent',
    'orchestration',
    category,
    subagentId
  ];

  // Create the prompt JSON
  const promptJSON: PromptJSON = {
    id: subagentId,
    name,
    description: subagent.description,
    content: subagent.prompt,
    category,
    tags,
    isTemplate: false,
    variables: [],
    version: '1.0.0',
    promptType: 'subagent_registry',
    agentConfig: {
      model,
      systemPrompt: subagent.prompt,
      tools: subagent.tools,
      mcpServers: ['filesystem', 'github']  // Default MCP servers
    }
  };

  return promptJSON;
}

/**
 * Main import function
 */
async function importGlobalSubagents() {
  console.log('🚀 Starting global subagent import...\n');

  // Check if source file exists
  if (!fs.existsSync(IMPROVED_AGENTS_FILE)) {
    console.error(`❌ Source file not found: ${IMPROVED_AGENTS_FILE}`);
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`📁 Creating output directory: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read and parse the improved-agents.json file
  console.log(`📖 Reading ${IMPROVED_AGENTS_FILE}...`);
  const fileContent = fs.readFileSync(IMPROVED_AGENTS_FILE, 'utf-8');
  const improvedAgents: ImprovedAgentsFile = JSON.parse(fileContent);

  // Extract global subagents
  const subagents = improvedAgents.global_subagents;
  const subagentIds = Object.keys(subagents);

  console.log(`\n📊 Found ${subagentIds.length} global subagents:\n`);
  subagentIds.forEach(id => console.log(`   - ${id}`));
  console.log();

  // Convert and save each subagent
  let successCount = 0;
  let errorCount = 0;

  for (const [subagentId, subagent] of Object.entries(subagents)) {
    try {
      console.log(`🔄 Processing: ${subagentId}...`);

      // Convert to prompt format
      const promptJSON = convertGlobalSubagent(subagentId, subagent);

      // Write to file
      const outputFile = path.join(OUTPUT_DIR, `${promptJSON.id}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(promptJSON, null, 2));

      console.log(`   ✅ Saved to: ${outputFile}`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Error processing ${subagentId}:`, error);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total subagents processed: ${subagentIds.length}`);
  console.log(`✅ Successfully imported: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));

  if (errorCount === 0) {
    console.log('\n🎉 All global subagents imported successfully!');
  } else {
    console.log('\n⚠️  Some subagents had errors. Please review the output above.');
    process.exit(1);
  }
}

// Run the import
importGlobalSubagents().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
