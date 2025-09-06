import { Prompt } from '../entities/prompt.entity';

export interface IPromptRepository {
  save(prompt: Prompt): Promise<void>;
  findById(id: string, version?: string): Promise<Prompt | null>;
  findByCategory(category: string, limit?: number): Promise<Prompt[]>;
  findLatestVersions(limit?: number): Promise<Prompt[]>;
  search(query: string, category?: string): Promise<Prompt[]>;
  update(id: string, version: string, updates: Partial<Prompt>): Promise<void>;
  delete(id: string, version?: string): Promise<void>;
  getVersions(id: string): Promise<string[]>;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;
}
