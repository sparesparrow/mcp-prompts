import { IEventBus, PromptEvent } from '../../core/ports/event-bus.interface';

export class MemoryEventBus implements IEventBus {
  private handlers: Map<string, ((event: PromptEvent) => Promise<void>)[]> = new Map();

  async publish(event: PromptEvent): Promise<void> {
    // In-memory event bus - just log the event
    console.log('Event published:', event);

    // Call any registered handlers
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(handlers.map(handler => handler(event)));
  }

  subscribe(eventType: string, handler: (event: PromptEvent) => Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    return { status: 'healthy' };
  }
}