#!/usr/bin/env node

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const fs = require('fs');
const path = require('path');

const client = new DynamoDBClient({ 
    region: 'eu-north-1',
    ...(process.env.AWS_PROFILE && { credentials: require('@aws-sdk/credential-providers').fromIni({ profile: 'default' }) })
});
const tableName = 'mcp-prompts';

async function populateSampleData() {
  try {
    const sampleDataPath = path.join(__dirname, '..', 'data', 'sample-prompts.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    
    console.log(`Loading ${sampleData.prompts.length} sample prompts into DynamoDB...`);
    
    for (const promptData of sampleData.prompts) {
      const item = marshall({
        id: promptData.id,
        version: 'latest',
        name: promptData.name,
        description: promptData.description || promptData.name,
        template: promptData.content || promptData.template,
        category: promptData.category || 'general',
        tags: promptData.tags || [],
        variables: promptData.variables || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_latest: 'true',
        metadata: promptData.metadata || {}
      });

      const command = new PutItemCommand({
        TableName: tableName,
        Item: item
      });

      await client.send(command);
      console.log(`✅ Added prompt: ${promptData.name}`);
    }
    
    console.log('🎉 Successfully populated DynamoDB with sample prompts!');
  } catch (error) {
    console.error('❌ Error populating sample data:', error);
    process.exit(1);
  }
}

populateSampleData();
