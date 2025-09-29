#!/usr/bin/env node

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const fs = require('fs');
const path = require('path');

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'eu-north-1',
    ...(process.env.AWS_PROFILE && { credentials: require('@aws-sdk/credential-providers').fromIni({ profile: 'default' }) })
});
const tableName = process.env.PROMPTS_TABLE || 'mcp-prompts';

async function populatePromptsFromIndex() {
  try {
    const indexPath = path.join(__dirname, '..', 'data', 'prompts', 'index.json');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

    console.log(`Loading ${indexData.totalPrompts} prompts from index into DynamoDB table: ${tableName}`);

    let successCount = 0;
    let errorCount = 0;

    for (const promptData of indexData.prompts) {
      try {
        // Map the index format to DynamoDB format
        const item = marshall({
          id: promptData.id,
          version: 'latest',
          name: promptData.name,
          description: promptData.description || '',
          template: promptData.content || '',
          category: promptData.metadata?.category || 'general',
          tags: promptData.tags || [],
          variables: promptData.variables || [],
          access_level: promptData.access_level || 'public',
          author_id: promptData.metadata?.author_id || 'system',
          created_at: promptData.createdAt || new Date().toISOString(),
          updated_at: promptData.updatedAt || new Date().toISOString(),
          is_latest: 'true',
          metadata: {
            ...promptData.metadata,
            format: promptData.format,
            originalFile: promptData.metadata?.originalFile || ''
          }
        });

        const command = new PutItemCommand({
          TableName: tableName,
          Item: item
        });

        await client.send(command);
        console.log(`✅ Added prompt: ${promptData.name} (${promptData.access_level})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error adding prompt ${promptData.name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n🎉 Completed! Successfully added ${successCount} prompts.`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} prompts failed to add.`);
    }

    // Summary by access level
    const accessLevels = indexData.prompts.reduce((acc, prompt) => {
      acc[prompt.access_level] = (acc[prompt.access_level] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Summary by access level:');
    Object.entries(accessLevels).forEach(([level, count]) => {
      console.log(`  - ${level}: ${count} prompts`);
    });

  } catch (error) {
    console.error('❌ Error populating prompts from index:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  populatePromptsFromIndex().catch(console.error);
}

module.exports = { populatePromptsFromIndex };