/**
 * MCP Inspector Integration Test
 * 
 * This test verifies that the MCP-Prompts server works correctly
 * when tested with the MCP Inspector tool.
 * 
 * The test spawns the MCP Inspector process and tests various
 * MCP server functionalities through the inspector interface.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { setTimeout } from 'timers/promises';

describe('MCP Inspector Integration', () => {
  let inspectorProcess = null;
  let inspectorPort = 6278;
  const INSPECTOR_TIMEOUT = 30000; // 30 seconds
  const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

  // Skip the test if we're not in the right environment
  const runTest = process.env.TEST_MCP_INSPECTOR === 'true';

  // Helper function to wait for inspector to be ready
  async function waitForInspectorReady() {
    const maxAttempts = 20;
    const delay = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://localhost:${inspectorPort}/health`);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Inspector not ready yet, continue waiting
      }
      await setTimeout(delay);
    }
    return false;
  }

  // Helper function to start MCP Inspector
  async function startInspector() {
    return new Promise((resolve, reject) => {
      inspectorProcess = spawn('npx', [
        '@modelcontextprotocol/inspector',
        'npx',
        '-y',
        '@sparesparrow/mcp-prompts'
      ], {
        stdio: 'pipe',
        env: {
          ...process.env,
          PORT: inspectorPort.toString()
        }
      });

      let stdout = '';
      let stderr = '';

      inspectorProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (stdout.includes('Starting MCP inspector') || stdout.includes('Server running')) {
          resolve();
        }
      });

      inspectorProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      inspectorProcess.on('error', (error) => {
        reject(new Error(`Failed to start inspector: ${error.message}`));
      });

      inspectorProcess.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Inspector process exited with code ${code}. Stderr: ${stderr}`));
        }
      });

      // Timeout after 10 seconds
      setTimeout(10000).then(() => {
        if (inspectorProcess && !inspectorProcess.killed) {
          reject(new Error('Inspector startup timeout'));
        }
      });
    });
  }

  // Helper function to stop MCP Inspector
  async function stopInspector() {
    if (inspectorProcess && !inspectorProcess.killed) {
      inspectorProcess.kill('SIGTERM');
      await new Promise(resolve => {
        inspectorProcess?.on('exit', resolve);
        setTimeout(5000).then(() => resolve(undefined));
      });
    }
  }

  beforeAll(async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    try {
      await startInspector();
      const isReady = await waitForInspectorReady();
      if (!isReady) {
        throw new Error('Inspector failed to start within timeout');
      }
    } catch (error) {
      console.error('Failed to start MCP Inspector:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (runTest) {
      await stopInspector();
    }
  });

  it('should start MCP Inspector successfully', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    expect(inspectorProcess).toBeDefined();
    expect(inspectorProcess?.killed).toBe(false);
  });

  it('should have inspector web interface accessible', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    const response = await fetch(`http://localhost:${inspectorPort}/health`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  it('should connect to MCP-Prompts server through inspector', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    // Test that the inspector can connect to our MCP server
    const response = await fetch(`http://localhost:${inspectorPort}/api/servers`);
    expect(response.status).toBe(200);
    
    const servers = await response.json();
    expect(Array.isArray(servers)).toBe(true);
    
    // Should have at least one server (our MCP-Prompts server)
    expect(servers.length).toBeGreaterThan(0);
  });

  it('should list available MCP tools', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    const response = await fetch(`http://localhost:${inspectorPort}/api/tools`);
    expect(response.status).toBe(200);
    
    const tools = await response.json();
    expect(Array.isArray(tools)).toBe(true);
    
    // Should have MCP-Prompts specific tools
    const toolNames = tools.map(tool => tool.name);
    expect(toolNames).toContain('list_prompts');
    expect(toolNames).toContain('get_prompt');
  });

  it('should list available MCP resources', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    const response = await fetch(`http://localhost:${inspectorPort}/api/resources`);
    expect(response.status).toBe(200);
    
    const resources = await response.json();
    expect(Array.isArray(resources)).toBe(true);
  });

  it('should be able to list prompts through MCP interface', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    // Test the list_prompts tool
    const response = await fetch(`http://localhost:${inspectorPort}/api/tools/list_prompts/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should handle MCP server errors gracefully', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    // Test with invalid prompt ID
    const response = await fetch(`http://localhost:${inspectorPort}/api/tools/get_prompt/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          promptId: 'non-existent-prompt-id'
        }
      })
    });
    
    // Should return an error response
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('isError');
    expect(result.isError).toBe(true);
  });

  it('should support template variable substitution', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    // First, create a template prompt
    const createResponse = await fetch(`http://localhost:${inspectorPort}/api/tools/save_prompt/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          prompt: {
            id: 'test-template',
            name: 'Test Template',
            content: 'Hello, {{name}}! Today is {{date}}.',
            isTemplate: true,
            variables: ['name', 'date']
          }
        }
      })
    });
    
    expect(createResponse.status).toBe(200);
    
    // Then test template application
    const applyResponse = await fetch(`http://localhost:${inspectorPort}/api/tools/apply_template/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          templateId: 'test-template',
          variables: {
            name: 'World',
            date: '2024-01-01'
          }
        }
      })
    });
    
    expect(applyResponse.status).toBe(200);
    
    const result = await applyResponse.json();
    expect(result).toHaveProperty('content');
    expect(result.content).toBe('Hello, World! Today is 2024-01-01.');
  });

  it('should support sequence operations', async () => {
    if (!runTest) {
      console.log('Skipping MCP Inspector test. Set TEST_MCP_INSPECTOR=true to run it.');
      return;
    }

    // Test sequence creation
    const createResponse = await fetch(`http://localhost:${inspectorPort}/api/tools/save_sequence/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          sequence: {
            id: 'test-sequence',
            name: 'Test Sequence',
            description: 'A test sequence',
            promptIds: ['test-template']
          }
        }
      })
    });
    
    expect(createResponse.status).toBe(200);
    
    // Test sequence retrieval
    const getResponse = await fetch(`http://localhost:${inspectorPort}/api/tools/get_sequence/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          sequenceId: 'test-sequence'
        }
      })
    });
    
    expect(getResponse.status).toBe(200);
    
    const result = await getResponse.json();
    expect(result).toHaveProperty('content');
    expect(result.content.id).toBe('test-sequence');
  });
}); 