/**
 * Unified Interface Definitions
 * Contains all interface definitions for the MCP Prompts Server
 */
/**
 * Format options for MutablePrompt conversion
 */
export var PromptFormat;
(function (PromptFormat) {
    /** Standard JSON format */
    PromptFormat["JSON"] = "json";
    /** Cursor Rules MDC format */
    PromptFormat["MDC"] = "mdc";
    /** PGAI format with embeddings support */
    PromptFormat["PGAI"] = "pgai";
    /** Dynamic template with variable placeholders */
    PromptFormat["TEMPLATE"] = "template";
})(PromptFormat || (PromptFormat = {}));
