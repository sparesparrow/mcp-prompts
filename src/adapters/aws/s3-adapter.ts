import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ICatalogRepository } from '../../core/ports/catalog-repository.interface';

export class S3CatalogAdapter implements ICatalogRepository {
  private client: S3Client;

  constructor(
    private bucketName: string,
    private region: string = process.env.AWS_REGION || 'us-east-1'
  ) {
    this.client = new S3Client({ region: this.region });
  }

  async syncFromGitHub(repoUrl: string): Promise<void> {
    try {
      // Download catalog index from GitHub
      const response = await fetch(`${repoUrl}/raw/main/prompts/index.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
      }

      const catalog = await response.json();

      // Upload catalog index to S3
      await this.uploadObject('catalog/index.json', JSON.stringify(catalog, null, 2), 'application/json');

      // Sync individual prompt files
      for (const category of Object.keys(catalog.categories || {})) {
        const categoryPrompts = catalog.categories[category];

        for (const promptName of Object.keys(categoryPrompts)) {
          const promptData = categoryPrompts[promptName];

          // Download prompt file from GitHub
          const promptResponse = await fetch(`${repoUrl}/raw/main/prompts/${category}/${promptName}.json`);
          if (promptResponse.ok) {
            const promptContent = await promptResponse.text();
            await this.uploadObject(`prompts/${category}/${promptName}.json`, promptContent, 'application/json');
          }
        }
      }

      console.log('Successfully synced catalog from GitHub to S3');
    } catch (error) {
      console.error('Error syncing catalog from GitHub:', error);
      throw error;
    }
  }

  async getPromptTemplate(category: string, name: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: `prompts/${category}/${name}.json`
    });

    try {
      const response = await this.client.send(command);
      const content = await response.Body?.transformToString();

      if (!content) {
        throw new Error('Empty response from S3');
      }

      const promptData = JSON.parse(content);
      return promptData.template || promptData.content || content;
    } catch (error) {
      console.error(`Error getting prompt template ${category}/${name}:`, error);
      throw error;
    }
  }

  async getCatalogIndex(): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: 'catalog/index.json'
    });

    try {
      const response = await this.client.send(command);
      const content = await response.Body?.transformToString();

      if (!content) {
        return { categories: {} };
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Error getting catalog index:', error);
      return { categories: {} };
    }
  }

  async uploadPrompt(category: string, name: string, content: any): Promise<void> {
    const key = `prompts/${category}/${name}.json`;
    const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    await this.uploadObject(key, body, 'application/json');
  }

  async deletePrompt(category: string, name: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: `prompts/${category}/${name}.json`
    });

    await this.client.send(command);
  }

  async listPrompts(category?: string): Promise<string[]> {
    const prefix = category ? `prompts/${category}/` : 'prompts/';

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix
    });

    const response = await this.client.send(command);

    return response.Contents?.map(obj => {
      const key = obj.Key || '';
      return key.replace(prefix, '').replace('.json', '');
    }) || [];
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      // Simple list operation to check connectivity
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1
      });

      await this.client.send(command);

      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          bucketName: this.bucketName
        }
      };
    }
  }

  private async uploadObject(key: string, body: string, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'max-age=3600' // 1 hour cache
    });

    await this.client.send(command);
  }
}
