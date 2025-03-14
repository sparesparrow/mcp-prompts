# MCP Prompts Collection

This directory contains a collection of high-quality prompts for various AI assistant scenarios.

## Included Prompt Templates

These are carefully crafted prompt templates with detailed instructions and parameters:

- [Development System Prompt](development-system-prompt.json) - Template for creating system prompts for development assistance
- [Development Workflow](development-workflow.json) - Standard workflow for Python development projects
- [Code Review Assistant](code-review-assistant.json) - Comprehensive code review with best practices
- [Data Analysis Template](data-analysis-template.json) - Flexible template for analyzing various types of data

## Prompt Categories

### Development and Programming

- [Development System Prompt](development-system-prompt.json) - Template for development assistance
- [Development Workflow](development-workflow.json) - Standard workflow for Python projects
- [Code Review Assistant](code-review-assistant.json) - Structured code review

### Analysis and Research

- [Data Analysis Template](data-analysis-template.json) - Analyze datasets with customizable parameters

## Using the Prompts

These prompts can be accessed through the MCP server using:

1. Direct prompt retrieval by ID
2. Filtering by tags
3. Applying templates with variable substitution

### Example Usage

```javascript
// Retrieve a prompt template
const codeReviewPrompt = await mcpClient.getPrompt("code-review-assistant");

// Apply variables to the template
const filledPrompt = await mcpClient.applyTemplate({
  id: "code-review-assistant",
  variables: {
    language: "TypeScript",
    code: "// Your code here",
    context: "This is part of a REST API endpoint"
  }
});
``` 