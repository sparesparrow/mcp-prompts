#!/usr/bin/env node

const { spawn } = require('child_process');

// Start the MCP server
const mcpServer = spawn('node', ['dist/index.js'], {
  env: { ...process.env, MODE: 'mcp' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let messageId = 1;

function sendMessage(method, params = null) {
  const message = {
    jsonrpc: '2.0',
    id: messageId++,
    method,
    params
  };
  
  console.log(`\n📤 Sending: ${method}`);
  mcpServer.stdin.write(JSON.stringify(message) + '\n');
}

// Handle responses
mcpServer.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      
      if (response.result) {
        console.log(`✅ Response (ID: ${response.id}):`);
        if (response.result.content) {
          console.log(response.result.content[0].text);
        } else {
          console.log(JSON.stringify(response.result, null, 2));
        }
      } else if (response.error) {
        console.log(`❌ Error (ID: ${response.id}):`, response.error.message);
      }
    } catch (e) {
      // Log messages that aren't JSON (like server logs)
      if (line.includes('level')) {
        console.log(`📝 Log: ${line}`);
      }
    }
  }
});

mcpServer.stderr.on('data', (data) => {
  console.error('🔴 Error:', data.toString());
});

// Test sequence
setTimeout(() => {
  console.log('🚀 Starting MCP Prompts Server Test Suite...\n');
  
  // 1. Initialize
  sendMessage('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  });
  
  // 2. Get stats
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'get_stats',
      arguments: {}
    });
  }, 1000);
  
  // 3. List prompts
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'list_prompts',
      arguments: {}
    });
  }, 2000);
  
  // 4. Get specific prompt
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'get_prompt',
      arguments: { id: 'code_review_assistant' }
    });
  }, 3000);
  
  // 5. Apply template
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'apply_template',
      arguments: {
        id: 'code_review_assistant',
        variables: {
          language: 'JavaScript',
          code: 'function hello() { console.log("Hello World"); }'
        }
      }
    });
  }, 4000);
  
  // 6. Add new prompt
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'add_prompt',
      arguments: {
        name: 'Test Prompt',
        content: 'This is a test prompt for {{subject}}',
        isTemplate: true,
        tags: ['test', 'example'],
        variables: [
          {
            name: 'subject',
            description: 'The subject to test',
            required: true,
            type: 'string'
          }
        ]
      }
    });
  }, 5000);
  
  // 7. List prompts with filter
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'list_prompts',
      arguments: {
        tags: ['test']
      }
    });
  }, 6000);
  
  // 8. Final stats
  setTimeout(() => {
    sendMessage('tools/call', {
      name: 'get_stats',
      arguments: {}
    });
  }, 7000);
  
  // Cleanup
  setTimeout(() => {
    console.log('\n✅ Test completed successfully!');
    mcpServer.kill();
    process.exit(0);
  }, 8000);
  
}, 1000);
