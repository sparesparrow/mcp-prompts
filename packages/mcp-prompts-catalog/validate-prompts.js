const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const promptsDir = path.join(__dirname, 'prompts');
const schema = require('./schemas/prompt.schema.json');
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      yield fullPath;
    }
  }
}

let hasError = false;
for (const file of walk(promptsDir)) {
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!validate(data)) {
    hasError = true;
    console.error(`Validation failed for ${file}:`);
    console.error(validate.errors);
  } else {
    console.log(`Valid: ${file}`);
  }
}
if (hasError) {
  process.exit(1);
} else {
  console.log('All prompts are valid!');
}
