import { SQSHandler, SQSEvent } from 'aws-lambda';
import { DynamoDBAdapter } from '../adapters/aws/dynamodb-adapter';
import { S3CatalogAdapter } from '../adapters/aws/s3-adapter';
import { PromptIndexingService } from '../core/services/prompt-indexing.service';
import { MetricsCollector } from '../monitoring/cloudwatch-metrics';

// Initialize adapters
const promptRepository = new DynamoDBAdapter(process.env.PROMPTS_TABLE!);
const catalogRepository = new S3CatalogAdapter(process.env.PROMPTS_BUCKET!);
const metricsCollector = new MetricsCollector();

// Initialize services
const indexingService = new PromptIndexingService(promptRepository, catalogRepository);

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  console.log('Processing SQS messages:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const startTime = Date.now();

    try {
      const messageBody = JSON.parse(record.body);
      console.log('Processing message:', messageBody);

      switch (messageBody.eventType) {
        case 'prompt.indexing.requested':
          await handlePromptIndexing(messageBody);
          break;

        case 'prompt.created':
          await handlePromptCreated(messageBody);
          break;

        case 'prompt.updated':
          await handlePromptUpdated(messageBody);
          break;

        case 'prompt.deleted':
          await handlePromptDeleted(messageBody);
          break;

        default:
          console.log('Unknown event type:', messageBody.eventType);
      }

      // Record success metrics
      const latency = Date.now() - startTime;
      await metricsCollector.recordProcessingLatency(messageBody.eventType, latency);
      await metricsCollector.recordProcessingSuccess(messageBody.eventType);

    } catch (error) {
      console.error('Error processing message:', error);

      const latency = Date.now() - startTime;
      await metricsCollector.recordProcessingLatency('error', latency);
      await metricsCollector.recordProcessingError('processing_error');

      // Re-throw to send message to DLQ
      throw error;
    }
  }
};

async function handlePromptIndexing(messageBody: any): Promise<void> {
  const { promptId, operation } = messageBody.payload;

  switch (operation) {
    case 'create':
    case 'update':
      await indexingService.indexPrompt(promptId);
      console.log(`Indexed prompt: ${promptId}`);
      break;

    case 'delete':
      await indexingService.removeFromIndex(promptId);
      console.log(`Removed from index: ${promptId}`);
      break;
  }
}

async function handlePromptCreated(messageBody: any): Promise<void> {
  const { promptId, category } = messageBody.payload;

  // Update category statistics
  await metricsCollector.recordPromptCreated(category);

  // Trigger indexing
  await indexingService.indexPrompt(promptId);

  console.log(`Processed prompt creation: ${promptId}`);
}

async function handlePromptUpdated(messageBody: any): Promise<void> {
  const { promptId, category } = messageBody.payload;

  // Update statistics
  await metricsCollector.recordPromptUpdated(category);

  // Re-index
  await indexingService.indexPrompt(promptId);

  console.log(`Processed prompt update: ${promptId}`);
}

async function handlePromptDeleted(messageBody: any): Promise<void> {
  const { promptId, category } = messageBody.payload;

  // Update statistics
  await metricsCollector.recordPromptDeleted(category);

  // Remove from index
  await indexingService.removeFromIndex(promptId);

  console.log(`Processed prompt deletion: ${promptId}`);
}
