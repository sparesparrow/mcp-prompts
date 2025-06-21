const fs = require('fs');
const path = require('path');

// Use require.resolve to get the actual package location, then resolve prompts dir
const packageRoot = path.dirname(require.resolve('@sparesparrow/mcp-prompts-catalog/package.json'));
const promptsDir = path.join(packageRoot, 'prompts');

function getPromptsDir() {
  return promptsDir;
}

function getCategories() {
  return fs.readdirSync(promptsDir).filter(f => fs.statSync(path.join(promptsDir, f)).isDirectory());
}

function listPrompts(category) {
  const catDir = path.join(promptsDir, category);
  const indexFile = path.join(catDir, 'index.json');
  if (fs.existsSync(indexFile)) {
    return JSON.parse(fs.readFileSync(indexFile, 'utf8')).map(f => path.basename(f, '.json'));
  }
  if (!fs.existsSync(catDir)) return [];
  return fs.readdirSync(catDir).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => path.basename(f, '.json'));
}

function loadPrompt(name, category) {
  const file = path.join(promptsDir, category, name + '.json');
  if (!fs.existsSync(file)) throw new Error(`Prompt not found: ${category}/${name}`);
  return require(file);
}

module.exports = {
  getPromptsDir,
  getCategories,
  listPrompts,
  loadPrompt
}; 