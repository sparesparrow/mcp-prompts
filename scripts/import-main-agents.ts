#!/usr/bin/env node
/**
 * Import Main Agent Templates from improved-agents.json
 *
 * Converts main agent templates to the new Prompt entity format
 * and saves them as JSON files in data/prompts/main-agents/
 */

import fs from 'fs';
import path from 'path';

// Source file
const IMPROVED_AGENTS_FILE = path.join(__dirname, '../AGENTS/improved-agents.json');

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../data/prompts/main-agents');

// Mapping of model names to ClaudeModel enum
const MODEL_MAPPING: Record<string, 'claude-opus' | 'claude-sonnet' | 'claude-haiku'> = {
  'claude-opus': 'claude-opus',
  'sonnet': 'claude-sonnet',
  'haiku': 'claude-haiku'
};

interface ImprovedAgentsFile {
  global_subagents: Record<string, any>;
  main_agent_templates: Record<string, MainAgentTemplate>;
}

interface MainAgentTemplate {
  description: string;
  model: string;
  mcp_servers: string[];
  system_prompt: string;
  subagents: string[];
  primary_languages: string[];
  frameworks: string[];
  tools: string[];
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
  promptType: 'main_agent_template';
  agentConfig: {
    model: 'claude-opus' | 'claude-sonnet' | 'claude-haiku';
    systemPrompt: string;
    tools: string[];
    mcpServers: string[];
    subagents: string[];
    compatibleWith: string[];
  };
}

/**
 * Convert a main agent template to Prompt entity format
 */
function convertMainAgent(templateId: string, template: MainAgentTemplate): PromptJSON {
  // Generate ID like: main_agent_cpp_backend
  const id = `main_agent_${templateId}`;

  // Generate name from ID (capitalize and add spaces)
  const name = templateId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Determine compatible project types from the template ID and languages
  const compatibleWith = [templateId];

  // Add language-specific compatibility
  template.primary_languages.forEach(lang => {
    const langLower = lang.toLowerCase();
    if (!compatibleWith.includes(langLower)) {
      compatibleWith.push(langLower);
    }
  });

  // Generate tags
  const tags = [
    'orchestration',
    'main-agent',
    ...template.primary_languages.map(l => l.toLowerCase()),
    ...template.frameworks.map(f => f.toLowerCase().replace(/\s+/g, '-'))
  ];

  // Map model to our enum
  const model = MODEL_MAPPING[template.model] || 'claude-opus';

  // Create the prompt JSON
  const promptJSON: PromptJSON = {
    id,
    name,
    description: template.description,
    content: template.system_prompt,
    category: 'orchestration',
    tags,
    isTemplate: false,
    variables: [],
    version: '1.0.0',
    promptType: 'main_agent_template',
    agentConfig: {
      model,
      systemPrompt: template.system_prompt,
      tools: template.tools,
      mcpServers: template.mcp_servers,
      subagents: template.subagents,
      compatibleWith
    }
  };

  return promptJSON;
}

/**
 * Main import function
 */
async function importMainAgents() {
  console.log('🚀 Starting main agent template import...\n');

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

  // Extract main agent templates
  const templates = improvedAgents.main_agent_templates;
  const templateIds = Object.keys(templates);

  console.log(`\n📊 Found ${templateIds.length} main agent templates:\n`);
  templateIds.forEach(id => console.log(`   - ${id}`));
  console.log();

  // Convert and save each template
  let successCount = 0;
  let errorCount = 0;

  for (const [templateId, template] of Object.entries(templates)) {
    try {
      console.log(`🔄 Processing: ${templateId}...`);

      // Convert to prompt format
      const promptJSON = convertMainAgent(templateId, template);

      // Write to file
      const outputFile = path.join(OUTPUT_DIR, `${promptJSON.id}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(promptJSON, null, 2));

      console.log(`   ✅ Saved to: ${outputFile}`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Error processing ${templateId}:`, error);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total templates processed: ${templateIds.length}`);
  console.log(`✅ Successfully imported: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));

  if (errorCount === 0) {
    console.log('\n🎉 All main agent templates imported successfully!');
  } else {
    console.log('\n⚠️  Some templates had errors. Please review the output above.');
    process.exit(1);
  }
}

// Run the import
importMainAgents().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
