/**
 * MCP Prompts Test Module
 * 
 * Consolidated tests for the core module functionality
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

import {
  Prompt,
  TemplateVariables,
  savePrompt,
  loadPrompt,
  applyTemplate,
  validatePrompt,
  extractVariables,
  parsePromptContent,
  generateTags,
  createTestPrompts
} from './index';

// Helper function to run all tests
export async function runAllTests(useInMemory = true): Promise<void> {
  console.log('Running MCP Prompts Server tests...');
  
  // Run core functionality tests
  await testCorePrompts(useInMemory);
  
  // Run prompt parsing tests
  await testPromptParsing();
  
  // Run tag generation tests
  await testTagGeneration();
  
  console.log('All tests completed successfully! ✅');
}

// Test core prompt functionality
async function testCorePrompts(useInMemory = true): Promise<void> {
  // Set up test environment
  const testDir = useInMemory ? null : path.join(process.cwd(), 'test-output');
  if (testDir && !fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Use in-memory or file storage
  const testPrompts = new Map<string, Prompt>();
  
  const testStorage = {
    savePrompt: async (prompt: Prompt): Promise<void> => {
      if (useInMemory) {
        testPrompts.set(prompt.id, prompt);
      } else {
        const filePath = path.join(testDir!, `${prompt.id}.json`);
        await promisify(fs.writeFile)(filePath, JSON.stringify(prompt, null, 2));
      }
    },
    loadPrompt: async (id: string): Promise<Prompt | null> => {
      if (useInMemory) {
        return testPrompts.get(id) || null;
      } else {
        try {
          const filePath = path.join(testDir!, `${id}.json`);
          const content = await promisify(fs.readFile)(filePath, 'utf8');
          return JSON.parse(content) as Prompt;
        } catch (error) {
          return null;
        }
      }
    }
  };
  
  const { prompt: testPrompt, template: testTemplate } = createTestPrompts();
  
  try {
    // Test saving and loading a prompt
    await testStorage.savePrompt(testPrompt);
    const loadedPrompt = await testStorage.loadPrompt(testPrompt.id);
    
    assert.strictEqual(loadedPrompt!.id, testPrompt.id);
    assert.strictEqual(loadedPrompt!.name, testPrompt.name);
    assert.strictEqual(loadedPrompt!.content, testPrompt.content);
    
    console.log('✓ Test passed: Save and load prompt');
    
    // Test saving and loading a template
    await testStorage.savePrompt(testTemplate);
    const loadedTemplate = await testStorage.loadPrompt(testTemplate.id);
    
    assert.strictEqual(loadedTemplate!.id, testTemplate.id);
    assert.strictEqual(loadedTemplate!.isTemplate, true);
    assert.deepStrictEqual(loadedTemplate!.variables, testTemplate.variables);
    
    console.log('✓ Test passed: Save and load template');
    
    // Test applying a template
    const appliedContent = applyTemplate(testTemplate, { variable: 'test value' });
    assert.strictEqual(appliedContent, 'This is a test template with test value');
    
    console.log('✓ Test passed: Apply template');
    
    // Test handling non-existent prompt
    const nonExistentPrompt = await testStorage.loadPrompt('non-existent');
    assert.strictEqual(nonExistentPrompt, null);
    
    console.log('✓ Test passed: Handle non-existent prompt');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    // Clean up test environment
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

// Test prompt parsing functionality
async function testPromptParsing(): Promise<void> {
  try {
    // JSON parsing test
    const jsonContent = JSON.stringify({
      id: 'json-test',
      name: 'JSON Test',
      content: 'This is a test JSON prompt',
      isTemplate: false
    });
    
    const jsonResults = parsePromptContent(jsonContent);
    assert.strictEqual(jsonResults.length, 1);
    assert.strictEqual(jsonResults[0].content, 'This is a test JSON prompt');
    
    console.log('✓ Test passed: Parse JSON prompt');
    
    // System role content test
    const systemRoleContent = `{"role": "system", "content": "You are a testing assistant that helps verify functionality."}`;
    const systemRoleResults = parsePromptContent(systemRoleContent);
    
    assert.strictEqual(systemRoleResults.length, 1);
    assert.ok(systemRoleResults[0].content?.includes('testing assistant'));
    
    console.log('✓ Test passed: Parse system role prompt');
    
    // Markdown code block test
    const markdownContent = `
# Test Prompt
Here's a test prompt:

\`\`\`
You are a test assistant. Please help me validate this functionality.
\`\`\`
`;
    
    const markdownResults = parsePromptContent(markdownContent);
    assert.ok(markdownResults.length > 0);
    
    console.log('✓ Test passed: Parse markdown prompt');
    
    // Template variable extraction test
    const templateContent = 'This is a {{test}} with {{variables}}';
    const variables = extractVariables(templateContent);
    
    assert.strictEqual(variables.length, 2);
    assert.ok(variables.includes('test'));
    assert.ok(variables.includes('variables'));
    
    console.log('✓ Test passed: Extract template variables');
  } catch (error) {
    console.error('Prompt parsing test failed:', error);
    throw error;
  }
}

// Test tag generation functionality
async function testTagGeneration(): Promise<void> {
  try {
    // Test programming-related content
    const programmingPrompt = {
      content: 'You are a programming assistant that helps with JavaScript and TypeScript code.',
      isTemplate: false
    };
    
    const programmingTags = generateTags(programmingPrompt);
    assert.ok(programmingTags.includes('ai'));
    assert.ok(programmingTags.includes('coding') || programmingTags.includes('programming'));
    assert.ok(programmingTags.includes('ai-assistant'));
    
    console.log('✓ Test passed: Generate programming tags');
    
    // Test productivity-related content
    const productivityPrompt = {
      content: 'You help with productivity and workflow organization to improve efficiency.',
      isTemplate: false
    };
    
    const productivityTags = generateTags(productivityPrompt);
    assert.ok(productivityTags.includes('productivity'));
    
    console.log('✓ Test passed: Generate productivity tags');
    
    // Test template tags
    const templatePrompt = {
      content: 'This is a template with {{variable}}',
      isTemplate: true
    };
    
    const templateTags = generateTags(templatePrompt);
    assert.ok(templateTags.includes('template'));
    
    console.log('✓ Test passed: Generate template tags');
  } catch (error) {
    console.error('Tag generation test failed:', error);
    throw error;
  }
}

// Export for direct use
export default runAllTests; 