export class Prompt {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly template: string,
    public readonly category: string,
    public readonly tags: string[] = [],
    public readonly variables: string[] = [],
    public readonly version: string = 'latest',
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
    public readonly isLatest: boolean = true,
    public readonly metadata: Record<string, any> = {}
  ) {}

  public toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      template: this.template,
      category: this.category,
      tags: this.tags,
      variables: this.variables,
      version: this.version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isLatest: this.isLatest,
      metadata: this.metadata
    };
  }
}
