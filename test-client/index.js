#!/usr/bin/env node

const { McpClient } = require('@modelcontextprotocol/sdk/client/mcp.js');
const { ChildProcessTransport } = require('@modelcontextprotocol/sdk/client/child-process.js');
const path = require('path');

// Configure paths
const serverPath = path.join(__dirname, '..', 'build', 'index.js');

async function main() {
  console.log('Starting MCP Prompts test client...');
  
  // Initialize client
  const transport = new ChildProcessTransport(process.execPath, [serverPath]);
  const client = new McpClient(transport);
  
  // Connect to the server
  await client.connect();
  console.log('Connected to MCP Prompts server.');
  
  try {
    // Get server description
    const description = await client.describe();
    console.log('\nServer Description:');
    console.log(JSON.stringify(description, null, 2));
    
    // Test list_prompts
    console.log('\nTesting list_prompts:');
    const prompts = await client.callTool('list_prompts', {});
    console.log(`Found ${prompts.prompts.length} prompts:`);
    prompts.prompts.forEach(prompt => {
      console.log(`  - ${prompt.name} (${prompt.id}): ${prompt.tags.join(', ')}`);
    });
    
    // Test add_prompt
    console.log('\nTesting add_prompt:');
    const testPrompt = {
      name: 'Test Prompt',
      description: 'A prompt created for testing',
      content: 'You are a test assistant helping to verify the MCP Prompts server functionality.',
      isTemplate: false,
      tags: ['test', 'verification']
    };
    
    const addResult = await client.callTool('add_prompt', { prompt: testPrompt });
    console.log(`Added prompt with ID: ${addResult.id}`);
    
    // Test get_prompt
    console.log('\nTesting get_prompt:');
    const getResult = await client.callTool('get_prompt', { id: addResult.id });
    console.log('Retrieved prompt:');
    console.log(JSON.stringify(getResult.prompt, null, 2));
    
    // Test edit_prompt
    console.log('\nTesting edit_prompt:');
    const editedPrompt = {
      ...getResult.prompt,
      description: 'An updated test prompt description',
      tags: [...getResult.prompt.tags, 'edited']
    };
    
    const editResult = await client.callTool('edit_prompt', { 
      id: addResult.id,
      prompt: editedPrompt
    });
    console.log(`Edited prompt with ID: ${editResult.id}`);
    
    // Test template application if available
    const templates = prompts.prompts.filter(p => p.isTemplate);
    if (templates.length > 0) {
      console.log('\nTesting apply_template:');
      const templateId = templates[0].id;
      const variables = {};
      
      // Create variable values based on the template's required variables
      templates[0].variables?.forEach(variable => {
        variables[variable] = `Test value for ${variable}`;
      });
      
      const appliedTemplate = await client.callTool('apply_template', {
        id: templateId,
        variables
      });
      
      console.log(`Applied template ${templateId} with result:`);
      console.log(appliedTemplate.content);
    }
    
    console.log('\nAll tests passed successfully!');
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    // Clean up and disconnect
    await client.disconnect();
    console.log('\nDisconnected from server. Test complete.');
  }
}

// Run the client
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 