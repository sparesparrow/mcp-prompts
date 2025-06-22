import { z } from 'zod';
/**
 * Schemas for prompt-related API requests, derived from a base schema
 * to ensure consistency.
 */
export declare const promptSchemas: {
    applyTemplate: z.ZodObject<{
        id: z.ZodString;
        variables: z.ZodRecord<z.ZodString, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        variables: Record<string, string>;
        id: string;
    }, {
        variables: Record<string, string>;
        id: string;
    }>;
    /**
     * Schema for creating a new prompt. All fields from the base schema are required.
     */
    create: z.ZodObject<{
        category: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        isTemplate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        name: z.ZodString;
        tags: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
        variables: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            type: z.ZodOptional<z.ZodEnum<["string", "number", "boolean", "array", "object"]>>;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }>]>, "many">>>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        content: string;
        isTemplate: boolean;
        description?: string | undefined;
        category?: string | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }, {
        name: string;
        content: string;
        description?: string | undefined;
        category?: string | undefined;
        isTemplate?: boolean | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }>;
    delete: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    /**
     * Schema for a full prompt object, including server-side fields.
     */
    full: z.ZodObject<{
        category: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        isTemplate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        name: z.ZodString;
        tags: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
        variables: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            type: z.ZodOptional<z.ZodEnum<["string", "number", "boolean", "array", "object"]>>;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }>]>, "many">>>;
    } & {
        createdAt: z.ZodString;
        id: z.ZodString;
        updatedAt: z.ZodString;
        version: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        name: string;
        content: string;
        isTemplate: boolean;
        createdAt: string;
        id: string;
        updatedAt: string;
        version: number;
        description?: string | undefined;
        category?: string | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }, {
        name: string;
        content: string;
        createdAt: string;
        id: string;
        updatedAt: string;
        version: number;
        description?: string | undefined;
        category?: string | undefined;
        isTemplate?: boolean | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }>;
    get: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    list: z.ZodObject<{
        category: z.ZodOptional<z.ZodString>;
        isTemplate: z.ZodOptional<z.ZodBoolean>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        category?: string | undefined;
        isTemplate?: boolean | undefined;
        tags?: string[] | undefined;
    }, {
        category?: string | undefined;
        isTemplate?: boolean | undefined;
        tags?: string[] | undefined;
    }>;
    /**
     * Schema for updating an existing prompt. All fields are optional.
     */
    update: z.ZodObject<{
        category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        content: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        isTemplate: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;
        metadata: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
        name: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>>;
        variables: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            type: z.ZodOptional<z.ZodEnum<["string", "number", "boolean", "array", "object"]>>;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }>]>, "many">>>>;
    }, "strict", z.ZodTypeAny, {
        name?: string | undefined;
        description?: string | undefined;
        category?: string | undefined;
        content?: string | undefined;
        isTemplate?: boolean | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }, {
        name?: string | undefined;
        description?: string | undefined;
        category?: string | undefined;
        content?: string | undefined;
        isTemplate?: boolean | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }>;
    bulkCreate: z.ZodArray<z.ZodObject<{
        category: z.ZodOptional<z.ZodString>;
        content: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        isTemplate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        name: z.ZodString;
        tags: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
        variables: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            type: z.ZodOptional<z.ZodEnum<["string", "number", "boolean", "array", "object"]>>;
            options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }, {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        }>]>, "many">>>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        content: string;
        isTemplate: boolean;
        description?: string | undefined;
        category?: string | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }, {
        name: string;
        content: string;
        description?: string | undefined;
        category?: string | undefined;
        isTemplate?: boolean | undefined;
        metadata?: Record<string, unknown> | null | undefined;
        tags?: string[] | null | undefined;
        variables?: (string | {
            name: string;
            options?: string[] | undefined;
            type?: "string" | "number" | "boolean" | "object" | "array" | undefined;
            description?: string | undefined;
            default?: string | undefined;
            required?: boolean | undefined;
        })[] | null | undefined;
    }>, "many">;
    bulkDelete: z.ZodObject<{
        ids: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        ids: string[];
    }, {
        ids: string[];
    }>;
};
export type CreatePromptArgs = z.infer<typeof promptSchemas.create>;
export type UpdatePromptArgs = z.infer<typeof promptSchemas.update>;
export type DeletePromptArgs = z.infer<typeof promptSchemas.delete>;
export type ListPromptsArgs = z.infer<typeof promptSchemas.list>;
/**
 * Zod schema for Workflow definitions (MVP).
 *
 * Top-level fields:
 * - id: string (unique workflow ID)
 * - name: string (human-readable name)
 * - version: number (schema version)
 * - variables: object (optional, key-value pairs for workflow-wide variables)
 * - steps: array of step objects (see below)
 *
 * Step object (discriminated by 'type'):
 * - id: string (unique step ID)
 * - type: 'prompt' | 'shell' | 'http'
 * - prompt: { promptId, input, output } (for type 'prompt')
 * - shell: { command, output } (for type 'shell')
 * - http: { method, url, body?, output } (for type 'http')
 * - condition: string (optional, expression to determine if step runs)
 * - errorPolicy: string (optional, e.g., 'continue', 'abort', 'retry<n>')
 *
 * All step types support 'output', 'condition', and 'errorPolicy'.
 */
export declare const workflowStepSchema: z.ZodTypeAny;
export declare const workflowSchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    steps: z.ZodArray<z.ZodTypeAny, "atleastone">;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>>;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    version: number;
    steps: [any, ...any[]];
    variables?: Record<string, string | number | boolean | null> | undefined;
}, {
    name: string;
    id: string;
    version: number;
    steps: [any, ...any[]];
    variables?: Record<string, string | number | boolean | null> | undefined;
}>, {
    name: string;
    id: string;
    version: number;
    steps: [any, ...any[]];
    variables?: Record<string, string | number | boolean | null> | undefined;
}, {
    name: string;
    id: string;
    version: number;
    steps: [any, ...any[]];
    variables?: Record<string, string | number | boolean | null> | undefined;
}>;
