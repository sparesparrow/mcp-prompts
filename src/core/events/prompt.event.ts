export class PromptEvent {
  constructor(
    public readonly type: 'prompt_created' | 'prompt_updated' | 'prompt_deleted' | 'prompt_accessed',
    public readonly promptId: string,
    public readonly timestamp: Date = new Date(),
    public readonly metadata: Record<string, any> = {}
  ) {}

  public toJSON(): any {
    return {
      type: this.type,
      promptId: this.promptId,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata
    };
  }

  public static fromJSON(data: any): PromptEvent {
    return new PromptEvent(
      data.type,
      data.promptId,
      new Date(data.timestamp),
      data.metadata || {}
    );
  }
}