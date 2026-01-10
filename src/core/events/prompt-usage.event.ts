import { PromptEvent } from './prompt.event.js';

export class PromptUsageEvent extends PromptEvent {
  public readonly eventType: 'usage_started' | 'usage_completed' | 'usage_feedback';
  public readonly usageId: string;

  constructor(
    eventType: 'usage_started' | 'usage_completed' | 'usage_feedback',
    usageId: string,
    timestamp: Date,
    metadata: Record<string, any>
  ) {
    // Map usage events to prompt events for compatibility
    const promptEventType = eventType === 'usage_started' ? 'prompt_accessed' :
                           eventType === 'usage_completed' ? 'prompt_accessed' :
                           'prompt_accessed';
    super(promptEventType, usageId, timestamp, metadata);
    this.eventType = eventType;
    this.usageId = usageId;
  }

  toString(): string {
    return `PromptUsageEvent(${this.eventType}, ${this.usageId}, ${this.timestamp.toISOString()})`;
  }
}