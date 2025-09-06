import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { IEventBus } from '../../core/ports/event-bus.interface';
import { PromptEvent } from '../../core/events/prompt.event';

export class SQSAdapter implements IEventBus {
  private client: SQSClient;

  constructor(
    private queueUrl: string,
    private region: string = process.env.AWS_REGION || 'us-east-1'
  ) {
    this.client = new SQSClient({ region: this.region });
  }

  async publish(event: PromptEvent): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify({
        eventType: event.type,
        eventId: event.id,
        aggregateId: event.aggregateId,
        payload: event.payload,
        timestamp: event.timestamp.toISOString(),
        version: event.version
      }),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: event.type
        },
        aggregateId: {
          DataType: 'String',
          StringValue: event.aggregateId
        }
      }
    });

    await this.client.send(command);
  }

  async publishBatch(events: PromptEvent[]): Promise<void> {
    const entries = events.map((event, index) => ({
      Id: `${event.id}-${index}`,
      MessageBody: JSON.stringify({
        eventType: event.type,
        eventId: event.id,
        aggregateId: event.aggregateId,
        payload: event.payload,
        timestamp: event.timestamp.toISOString(),
        version: event.version
      }),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: event.type
        },
        aggregateId: {
          DataType: 'String',
          StringValue: event.aggregateId
        }
      }
    }));

    // SQS batch limit is 10 messages
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);

      const command = new SendMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: batch
      });

      await this.client.send(command);
    }
  }

  async receiveMessages(maxMessages: number = 10): Promise<any[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: Math.min(maxMessages, 10),
      WaitTimeSeconds: 20, // Long polling
      MessageAttributeNames: ['All']
    });

    const response = await this.client.send(command);

    return response.Messages?.map(msg => ({
      id: msg.MessageId,
      receiptHandle: msg.ReceiptHandle,
      body: JSON.parse(msg.Body || '{}'),
      attributes: msg.MessageAttributes
    })) || [];
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    });

    await this.client.send(command);
  }

  async enqueueIndexing(promptId: string, operation: 'create' | 'update' | 'delete'): Promise<void> {
    const event = new PromptEvent(
      'prompt.indexing.requested',
      promptId,
      {
        operation,
        promptId,
        requestedAt: new Date().toISOString()
      }
    );

    await this.publish(event);
  }

  async enqueueCatalogSync(repoUrl: string): Promise<void> {
    const event = new PromptEvent(
      'catalog.sync.requested',
      'catalog',
      {
        repoUrl,
        requestedAt: new Date().toISOString()
      }
    );

    await this.publish(event);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      // Try to receive messages (without waiting)
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0
      });

      await this.client.send(command);

      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          queueUrl: this.queueUrl
        }
      };
    }
  }
}
