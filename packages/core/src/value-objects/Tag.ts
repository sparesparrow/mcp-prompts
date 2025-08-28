import { z } from 'zod';

/**
 * Tag value object - represents a tag for categorizing prompts
 * Uses regex validation for consistent format
 */
export class Tag {
  private readonly _value: string;

  // Tag validation regex: alphanumeric, hyphens, underscores, 2-50 chars
  private static readonly TAG_REGEX = /^[a-zA-Z0-9_-]{2,50}$/;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Creates a new Tag from a string
   */
  static fromString(value: string): Tag {
    if (!Tag.isValid(value)) {
      throw new Error(`Invalid tag format: ${value}. Tags must be 2-50 characters, alphanumeric, hyphens, or underscores only.`);
    }
    return new Tag(value.toLowerCase());
  }

  /**
   * Validates if a string is a valid tag
   */
  static isValid(value: string): boolean {
    return typeof value === 'string' && Tag.TAG_REGEX.test(value);
  }

  /**
   * Sanitizes a string to make it a valid tag
   */
  static sanitize(value: string): Tag {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    
    if (sanitized.length < 2) {
      throw new Error('Tag must be at least 2 characters long');
    }
    
    return new Tag(sanitized);
  }

  /**
   * Returns the string value of the Tag
   */
  toString(): string {
    return this._value;
  }

  /**
   * Returns the string value of the Tag
   */
  valueOf(): string {
    return this._value;
  }

  /**
   * Compares this Tag with another
   */
  equals(other: Tag): boolean {
    return this._value === other._value;
  }

  /**
   * Returns the hash code for this Tag
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

  /**
   * Checks if this tag matches a pattern
   */
  matches(pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return this._value.includes(pattern.toLowerCase());
    }
    return pattern.test(this._value);
  }
}

/**
 * Zod schema for Tag validation
 */
export const TagSchema = z.string().regex(Tag['TAG_REGEX']).transform(val => Tag.fromString(val));

/**
 * Type for Tag
 */
export type TagType = Tag;

/**
 * Type for array of tags
 */
export type Tags = Tag[];
