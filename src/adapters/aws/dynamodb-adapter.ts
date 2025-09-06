import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { IPromptRepository } from '../../core/ports/prompt-repository.interface';
import { Prompt } from '../../core/entities/prompt.entity';
import { PromptMetadata } from '../../core/entities/prompt-metadata.entity';

export class DynamoDBAdapter implements IPromptRepository {
  private client: DynamoDBClient;

  constructor(
    private tableName: string,
    private region: string = process.env.AWS_REGION || 'us-east-1'
  ) {
    this.client = new DynamoDBClient({ region: this.region });
  }

  async save(prompt: Prompt): Promise<void> {
    const item = marshall({
      id: prompt.id,
      version: prompt.version,
      name: prompt.name,
      description: prompt.description,
      template: prompt.template,
      category: prompt.category,
      tags: prompt.tags,
      variables: prompt.variables,
      created_at: prompt.createdAt.toISOString(),
      updated_at: prompt.updatedAt.toISOString(),
      is_latest: prompt.isLatest ? 'true' : 'false',
      metadata: prompt.metadata
    });

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: item
    });

    await this.client.send(command);
  }

  async findById(id: string, version?: string): Promise<Prompt | null> {
    const key = marshall({
      id: id,
      version: version || 'latest'
    });

    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: key
    });

    const result = await this.client.send(command);

    if (!result.Item) {
      return null;
    }

    const item = unmarshall(result.Item);
    return this.mapToPrompt(item);
  }

  async findByCategory(category: string, limit: number = 50): Promise<Prompt[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'category-index',
      KeyConditionExpression: 'category = :category',
      ExpressionAttributeValues: marshall({
        ':category': category
      }),
      Limit: limit,
      ScanIndexForward: false // Most recent first
    });

    const result = await this.client.send(command);

    return result.Items?.map(item => this.mapToPrompt(unmarshall(item))) || [];
  }

  async findLatestVersions(limit: number = 100): Promise<Prompt[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'latest-version-index',
      KeyConditionExpression: 'is_latest = :is_latest',
      ExpressionAttributeValues: marshall({
        ':is_latest': 'true'
      }),
      Limit: limit
    });

    const result = await this.client.send(command);

    return result.Items?.map(item => this.mapToPrompt(unmarshall(item))) || [];
  }

  async search(query: string, category?: string): Promise<Prompt[]> {
    let filterExpression = 'contains(#name, :query) OR contains(description, :query) OR contains(template, :query)';
    let expressionAttributeValues: any = {
      ':query': query
    };

    if (category) {
      filterExpression += ' AND category = :category';
      expressionAttributeValues[':category'] = category;
    }

    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: {
        '#name': 'name' // 'name' is a reserved keyword
      },
      ExpressionAttributeValues: marshall(expressionAttributeValues),
      Limit: 50
    });

    const result = await this.client.send(command);

    return result.Items?.map(item => this.mapToPrompt(unmarshall(item))) || [];
  }

  async update(id: string, version: string, updates: Partial<Prompt>): Promise<void> {
    const updateExpression: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    if (updates.name) {
      updateExpression.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = updates.name;
    }

    if (updates.description) {
      updateExpression.push('description = :description');
      expressionAttributeValues[':description'] = updates.description;
    }

    if (updates.template) {
      updateExpression.push('template = :template');
      expressionAttributeValues[':template'] = updates.template;
    }

    if (updates.category) {
      updateExpression.push('category = :category');
      expressionAttributeValues[':category'] = updates.category;
    }

    if (updates.tags) {
      updateExpression.push('tags = :tags');
      expressionAttributeValues[':tags'] = updates.tags;
    }

    if (updates.variables) {
      updateExpression.push('variables = :variables');
      expressionAttributeValues[':variables'] = updates.variables;
    }

    updateExpression.push('updated_at = :updated_at');
    expressionAttributeValues[':updated_at'] = new Date().toISOString();

    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({ id, version }),
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: marshall(expressionAttributeValues)
    });

    await this.client.send(command);
  }

  async delete(id: string, version?: string): Promise<void> {
    if (version) {
      // Delete specific version
      const command = new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ id, version })
      });
      await this.client.send(command);
    } else {
      // Delete all versions - first query all versions
      const queryCommand = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: marshall({ ':id': id })
      });

      const result = await this.client.send(queryCommand);

      // Delete each version
      for (const item of result.Items || []) {
        const unmarshalled = unmarshall(item);
        const deleteCommand = new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({ id: unmarshalled.id, version: unmarshalled.version })
        });
        await this.client.send(deleteCommand);
      }
    }
  }

  async getVersions(id: string): Promise<string[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: marshall({ ':id': id }),
      ProjectionExpression: 'version',
      ScanIndexForward: false
    });

    const result = await this.client.send(command);

    return result.Items?.map(item => unmarshall(item).version) || [];
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      // Simple table description call to check connectivity
      const command = new ScanCommand({
        TableName: this.tableName,
        Limit: 1
      });

      await this.client.send(command);

      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          tableName: this.tableName
        }
      };
    }
  }

  private mapToPrompt(item: any): Prompt {
    return new Prompt(
      item.id,
      item.name,
      item.description,
      item.template,
      item.category,
      item.tags || [],
      item.variables || [],
      item.version,
      new Date(item.created_at),
      new Date(item.updated_at),
      item.is_latest === 'true',
      item.metadata || {}
    );
  }
}
