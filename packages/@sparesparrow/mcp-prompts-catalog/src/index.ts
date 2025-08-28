/**
 * @sparesparrow/mcp-prompts-catalog
 * Curated prompt catalog for MCP Prompts
 */

import type { Prompt } from '@sparesparrow/mcp-prompts-contracts';

/**
 * Default prompts data
 */
const defaultPrompts: Prompt[] = [
  {
    id: 'code-review',
    name: 'Code Review Assistant',
    content: `Review the following {{language}} code for:

1. **Security vulnerabilities**
2. **Performance optimizations** 
3. **Best practices adherence**
4. **Code quality issues**

Code:
\`\`\`{{language}}
{{code}}
\`\`\`

Please provide:
- Specific recommendations with examples
- Risk assessment for any security issues found
- Performance impact estimates where applicable`,
    isTemplate: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
    description: 'Analyzes code for security, performance, and best practices',
    category: 'Development',
    tags: ['code-review', 'security', 'performance', 'best-practices'],
    variables: [
      {
        name: 'language',
        description: 'Programming language of the code',
        required: true,
        type: 'string',
        options: ['typescript', 'javascript', 'python', 'java', 'go', 'rust']
      },
      {
        name: 'code', 
        description: 'Code to review',
        required: true,
        type: 'string'
      }
    ]
  },
  {
    id: 'api-docs',
    name: 'API Documentation Generator',
    content: `Generate comprehensive API documentation for:

**Endpoint:** {{method}} {{endpoint}}

**Parameters:**
{{parameters}}

Please include:
- Clear description of the endpoint's purpose
- Request/response examples with realistic data
- All possible HTTP status codes and their meanings
- Authentication requirements
- Rate limiting information
- Common error scenarios

Format as OpenAPI 3.0 specification.`,
    isTemplate: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
    description: 'Creates comprehensive API documentation from endpoint details',
    category: 'Documentation',
    tags: ['api', 'documentation', 'openapi', 'swagger'],
    variables: [
      {
        name: 'method',
        description: 'HTTP method',
        required: true,
        type: 'string',
        options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      },
      {
        name: 'endpoint',
        description: 'API endpoint path',
        required: true,
        type: 'string'
      },
      {
        name: 'parameters',
        description: 'Request parameters description',
        required: true,
        type: 'string'
      }
    ]
  },
  {
    id: 'sql-optimizer',
    name: 'SQL Query Optimizer',
    content: `Optimize this {{database_type}} SQL query for better performance:

\`\`\`sql
{{query}}
\`\`\`

**Database:** {{database_type}}
**Table size:** {{table_size}}
**Current performance issues:** {{performance_issues}}

Please provide:
1. **Optimized query** with explanations
2. **Index recommendations** (if applicable)
3. **Query execution plan analysis**
4. **Performance impact estimate**
5. **Alternative approaches** if query structure can be improved`,
    isTemplate: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    version: 1,
    description: 'Optimizes SQL queries for better performance',
    category: 'Database',
    tags: ['sql', 'optimization', 'database', 'performance'],
    variables: [
      {
        name: 'query',
        description: 'SQL query to optimize',
        required: true,
        type: 'string'
      },
      {
        name: 'database_type',
        description: 'Database system type',
        required: true,
        type: 'string',
        options: ['postgresql', 'mysql', 'sqlite', 'sql-server', 'oracle']
      },
      {
        name: 'table_size',
        description: 'Approximate table size',
        required: false,
        type: 'string',
        default: 'unknown'
      },
      {
        name: 'performance_issues',
        description: 'Known performance issues',
        required: false,
        type: 'string',
        default: 'slow execution time'
      }
    ]
  }
];

/**
 * Catalog interface for backward compatibility
 */
export interface PromptsCatalog {
  getCategories(): string[];
  listPrompts(category?: string): string[];
  loadPrompt(name: string, category?: string): Prompt | null;
  getAllPrompts(): Prompt[];
}

/**
 * Default catalog implementation
 */
export const catalog: PromptsCatalog = {
  getCategories(): string[] {
    const categories = new Set<string>();
    defaultPrompts.forEach(prompt => {
      if (prompt.category) {
        categories.add(prompt.category);
      }
    });
    return Array.from(categories).sort();
  },

  listPrompts(category?: string): string[] {
    return defaultPrompts
      .filter(prompt => !category || prompt.category === category)
      .map(prompt => prompt.name)
      .sort();
  },

  loadPrompt(name: string, category?: string): Prompt | null {
    return defaultPrompts.find(prompt => 
      prompt.name === name && (!category || prompt.category === category)
    ) || null;
  },

  getAllPrompts(): Prompt[] {
    return [...defaultPrompts];
  }
};

export default catalog;
