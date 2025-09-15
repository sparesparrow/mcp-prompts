export interface PromptMetadata {
  author?: string;
  version?: string;
  license?: string;
  tags?: string[];
  language?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: string;
  dependencies?: string[];
  examples?: string[];
  notes?: string;
  lastModified?: Date;
  usage?: {
    count: number;
    lastUsed?: Date;
  };
}

export class PromptMetadataEntity {
  constructor(
    public readonly data: PromptMetadata
  ) {}

  public toJSON(): PromptMetadata {
    return this.data;
  }

  public static fromJSON(data: any): PromptMetadataEntity {
    return new PromptMetadataEntity(data as PromptMetadata);
  }
}