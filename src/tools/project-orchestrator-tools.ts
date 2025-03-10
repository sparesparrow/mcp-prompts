/**
 * Project Orchestrator Tools for MCP Prompts Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from 'fs';
import path from 'path';
import { PromptService } from "../services/prompt-service.js";
import { FileAdapter } from "../adapters/file-adapter.js";
import { getConfig } from "../config.js";

/**
 * Setup project orchestrator tools for the MCP server
 * @param server MCP Server instance
 */
export function setupProjectOrchestratorTools(server: McpServer) {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  const storageAdapter = new FileAdapter(promptsDir);
  const promptService = new PromptService(storageAdapter);

  // Initialize orchestrator project template
  server.tool(
    "init_project_orchestrator",
    "Initialize project orchestrator templates",
    {},
    async () => {
      try {
        // Check if templates exist
        const templatesExist = await checkTemplatesExist(promptService);
        
        if (templatesExist) {
          return {
            content: [{ 
              type: "text", 
              text: "Project orchestrator templates already exist." 
            }]
          };
        }

        // Read template files from the template directory
        const templateDir = '/home/sparrow/.config/Claude/prompts/project-orchestrator';
        const projectOrchestratorTemplate = '/home/sparrow/.config/Claude/prompts/project-orchestrator-template.json';
        
        // Add main orchestrator template
        if (fs.existsSync(projectOrchestratorTemplate)) {
          const templateContent = fs.readFileSync(projectOrchestratorTemplate, 'utf-8');
          const template = JSON.parse(templateContent);
          await promptService.addPrompt(template);
        }

        // Add project templates
        if (fs.existsSync(path.join(templateDir, 'project-templates.json'))) {
          const projectTemplatesContent = fs.readFileSync(
            path.join(templateDir, 'project-templates.json'), 
            'utf-8'
          );
          const projectTemplates = JSON.parse(projectTemplatesContent);
          await promptService.addPrompt(projectTemplates);
        }

        // Add component templates
        if (fs.existsSync(path.join(templateDir, 'component-templates.json'))) {
          const componentTemplatesContent = fs.readFileSync(
            path.join(templateDir, 'component-templates.json'), 
            'utf-8'
          );
          const componentTemplates = JSON.parse(componentTemplatesContent);
          await promptService.addPrompt(componentTemplates);
        }

        return {
          content: [{ 
            type: "text", 
            text: "Project orchestrator templates initialized successfully." 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error initializing project orchestrator templates: ${error.message}` 
          }]
        };
      }
    }
  );

  // Create new project using orchestrator
  server.tool(
    "create_project",
    "Create a new project using the project orchestrator",
    {
      project_name: z.string(),
      project_idea: z.string(),
      design_patterns: z.string().optional(),
      project_template: z.string().optional(),
      output_directory: z.string().optional()
    },
    async (args) => {
      try {
        const { 
          project_name, 
          project_idea, 
          design_patterns = "Identify appropriate design patterns based on the project idea", 
          project_template = "Select an appropriate project template based on the project idea",
          output_directory = `/home/sparrow/projects/${project_name}`
        } = args;

        // Check if templates exist
        const templatesExist = await checkTemplatesExist(promptService);
        
        if (!templatesExist) {
          return {
            isError: true,
            content: [{ 
              type: "text", 
              text: "Project orchestrator templates not found. Please run init_project_orchestrator first." 
            }]
          };
        }

        // Apply the template
        const result = await promptService.applyTemplate('project-orchestrator-template', {
          project_idea,
          design_patterns,
          project_template
        });

        // Create output directory if it doesn't exist
        if (!fs.existsSync(output_directory)) {
          fs.mkdirSync(output_directory, { recursive: true });
        }

        // Create README.md with the project orchestration plan
        const readmePath = path.join(output_directory, 'README.md');
        fs.writeFileSync(readmePath, result.content);

        // Create basic project structure
        createBasicProjectStructure(output_directory, project_name);

        return {
          content: [{ 
            type: "text", 
            text: `Project "${project_name}" created successfully at ${output_directory}.\n\nA detailed implementation plan has been written to README.md. The basic project structure has been created.` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error creating project: ${error.message}` 
          }]
        };
      }
    }
  );

  // List available project templates
  server.tool(
    "list_project_templates",
    "List available project templates",
    {},
    async () => {
      try {
        // Get the project templates
        const templates = await promptService.getPrompt('Project Templates');
        
        if (!templates) {
          return {
            isError: true,
            content: [{ 
              type: "text", 
              text: "Project templates not found. Please run init_project_orchestrator first." 
            }]
          };
        }

        return {
          content: [{ 
            type: "text", 
            text: Array.isArray(templates.content) 
              ? `Available Project Templates:\n\n${templates.content.map((template: any) => 
                `- ${template.project_name}: ${template.description}`
                ).join('\n\n')}` 
              : `Available Project Templates:\n\n${templates.content}`
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error listing project templates: ${error.message}` 
          }]
        };
      }
    }
  );

  // List available component templates
  server.tool(
    "list_component_templates",
    "List available component templates",
    {},
    async () => {
      try {
        // Get the component templates
        const templates = await promptService.getPrompt('Component Templates');
        
        if (!templates) {
          return {
            isError: true,
            content: [{ 
              type: "text", 
              text: "Component templates not found. Please run init_project_orchestrator first." 
            }]
          };
        }

        return {
          content: [{ 
            type: "text", 
            text: Array.isArray(templates.content) 
              ? `Available Component Templates:\n\n${templates.content.map((template: any) => 
                `- ${template.name} (${template.type}): ${template.description}`
                ).join('\n\n')}` 
              : `Available Component Templates:\n\n${templates.content}`
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error listing component templates: ${error.message}` 
          }]
        };
      }
    }
  );
}

/**
 * Check if project orchestrator templates exist
 * @param promptService Prompt service instance
 * @returns Boolean indicating if templates exist
 */
async function checkTemplatesExist(promptService: PromptService): Promise<boolean> {
  try {
    const mainTemplate = await promptService.getPrompt('project-orchestrator-template');
    const projectTemplates = await promptService.getPrompt('Project Templates');
    const componentTemplates = await promptService.getPrompt('Component Templates');
    
    return Boolean(mainTemplate && projectTemplates && componentTemplates);
  } catch (error) {
    return false;
  }
}

/**
 * Create a basic project structure
 * @param outputDirectory Output directory path
 * @param projectName Project name
 */
function createBasicProjectStructure(outputDirectory: string, projectName: string): void {
  // Create common directories
  const directories = [
    'src',
    'tests',
    'docs',
    'config'
  ];

  for (const directory of directories) {
    const dirPath = path.join(outputDirectory, directory);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Create basic files
  const files: Record<string, string> = {
    '.gitignore': `# Node.js dependencies
node_modules/
npm-debug.log
yarn-error.log

# Build outputs
dist/
build/
out/

# Environment variables
.env
.env.local
.env.development
.env.test
.env.production

# IDE and editor files
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
`,
    'package.json': JSON.stringify({
      name: projectName.toLowerCase().replace(/\\s+/g, '-'),
      version: '0.1.0',
      description: `${projectName} generated by Project Orchestrator`,
      main: 'src/index.js',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1',
        start: 'node src/index.js'
      },
      author: '',
      license: 'MIT'
    }, null, 2),
    'src/index.js': `/**
 * ${projectName}
 * Generated by Project Orchestrator
 */

// Main entry point for the application
function main() {
  console.log("${projectName} starting...");
  // TODO: Implement application logic
}

main();
`
  };

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(outputDirectory, filePath);
    const dirPath = path.dirname(fullPath);
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content);
  }
}
