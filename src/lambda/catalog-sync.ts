import { SQSEvent, SQSHandler } from 'aws-lambda';
import { DynamoDBAdapter } from '../adapters/aws/dynamodb-adapter';
import { S3CatalogAdapter } from '../adapters/aws/s3-adapter';
import { PromptIndexingService } from '../core/services/prompt-indexing.service';

// Initialize adapters
const promptRepository = new DynamoDBAdapter(process.env.PROMPTS_TABLE!);
const catalogRepository = new S3CatalogAdapter(process.env.PROMPTS_BUCKET!);
const indexingService = new PromptIndexingService(promptRepository, catalogRepository);

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  console.log('Processing catalog sync event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      const repoUrl = messageBody.repoUrl || process.env.GITHUB_REPO_URL || 'https://github.com/sparesparrow/mcp-prompts-catalog';

      console.log(`Syncing catalog from: ${repoUrl}`);

      // Sync catalog from GitHub to S3
      await catalogRepository.syncFromGitHub(repoUrl);

      // Sync prompts from catalog to DynamoDB
      await indexingService.syncFromCatalog();

      console.log('Catalog sync completed successfully');

    } catch (error) {
      console.error('Error processing catalog sync:', error);
      throw error;
    }
  }
};