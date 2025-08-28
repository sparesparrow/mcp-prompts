import { z } from 'zod';

/**
 * TemplateVariable value object - represents a variable in a template prompt
 */
export class TemplateVariable {
  private readonly _name: string;
  private readonly _description?: string;
  private readonly _default?: string;
  private readonly _required: boolean;
  private readonly _type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  private readonly _options?: string[];

  private constructor(
    name: string,
    description?: string,
    defaultValue?: string,
    required = false,
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' = 'string',
    options?: string[]
  ) {
    this._name = name;
    this._description = description;
    this._default = defaultValue;
    this._required = required;
    this._type = type;
    this._options = options;
  }

  /**
   * Creates a new TemplateVariable from parameters
   */
  static create(
    name: string,
    description?: string,
    defaultValue?: string,
    required = false,
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' = 'string',
    options?: string[]
  ): TemplateVariable {
    if (!TemplateVariable.isValidName(name)) {
      throw new Error(`Invalid variable name: ${name}. Variable names must be alphanumeric and start with a letter.`);
    }
    return new TemplateVariable(name, description, defaultValue, required, type, options);
  }

  /**
   * Creates a TemplateVariable from a string (simple variable)
   */
  static fromString(name: string): TemplateVariable {
    return TemplateVariable.create(name);
  }

  /**
   * Creates a TemplateVariable from an object
   */
  static fromObject(obj: {
    name: string;
    description?: string;
    default?: string;
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
    options?: string[];
  }): TemplateVariable {
    return TemplateVariable.create(
      obj.name,
      obj.description,
      obj.default,
      obj.required,
      obj.type,
      obj.options
    );
  }

  /**
   * Validates if a variable name is valid
   */
  static isValidName(name: string): boolean {
    return typeof name === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && name.length <= 50;
  }

  /**
   * Gets the variable name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Gets the variable description
   */
  get description(): string | undefined {
    return this._description;
  }

  /**
   * Gets the default value
   */
  get default(): string | undefined {
    return this._default;
  }

  /**
   * Gets whether the variable is required
   */
  get required(): boolean {
    return this._required;
  }

  /**
   * Gets the variable type
   */
  get type(): 'string' | 'number' | 'boolean' | 'array' | 'object' {
    return this._type;
  }

  /**
   * Gets the possible options
   */
  get options(): string[] | undefined {
    return this._options;
  }

  /**
   * Converts to a plain object
   */
  toObject(): {
    name: string;
    description?: string;
    default?: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    options?: string[];
  } {
    return {
      name: this._name,
      description: this._description,
      default: this._default,
      required: this._required,
      type: this._type,
      options: this._options,
    };
  }

  /**
   * Converts to a string representation
   */
  toString(): string {
    return this._name;
  }

  /**
   * Compares this TemplateVariable with another
   */
  equals(other: TemplateVariable): boolean {
    return this._name === other._name &&
           this._description === other._description &&
           this._default === other._default &&
           this._required === other._required &&
           this._type === other._type &&
           JSON.stringify(this._options) === JSON.stringify(other._options);
  }

  /**
   * Creates a copy with updated properties
   */
  with(updates: Partial<{
    description: string;
    default: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    options: string[];
  }>): TemplateVariable {
    return TemplateVariable.create(
      this._name,
      updates.description ?? this._description,
      updates.default ?? this._default,
      updates.required ?? this._required,
      updates.type ?? this._type,
      updates.options ?? this._options
    );
  }
}

/**
 * Zod schema for TemplateVariable validation
 */
export const TemplateVariableSchema = z.union([
  z.string().transform(val => TemplateVariable.fromString(val)),
  z.object({
    name: z.string(),
    description: z.string().optional(),
    default: z.string().optional(),
    required: z.boolean().optional(),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']).optional(),
    options: z.array(z.string()).optional(),
  }).transform(obj => TemplateVariable.fromObject(obj))
]);

/**
 * Type for TemplateVariable
 */
export type TemplateVariableType = TemplateVariable;

/**
 * Type for array of template variables
 */
export type TemplateVariables = TemplateVariable[];
