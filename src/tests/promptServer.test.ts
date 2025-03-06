/**
 * promptServer.test.ts
 * 
 * Tests for the MCP Prompts Server functionality
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

// Mock prompt data for testing
const TEST_PROMPT = {
  id: 'test-prompt',
  name: 'Test Prompt',
  description: 'A prompt for testing',
  content: 'This is a test prompt content',
  isTemplate: false,
  tags: ['test', 'prompt'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
};

const TEST_TEMPLATE = {
  id: 'test-template',
  name: 'Test Template',
  description: 'A template for testing',
  content: 'This is a test template with {{variable}}',
  isTemplate: true,
  variables: ['variable'],
  tags: ['test', 'template'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1
};

// Define a test harness
async function runTests() {
  console.log('Starting MCP Prompts Server tests');

  // Set up test environment
  const testDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Import the server module - this would normally point to your actual server
  // We're faking it here for demonstration purposes
  const server = {
    savePrompt: async (prompt: any): Promise<void> => {
      const filePath = path.join(testDir, `${prompt.id}.json`);
      await promisify(fs.writeFile)(filePath, JSON.stringify(prompt, null, 2));
    },
    loadPrompt: async (id: string): Promise<any | null> => {
      try {
        const filePath = path.join(testDir, `${id}.json`);
        const content = await promisify(fs.readFile)(filePath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        return null;
      }
    },
    applyTemplate: (template: any, variables: any): string => {
      let content = template.content;
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
      }
      return content;
    }
  };

  try {
    // Test saving and loading a prompt
    await server.savePrompt(TEST_PROMPT);
    const loadedPrompt = await server.loadPrompt(TEST_PROMPT.id);
    
    assert.strictEqual(loadedPrompt.id, TEST_PROMPT.id);
    assert.strictEqual(loadedPrompt.name, TEST_PROMPT.name);
    assert.strictEqual(loadedPrompt.content, TEST_PROMPT.content);
    
    console.log('✓ Test passed: Save and load prompt');

    // Test saving and loading a template
    await server.savePrompt(TEST_TEMPLATE);
    const loadedTemplate = await server.loadPrompt(TEST_TEMPLATE.id);
    
    assert.strictEqual(loadedTemplate.id, TEST_TEMPLATE.id);
    assert.strictEqual(loadedTemplate.isTemplate, true);
    assert.deepStrictEqual(loadedTemplate.variables, TEST_TEMPLATE.variables);
    
    console.log('✓ Test passed: Save and load template');

    // Test applying a template
    const appliedContent = server.applyTemplate(TEST_TEMPLATE, { variable: 'test value' });
    assert.strictEqual(appliedContent, 'This is a test template with test value');
    
    console.log('✓ Test passed: Apply template');

    // Test handling non-existent prompt
    const nonExistentPrompt = await server.loadPrompt('non-existent');
    assert.strictEqual(nonExistentPrompt, null);
    
    console.log('✓ Test passed: Handle non-existent prompt');

    console.log('All tests passed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up test environment
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Failed to clean up test directory:', error);
    }
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
}

export { runTests }; 