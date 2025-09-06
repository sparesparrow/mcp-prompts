import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

export class MetricsCollector {
  private client: CloudWatchClient;

  constructor(private region: string = process.env.AWS_REGION || 'us-east-1') {
    this.client = new CloudWatchClient({ region: this.region });
  }

  async recordPromptAccess(promptId: string, category: string): Promise<void> {
    await this.putMetric('PromptAccessCount', 1, 'Count', [
      { Name: 'PromptId', Value: promptId },
      { Name: 'Category', Value: category }
    ]);
  }

  async recordLatency(operation: string, latencyMs: number): Promise<void> {
    await this.putMetric('OperationLatency', latencyMs, 'Milliseconds', [
      { Name: 'Operation', Value: operation }
    ]);
  }

  async recordApiSuccess(endpoint: string): Promise<void> {
    await this.putMetric('ApiSuccess', 1, 'Count', [
      { Name: 'Endpoint', Value: endpoint }
    ]);
  }

  async recordApiError(endpoint: string, statusCode: number): Promise<void> {
    await this.putMetric('ApiError', 1, 'Count', [
      { Name: 'Endpoint', Value: endpoint },
      { Name: 'StatusCode', Value: statusCode.toString() }
    ]);
  }

  async recordProcessingLatency(eventType: string, latencyMs: number): Promise<void> {
    await this.putMetric('ProcessingLatency', latencyMs, 'Milliseconds', [
      { Name: 'EventType', Value: eventType }
    ]);
  }

  async recordProcessingSuccess(eventType: string): Promise<void> {
    await this.putMetric('ProcessingSuccess', 1, 'Count', [
      { Name: 'EventType', Value: eventType }
    ]);
  }

  async recordProcessingError(errorType: string): Promise<void> {
    await this.putMetric('ProcessingError', 1, 'Count', [
      { Name: 'ErrorType', Value: errorType }
    ]);
  }

  async recordPromptCreated(category: string): Promise<void> {
    await this.putMetric('PromptCreated', 1, 'Count', [
      { Name: 'Category', Value: category }
    ]);
  }

  async recordPromptUpdated(category: string): Promise<void> {
    await this.putMetric('PromptUpdated', 1, 'Count', [
      { Name: 'Category', Value: category }
    ]);
  }

  async recordPromptDeleted(category: string): Promise<void> {
    await this.putMetric('PromptDeleted', 1, 'Count', [
      { Name: 'Category', Value: category }
    ]);
  }

  private async putMetric(
    metricName: string,
    value: number,
    unit: string,
    dimensions: Array<{ Name: string; Value: string }>
  ): Promise<void> {
    try {
      const command = new PutMetricDataCommand({
        Namespace: 'MCP/Prompts',
        MetricData: [{
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Dimensions: dimensions,
          Timestamp: new Date()
        }]
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Error putting metric:', error);
      // Don't throw - metrics shouldn't break the application
    }
  }
}
