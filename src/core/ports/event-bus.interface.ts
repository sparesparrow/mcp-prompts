export interface PromptEvent {
  type: 'prompt_created' | 'prompt_updated' | 'prompt_deleted' | 'prompt_accessed';
  promptId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IEventBus {
  publish(event: PromptEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: PromptEvent) => Promise<void>): void;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;
}