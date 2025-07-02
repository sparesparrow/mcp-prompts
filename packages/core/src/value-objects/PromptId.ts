// PromptId value object (UUID v7)
export class PromptId {
  private readonly value: string;

  private static readonly UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(value: string) {
    if (!PromptId.UUID_V7_REGEX.test(value)) {
      throw new Error('Invalid UUID v7 format for PromptId');
    }
    this.value = value;
  }

  toString() {
    return this.value;
  }
}
