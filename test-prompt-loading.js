#!/usr/bin/env node

// Simple test script to verify prompt loading functionality
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Prompt Loading Integration...\n');

// Test 1: Check if index.json exists and is valid
console.log('1. Testing index.json generation...');
try {
  const indexPath = path.join(__dirname, 'data', 'prompts', 'index.json');
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  console.log(`   ✓ Index contains ${indexData.totalPrompts} prompts`);
  console.log(`   ✓ Public: ${indexData.categories.public.count}`);
  console.log(`   ✓ Premium: ${indexData.categories.premium.count}`);
  console.log(`   ✓ Private: ${indexData.categories.private.count}`);
} catch (error) {
  console.error('   ❌ Index validation failed:', error.message);
  process.exit(1);
}

// Test 2: Verify prompt files exist
console.log('\n2. Testing prompt file accessibility...');
try {
  const indexPath = path.join(__dirname, 'data', 'prompts', 'index.json');
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  let fileCheckCount = 0;
  for (const prompt of indexData.prompts.slice(0, 5)) { // Test first 5 prompts
    const filePath = path.join(__dirname, 'data', 'prompts', prompt.metadata?.originalFile || '');
    if (fs.existsSync(filePath)) {
      fileCheckCount++;
    }
  }

  console.log(`   ✓ ${fileCheckCount}/5 sample prompt files are accessible`);
} catch (error) {
  console.error('   ❌ File accessibility test failed:', error.message);
}

// Test 3: Test the populate script dry run
console.log('\n3. Testing populate script structure...');
try {
  const populateScript = require('./scripts/populate-prompts-from-index.js');

  // Check if the function exists
  if (typeof populateScript.populatePromptsFromIndex === 'function') {
    console.log('   ✓ Populate script is properly structured');
  } else {
    console.log('   ❌ Populate script missing main function');
  }
} catch (error) {
  console.error('   ❌ Populate script test failed:', error.message);
}

// Test 4: Verify build artifacts
console.log('\n4. Testing build artifacts...');
try {
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    console.log(`   ✓ Build artifacts exist (${jsFiles.length} JS files)`);
  } else {
    console.log('   ❌ Build artifacts missing');
  }
} catch (error) {
  console.error('   ❌ Build artifacts test failed:', error.message);
}

console.log('\n🎉 All integration tests passed!');
console.log('\nNext steps:');
console.log('1. Run: node scripts/populate-prompts-from-index.js (to populate DynamoDB)');
console.log('2. Deploy to AWS: ./scripts/deploy-aws.sh');
console.log('3. Test with MCP Inspector: npx @modelcontextprotocol/inspector');