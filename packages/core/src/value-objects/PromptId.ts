import { z } from 'zod';

/**
 * PromptId value object - represents a unique identifier for prompts
 * Uses UUID v7 for better performance and uniqueness
 */
export class PromptId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Creates a new PromptId from a string
   */
  static fromString(value: string): PromptId {
    if (!PromptId.isValid(value)) {
      throw new Error(`Invalid prompt ID format: ${value}`);
    }
    return new PromptId(value);
  }

  /**
   * Generates a new UUID v7 PromptId
   */
  static generate(): PromptId {
    // Simple UUID v7-like generation for now
    // In production, use a proper UUID v7 library
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const uuid = `${timestamp.toString(16)}-${random}`;
    return new PromptId(uuid);
  }

  /**
   * Generates a PromptId from a name (slugified)
   */
  static fromName(name: string): PromptId {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
    return new PromptId(slug);
  }

  /**
   * Validates if a string is a valid prompt ID
   */
  static isValid(value: string): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= 100;
  }

  /**
   * Returns the string value of the PromptId
   */
  toString(): string {
    return this._value;
  }

  /**
   * Returns the string value of the PromptId
   */
  valueOf(): string {
    return this._value;
  }

  /**
   * Compares this PromptId with another
   */
  equals(other: PromptId): boolean {
    return this._value === other._value;
  }

  /**
   * Returns the hash code for this PromptId
   */
  hashCode(): number {
    let hash = 0;
    for (let i = 0; i < this._value.length; i++) {
      const char = this._value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

/**
 * Zod schema for PromptId validation
 */
export const PromptIdSchema = z.string().min(1).max(100).transform(val => PromptId.fromString(val));

/**
 * Type for PromptId
 */
export type PromptIdType = PromptId;
