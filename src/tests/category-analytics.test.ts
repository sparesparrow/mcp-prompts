/**
 * Category and Analytics Tests
 * 
 * This test suite verifies that the category and usage tracking functionality works correctly.
 */

import { strict as assert } from 'assert';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';

/**
 * Interface for the response structure
 */
interface MCPResponse {
  status: string;
  content: {
    type: string;
    text: string;
  }[];
}

/**
 * Helper function to wait for a specified time
 * @param ms time to wait in milliseconds
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main test function
 */
async function runTests() {
  console.log('Starting category and analytics tests...');
  
  try {
    // Step 1: Add prompts with different categories
    console.log('Adding test prompts with different categories...');
    
    const developmentPromptId = `dev-test-${uuidv4()}`;
    const projectPromptId = `project-test-${uuidv4()}`;
    
    // Add development category prompt
    await axios.post(`${SERVER_URL}/mcp/tools/add_prompt`, {
      arguments: {
        prompt: {
          id: developmentPromptId,
          name: 'Development Test Prompt',
          content: 'This is a test prompt for development',
          category: 'development',
          isTemplate: false
        }
      }
    });
    
    // Add project-orchestration category prompt
    await axios.post(`${SERVER_URL}/mcp/tools/add_prompt`, {
      arguments: {
        prompt: {
          id: projectPromptId,
          name: 'Project Test Prompt',
          content: 'This is a test prompt for project orchestration',
          category: 'project-orchestration',
          isTemplate: false
        }
      }
    });
    
    // Step 2: List prompts filtered by category
    console.log('Testing category filtering...');
    
    // List development prompts
    const devPromptsResponse = await axios.post(`${SERVER_URL}/mcp/tools/list_prompts`, {
      arguments: {
        category: 'development'
      }
    });
    
    // List project prompts
    const projectPromptsResponse = await axios.post(`${SERVER_URL}/mcp/tools/list_prompts`, {
      arguments: {
        category: 'project-orchestration'
      }
    });
    
    // Verify that the prompts are correctly categorized
    const responseData = devPromptsResponse.data as MCPResponse;
    const devPrompts = JSON.parse(responseData.content[0].text);
    
    const projectResponseData = projectPromptsResponse.data as MCPResponse;
    const projectPrompts = JSON.parse(projectResponseData.content[0].text);
    
    assert(devPrompts.some((p: any) => p.id === developmentPromptId), 'Development prompt not found in development category');
    assert(projectPrompts.some((p: any) => p.id === projectPromptId), 'Project prompt not found in project-orchestration category');
    
    // Step 3: Test usage tracking
    console.log('Testing usage tracking...');
    
    // Get the development prompt multiple times to increase usage count
    for (let i = 0; i < 3; i++) {
      await axios.post(`${SERVER_URL}/mcp/tools/get_prompt`, {
        arguments: {
          id: developmentPromptId
        }
      });
      // Add a small delay to ensure the updates are processed
      await wait(100);
    }
    
    // Get the project prompt once
    await axios.post(`${SERVER_URL}/mcp/tools/get_prompt`, {
      arguments: {
        id: projectPromptId
      }
    });
    
    // Step 4: Get analytics and verify
    console.log('Testing analytics...');
    
    const analyticsResponse = await axios.post(`${SERVER_URL}/mcp/tools/prompt_analytics`, {
      arguments: {}
    });
    
    const analyticsData = analyticsResponse.data as MCPResponse;
    const analytics = JSON.parse(analyticsData.content[0].text);
    
    // Verify that usage counts are correct
    const devPromptAnalytics = analytics.topPrompts.find((p: any) => p.id === developmentPromptId);
    const projectPromptAnalytics = analytics.topPrompts.find((p: any) => p.id === projectPromptId);
    
    assert(devPromptAnalytics, 'Development prompt not found in analytics');
    assert(projectPromptAnalytics, 'Project prompt not found in analytics');
    assert.equal(devPromptAnalytics.usage_count, 3, 'Development prompt usage count incorrect');
    assert.equal(projectPromptAnalytics.usage_count, 1, 'Project prompt usage count incorrect');
    
    // Verify that category statistics are correct
    assert(analytics.categoryStats.development >= 3, 'Development category usage count incorrect');
    assert(analytics.categoryStats['project-orchestration'] >= 1, 'Project-orchestration category usage count incorrect');
    
    // Step 5: Clean up test prompts
    console.log('Cleaning up test prompts...');
    
    await axios.post(`${SERVER_URL}/mcp/tools/delete_prompt`, {
      arguments: {
        id: developmentPromptId
      }
    });
    
    await axios.post(`${SERVER_URL}/mcp/tools/delete_prompt`, {
      arguments: {
        id: projectPromptId
      }
    });
    
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 