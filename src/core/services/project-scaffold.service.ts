#!/usr/bin/env node
/**
 * Project Scaffold Service
 *
 * Handles project creation from templates with variable substitution
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IPromptRepository } from '../ports/prompt-repository.interface';
import { IEventBus } from '../ports/event-bus.interface';
import { PromptEvent } from '../events/prompt.event';
import { ValidationError } from '../errors/custom-errors';

/**
 * Scaffold result
 */
export interface ScaffoldResult {
  projectId: string;
  projectPath: string;
  createdFiles: string[];
  createdDirectories: string[];
  variablesApplied: Record<string, any>;
  timestamp: Date;
}

/**
 * Project Scaffold Service
 */
export class ProjectScaffoldService {
  constructor(
    private promptRepository: IPromptRepository,
    private eventBus: IEventBus
  ) {}

  /**
   * Scaffold a new project from a template
   */
  async scaffoldProject(
    templateId: string,
    variables: Record<string, any>,
    outputPath: string
  ): Promise<ScaffoldResult> {
    try {
      // Validate template exists
      const template = await this.promptRepository.findById(templateId);
      if (!template) {
        throw new ValidationError(`Template not found: ${templateId}`);
      }

      // Validate template content exists
      const templateContent = template.template || '';
      if (!templateContent) {
        throw new ValidationError(`Template ${templateId} has no content`);
      }

      // Validate variables
      const validation = await this.validateVariables(templateId, variables);
      if (!validation.valid) {
        throw new ValidationError(`Invalid variables: ${validation.errors.join(', ')}`);
      }

      // Parse template structure
      const structure = this.parseTemplateStructure(templateContent);

      // Create output directory
      await fs.mkdir(outputPath, { recursive: true });

      // Create project structure
      const createdFiles: string[] = [];
      const createdDirectories: string[] = [];

      // Create directories
      for (const dir of structure.directories) {
        const dirPath = path.join(outputPath, this.applyVariables(dir, variables));
        await fs.mkdir(dirPath, { recursive: true });
        createdDirectories.push(dirPath);
      }

      // Create files
      for (const file of structure.files) {
        const filePath = path.join(outputPath, this.applyVariables(file.path, variables));
        const content = this.applyVariables(file.content, variables);

        // Ensure parent directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        createdFiles.push(filePath);
      }

      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const result: ScaffoldResult = {
        projectId,
        projectPath: outputPath,
        createdFiles,
        createdDirectories,
        variablesApplied: variables,
        timestamp: new Date()
      };

      await this.eventBus.publish(new PromptEvent('project_scaffolded', projectId, new Date(), {
        templateId,
        fileCount: createdFiles.length,
        directoryCount: createdDirectories.length
      }));

      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to scaffold project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply template with variables (without scaffolding)
   */
  async applyTemplate(templateContent: string, variables: Record<string, any>): Promise<string> {
    if (!templateContent || typeof templateContent !== 'string') {
      throw new ValidationError('Template content must be a non-empty string');
    }

    if (!variables || typeof variables !== 'object') {
      throw new ValidationError('Variables must be an object');
    }

    return this.applyVariables(templateContent, variables);
  }

  /**
   * Validate variables for a template
   */
  async validateVariables(
    templateId: string,
    variables: Record<string, any>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Get template
    const template = await this.promptRepository.findById(templateId);
    if (!template) {
      errors.push(`Template not found: ${templateId}`);
      return { valid: false, errors };
    }

    // Extract required variables from template content
    const requiredVars = this.extractRequiredVariables(template.template || '');

    // Check if all required variables are provided
    for (const requiredVar of requiredVars) {
      if (!(requiredVar in variables) || variables[requiredVar] === undefined) {
        errors.push(`Missing required variable: ${requiredVar}`);
      }
    }

    // Validate variable types if template has constraints
    // This is a simple implementation - can be extended with schema validation
    for (const [key, value] of Object.entries(variables)) {
      if (value === null) {
        errors.push(`Variable ${key} cannot be null`);
      }
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        if (!Array.isArray(value) && typeof value !== 'object') {
          errors.push(`Variable ${key} has invalid type: ${typeof value}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract required variables from template content
   */
  private extractRequiredVariables(content: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const matches = content.match(variablePattern) || [];
    return Array.from(new Set(matches.map(m => m.replace(/\{\{|\}\}/g, ''))));
  }

  /**
   * Parse template structure (directories and files)
   */
  private parseTemplateStructure(templateContent: string): {
    directories: string[];
    files: Array<{ path: string; content: string }>;
  } {
    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/d33ee5cc-2ed5-4c57-a04d-227ffe7b5c8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'project-scaffold.service.ts:188',message:'parsing template structure',data:{templateContentLength:templateContent.length,firstChars:templateContent.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'bug-fixes-test-3',hypothesisId:'bug1'})}).catch(()=>{});
    // #endregion agent log

    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(templateContent);
      if (parsed.directories && parsed.files) {
        return {
          directories: Array.isArray(parsed.directories) ? parsed.directories : [],
          files: Array.isArray(parsed.files) ? parsed.files : []
        };
      }
    } catch (jsonError) {
      // Not JSON, continue with other parsing attempts
    }

    // Try to parse as YAML (simplified implementation)
    // For now, fall back to extracting structure from template content
    const directories: string[] = [];
    const files: Array<{ path: string; content: string }> = [];

    // Extract file paths from template variables like {{file:path/to/file}}
    const fileMatches = templateContent.match(/\{\{file:([^}]+)\}\}/g);
    if (fileMatches) {
      for (const match of fileMatches) {
        const filePath = match.replace(/\{\{file:|\}\}/g, '');
        const dir = path.dirname(filePath);
        if (dir !== '.' && !directories.includes(dir)) {
          directories.push(dir);
        }
        files.push({
          path: filePath,
          content: `Content for ${filePath}` // Placeholder - would need proper template parsing
        });
      }
    }

    // If no files found in template, provide default structure
    if (files.length === 0) {
      directories.push('src', 'tests');
      files.push(
        {
          path: 'README.md',
          content: '# New Project\n\n{{description}}'
        },
        {
          path: 'package.json',
          content: '{\n  "name": "{{projectName}}"\n}'
        }
      );
    }

    return { directories, files };
  }

  /**
   * Apply variables to a string
   */
  private applyVariables(content: string, variables: Record<string, any>): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    return result;
  }
}
