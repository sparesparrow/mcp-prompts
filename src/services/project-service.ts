/**
 * Project Service
 * Manages projects in the MCP Prompts server
 */

import { v4 as uuidv4 } from 'uuid';
import { Config } from '../config.js';

/**
 * Project interface
 */
export interface Project {
  /**
   * Unique identifier for the project
   */
  id: string;
  
  /**
   * Name of the project
   */
  name: string;
  
  /**
   * Optional description of the project
   */
  description?: string;
  
  /**
   * Optional tags for categorization
   */
  tags?: string[];
  
  /**
   * Creation timestamp
   */
  createdAt?: string;
  
  /**
   * Last update timestamp
   */
  updatedAt?: string;
}

/**
 * Project service for managing projects
 */
export class ProjectService {
  private projects: Map<string, Project> = new Map();
  private config: Config;
  
  /**
   * Create a new project service
   * @param config Server configuration
   */
  constructor(config: Config) {
    this.config = config;
  }
  
  /**
   * Create a new project
   * @param project Project data
   * @returns Created project
   */
  async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: uuidv4(),
      ...project,
      createdAt: now,
      updatedAt: now,
    };
    
    this.projects.set(newProject.id, newProject);
    return newProject;
  }
  
  /**
   * Get a project by ID
   * @param id Project ID
   * @returns Project
   */
  async getProject(id: string): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }
    return project;
  }
  
  /**
   * List all projects with optional filtering
   * @param options Filter options
   * @returns List of projects
   */
  async listProjects(options: { tags?: string[], search?: string } = {}): Promise<Project[]> {
    let projects = Array.from(this.projects.values());
    
    // Filter by tags if provided
    if (options.tags && options.tags.length > 0) {
      projects = projects.filter(project => {
        if (!project.tags) return false;
        return options.tags!.some(tag => project.tags!.includes(tag));
      });
    }
    
    // Filter by search term if provided
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      projects = projects.filter(project => {
        return (
          project.name.toLowerCase().includes(searchTerm) ||
          (project.description && project.description.toLowerCase().includes(searchTerm))
        );
      });
    }
    
    return projects;
  }
  
  /**
   * Delete a project
   * @param id Project ID
   */
  async deleteProject(id: string): Promise<void> {
    if (!this.projects.has(id)) {
      throw new Error(`Project not found: ${id}`);
    }
    
    this.projects.delete(id);
  }
} 