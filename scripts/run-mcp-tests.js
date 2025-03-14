#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_PATH = path.resolve(__dirname, '../build/index.js');
const PROMPTS_DIR = process.env.PROMPTS_DIR || path.resolve(__dirname, '../../mcp-prompts');
const TESTS_DIR = path.resolve(__dirname, '../tests/scenarios');

// Start the MCP server
function startServer() {
  const server = spawn('node', [SERVER_PATH], {
    env: {
      ...process.env,
      PROMPTS_DIR
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Log server output for debugging
  server.stdout.on('data', (data) => {
    console.log(`[SERVER]: ${data.toString().trim()}`);
  });
  
  server.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR]: ${data.toString().trim()}`);
  });
  
  return server;
}

// Run a test scenario
async function runTest(scenario) {
  return new Promise((resolve, reject) => {
    console.log(`Running test: ${scenario.name}`);
    
    const server = startServer();
    
    // Give the server time to start
    setTimeout(() => {
      try {
        // Send test request
        if (scenario.type === 'prompt') {
          // Test MCP prompt capability
          const promptRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'prompts/get',
            params: {
              name: scenario.promptName,
              arguments: scenario.arguments || {}
            }
          };
          
          server.stdin.write(JSON.stringify(promptRequest) + '\n');
        } else if (scenario.type === 'tool') {
          // Test tool capability
          const toolRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: scenario.toolName,
              arguments: scenario.arguments || {}
            }
          };
          
          server.stdin.write(JSON.stringify(toolRequest) + '\n');
        }
        
        // Collect server response
        let response = '';
        const responseTimeout = setTimeout(() => {
          server.kill();
          reject(new Error(`Test timed out: ${scenario.name}`));
        }, 5000);
        
        server.stdout.on('data', (data) => {
          response += data.toString();
          
          try {
            // Check if we have a complete JSON-RPC response
            const jsonResponse = JSON.parse(response);
            
            if (jsonResponse.id === 1) {
              clearTimeout(responseTimeout);
              server.kill();
              
              // Validate response
              if (jsonResponse.error) {
                reject(new Error(`Test failed: ${scenario.name} - ${jsonResponse.error.message}`));
              } else {
                console.log(`✅ Test passed: ${scenario.name}`);
                resolve();
              }
            }
          } catch (e) {
            // Not yet a complete JSON response, continue collecting
          }
        });
      } catch (err) {
        server.kill();
        reject(err);
      }
    }, 1000);
  });
}

// Run all tests in the scenarios directory
async function runAllTests() {
  // Load test scenarios
  const scenarioFiles = fs.readdirSync(TESTS_DIR).filter(file => file.endsWith('.json'));
  
  console.log(`Found ${scenarioFiles.length} test scenarios`);
  
  let passed = 0;
  let failed = 0;
  
  for (const file of scenarioFiles) {
    try {
      const scenario = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, file), 'utf8'));
      await runTest(scenario);
      passed++;
    } catch (err) {
      console.error(`❌ ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
}); 