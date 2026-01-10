import * as fs from 'fs/promises';
import * as path from 'path';
import { ICatalogRepository } from '../../core/ports/catalog-repository.interface';

export class FileCatalogRepository implements ICatalogRepository {
  constructor(private catalogDir: string) {}

  async syncFromGitHub(repoUrl: string): Promise<void> {
    // File-based catalog doesn't support GitHub sync
    throw new Error('GitHub sync not supported in file-based catalog');
  }

  async getPromptTemplate(category: string, name: string): Promise<string> {
    const filePath = path.join(this.catalogDir, category, `${name}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const prompt = JSON.parse(content);
      return prompt.template || '';
    } catch (error) {
      throw new Error(`Prompt template not found: ${category}/${name}`);
    }
  }

  async getCatalogIndex(): Promise<any> {
    try {
      const categories = await fs.readdir(this.catalogDir);
      const index: any = {};

      for (const category of categories) {
        const categoryPath = path.join(this.catalogDir, category);
        const stat = await fs.stat(categoryPath);

        if (stat.isDirectory()) {
          const files = await fs.readdir(categoryPath);
          index[category] = files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        }
      }

      return index;
    } catch (error) {
      return {};
    }
  }

  async uploadPrompt(category: string, name: string, content: any): Promise<void> {
    const categoryPath = path.join(this.catalogDir, category);
    await fs.mkdir(categoryPath, { recursive: true });

    const filePath = path.join(categoryPath, `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  }

  async deletePrompt(category: string, name: string): Promise<void> {
    const filePath = path.join(this.catalogDir, category, `${name}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async listPrompts(category?: string): Promise<string[]> {
    if (category) {
      const categoryPath = path.join(this.catalogDir, category);
      try {
        const files = await fs.readdir(categoryPath);
        return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
      } catch (error) {
        return [];
      }
    } else {
      const index = await this.getCatalogIndex();
      const allPrompts: string[] = [];
      Object.entries(index).forEach(([cat, prompts]: [string, any]) => {
        prompts.forEach((prompt: string) => {
          allPrompts.push(`${cat}/${prompt}`);
        });
      });
      return allPrompts;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      await fs.access(this.catalogDir);
      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy', details: error };
    }
  }
}