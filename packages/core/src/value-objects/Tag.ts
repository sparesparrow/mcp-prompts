// Tag value object (string, regex validation)
export class Tag {
  private readonly value: string;
  // Only allow alphanumeric, dash, underscore, max 32 chars
  private static readonly TAG_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

  constructor(value: string) {
    if (!Tag.TAG_REGEX.test(value)) {
      throw new Error('Invalid tag format');
    }
    this.value = value;
  }

  toString() {
    return this.value;
  }
}
