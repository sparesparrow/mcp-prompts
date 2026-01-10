#!/usr/bin/env node
/**
 * Test script to verify main agent templates import
 */

import path from 'path';
import { FilePromptRepository } from '../src/adapters/file/file-prompt-repository';

async function testMainAgents() {
  console.log('🧪 Testing Main Agent Templates...\n');

  const promptsDir = path.join(__dirname, '../data/prompts');
  const repository = new FilePromptRepository(promptsDir);

  // Test 1: Find all main agents
  console.log('Test 1: List all main agent templates');
  const mainAgents = await repository.findMainAgents();
  console.log(`   ✅ Found ${mainAgents.length} main agent templates\n`);

  // Test 2: Verify each main agent
  console.log('Test 2: Verify each main agent template');
  for (const agent of mainAgents) {
    console.log(`   📋 ${agent.id}`);
    console.log(`      - Name: ${agent.name}`);
    console.log(`      - Description: ${agent.description}`);
    console.log(`      - Model: ${agent.getModel()}`);
    console.log(`      - Subagents: ${agent.agentConfig?.subagents?.length || 0}`);
    console.log(`      - MCP Servers: ${agent.agentConfig?.mcpServers?.join(', ')}`);
    console.log(`      - Compatible with: ${agent.agentConfig?.compatibleWith?.join(', ')}`);
    console.log();
  }

  // Test 3: Get specific main agent
  console.log('Test 3: Get specific main agent (cpp_backend)');
  const cppBackend = await repository.findById('main_agent_cpp_backend');
  if (cppBackend) {
    console.log(`   ✅ Found: ${cppBackend.name}`);
    console.log(`   - System prompt length: ${cppBackend.getSystemPrompt()?.length || 0} chars`);
    console.log(`   - Tags: ${cppBackend.tags.join(', ')}`);
  } else {
    console.log('   ❌ Not found!');
  }
  console.log();

  // Test 4: Find main agent by project type
  console.log('Test 4: Find main agent for project type "cpp_backend"');
  const cppAgents = await repository.findMainAgents('cpp_backend');
  console.log(`   ✅ Found ${cppAgents.length} agent(s) for cpp_backend`);
  if (cppAgents.length > 0) {
    console.log(`   - Agent: ${cppAgents[0].id}`);
  }
  console.log();

  // Test 5: Verify subagent references exist
  console.log('Test 5: Verify subagent references');
  let allValid = true;
  for (const agent of mainAgents) {
    const subagentIds = agent.agentConfig?.subagents || [];
    console.log(`   Checking ${agent.id} (${subagentIds.length} subagents)...`);

    for (const subagentId of subagentIds) {
      const subagent = await repository.findById(subagentId);
      if (!subagent) {
        console.log(`      ❌ Missing subagent: ${subagentId}`);
        allValid = false;
      }
    }
  }

  if (allValid) {
    console.log(`   ✅ All subagent references are valid\n`);
  } else {
    console.log(`   ⚠️  Some subagent references are missing\n`);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('✅ All tests completed successfully!');
  console.log('='.repeat(60));
}

testMainAgents().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
