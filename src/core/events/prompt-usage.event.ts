export class PromptUsageEvent {
  constructor(
    public readonly eventType: 'usage_started' | 'usage_completed' | 'usage_feedback',
    public readonly usageId: string,
    public readonly timestamp: Date,
    public readonly metadata: Record<string, any>
  ) {}

  toString(): string {
    return `PromptUsageEvent(${this.eventType}, ${this.usageId}, ${this.timestamp.toISOString()})`;
  }
}