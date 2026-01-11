import { SQSEvent, SQSHandler } from 'aws-lambda';
import { DynamoDBAdapter } from '../adapters/aws/dynamodb-adapter';
import { S3CatalogAdapter } from '../adapters/aws/s3-adapter';
import { PromptIndexingService } from '../core/services/prompt-indexing.service';
import { PromptEvent } from '../core/events/prompt.event';

// Initialize adapters
const promptRepository = new DynamoDBAdapter(process.env.PROMPTS_TABLE!);
const catalogRepository = new S3CatalogAdapter(process.env.PROMPTS_BUCKET!);
const indexingService = new PromptIndexingService(promptRepository, catalogRepository);

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  console.log('Processing SQS event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      const promptEvent = PromptEvent.fromJSON(messageBody);

      console.log(`Processing event: ${promptEvent.type} for prompt ${promptEvent.promptId}`);

      switch (promptEvent.type) {
        case 'prompt_created':
        case 'prompt_updated':
          await indexingService.indexPrompt(promptEvent.promptId);
          break;

        case 'prompt_deleted':
          await indexingService.removeFromIndex(promptEvent.promptId);
          break;

        case 'prompt_accessed':
          // Update usage statistics
          console.log(`Prompt accessed: ${promptEvent.promptId}`);
          break;

        default:
          console.warn(`Unknown event type: ${promptEvent.type}`);
      }

    } catch (error) {
      console.error('Error processing SQS record:', error);
      // The message will be retried or sent to DLQ based on configuration
      throw error;
    }
  }
};