import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { IEventBus } from '../../core/ports/event-bus.interface';
import { PromptEvent } from '../../core/events/prompt.event';

export class SQSAdapter implements IEventBus {
  private client: SQSClient;
  private handlers: Map<string, (event: PromptEvent) => Promise<void>> = new Map();

  constructor(
    private queueUrl: string,
    private region: string = process.env.AWS_REGION || 'us-east-1'
  ) {
    this.client = new SQSClient({ region: this.region });
  }

  async publish(event: PromptEvent): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(event.toJSON()),
      MessageAttributes: {
        EventType: {
          DataType: 'String',
          StringValue: event.type,
        },
        PromptId: {
          DataType: 'String',
          StringValue: event.promptId,
        },
        Timestamp: {
          DataType: 'String',
          StringValue: event.timestamp.toISOString(),
        },
      },
    });

    try {
      await this.client.send(command);
      console.log(`Published event: ${event.type} for prompt ${event.promptId}`);
    } catch (error) {
      console.error('Error publishing event to SQS:', error);
      throw error;
    }
  }

  subscribe(eventType: string, handler: (event: PromptEvent) => Promise<void>): void {
    this.handlers.set(eventType, handler);
    console.log(`Subscribed to event type: ${eventType}`);
  }

  async processMessages(): Promise<void> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
      MessageAttributeNames: ['All'],
    });

    try {
      const result = await this.client.send(command);

      for (const message of result.Messages || []) {
        try {
          const eventData = JSON.parse(message.Body || '{}');
          const event = PromptEvent.fromJSON(eventData);
          
          const handler = this.handlers.get(event.type);
          if (handler) {
            await handler(event);
            console.log(`Processed event: ${event.type} for prompt ${event.promptId}`);
          } else {
            console.warn(`No handler found for event type: ${event.type}`);
          }

          // Delete processed message
          await this.client.send(new DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: message.ReceiptHandle!,
          }));

        } catch (error) {
          console.error('Error processing message:', error);
          // Message will be retried or sent to DLQ based on configuration
        }
      }
    } catch (error) {
      console.error('Error receiving messages from SQS:', error);
      throw error;
    }
  }

  async enqueueIndexing(promptId: string, operation: 'create' | 'update' | 'delete'): Promise<void> {
    const event = new PromptEvent(
      operation === 'delete' ? 'prompt_deleted' : 
      operation === 'create' ? 'prompt_created' : 'prompt_updated',
      promptId,
      new Date(),
      { operation }
    );

    await this.publish(event);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      // Simple send message test
      const testCommand = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      });

      await this.client.send(testCommand);

      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          queueUrl: this.queueUrl,
        },
      };
    }
  }
}