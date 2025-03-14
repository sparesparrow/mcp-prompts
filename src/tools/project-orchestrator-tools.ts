/**
 * Project Orchestrator Tools for MCP Prompts Server
 * Implements tools for project orchestration and management
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FileAdapter } from '../adapters/file-adapter.js';
import { PromptService } from '../services/prompt-service.js';
import { ProjectService } from '../services/project-service.js';
import { getConfig } from '../config.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if project orchestrator templates exist
 * @param promptService Prompt service instance
 */
async function checkTemplatesExist(promptService: PromptService): Promise<boolean> {
  try {
    const orchestratorTemplate = await promptService.getPrompt('project-orchestrator-template');
    return !!orchestratorTemplate;
  } catch (error) {
    return false;
  }
}

/**
 * Create basic project structure
 * @param directory Project directory
 * @param projectName Project name
 */
function createBasicProjectStructure(directory: string, projectName: string): void {
  // Create src directory
  const srcDir = path.join(directory, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }
  
  // Create package.json if it doesn't exist
  const packageJsonPath = path.join(directory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    const packageJson = {
      name: projectName,
      version: '0.1.0',
      description: `${projectName} - Created with MCP Project Orchestrator`,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        test: 'echo "Error: no test specified" && exit 1'
      },
      author: '',
      license: 'MIT'
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
  }
  
  // Create empty index.js if it doesn't exist
  const indexPath = path.join(directory, 'index.js');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, '// Main entry point\n', 'utf8');
  }
}

/**
 * Setup project orchestrator tools for the MCP server
 * @param server MCP Server instance
 */
export async function setupProjectOrchestratorTools(server: McpServer): Promise<void> {
  const config = getConfig();
  const promptsDir = config.storage.promptsDir;
  const storageAdapter = new FileAdapter(promptsDir);
  const promptService = new PromptService(storageAdapter);
  
  // Initialize project service
  const projectService = new ProjectService(config);
  
  // Initialize orchestrator project template
  server.tool(
    "init_project_orchestrator",
    "Initialize project orchestrator templates",
    z.object({}),
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

  // Create project from template
  server.tool(
    "create_project_from_template",
    "Create a new project using the project orchestrator",
    z.object({
      project_name: z.string(),
      project_idea: z.string(),
      design_patterns: z.string().optional(),
      project_template: z.string().optional(),
      output_directory: z.string().optional()
    }),
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
    z.object({}),
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
    z.object({}),
    async () => {
      try {
        // Implementation here
        return {
          content: [{ 
            type: "text", 
            text: "Component templates listing not implemented yet." 
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

  // Create project tool
  server.tool(
    "create_project",
    "Create a new project",
    z.object({
      name: z.string(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    async ({ name, description, tags }) => {
      try {
        // Create project data with the correct types
        const projectData: {
          name: string;
          description?: string;
          tags?: string[];
        } = {
          name
        };
        
        // Only add description if it's a non-empty string
        if (typeof description === 'string') {
          projectData.description = description;
        }
        
        // Only add tags if they exist
        if (Array.isArray(tags)) {
          projectData.tags = tags;
        }
        
        const project = await projectService.createProject(projectData);
        
        return {
          content: [{ 
            type: "text", 
            text: `Project created with ID: ${project.id}` 
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
  
  // Get project tool
  server.tool(
    "get_project",
    "Get a project by ID",
    z.object({
      id: z.string(),
    }),
    async ({ id }) => {
      try {
        const project = await projectService.getProject(id);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(project, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error retrieving project: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // List projects tool
  server.tool(
    "list_projects",
    "List all projects",
    z.object({
      tags: z.array(z.string()).optional(),
      search: z.string().optional(),
    }),
    async (args) => {
      // Provide default values if args is undefined
      const { tags, search } = args || {};
      
      try {
        const projects = await projectService.listProjects({ tags, search });
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(projects, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error listing projects: ${error.message}` 
          }]
        };
      }
    }
  );
}
