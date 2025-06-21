// IMcpService.aidl
package com.sparesparrow.mcp;

/**
 * The AIDL interface for the native MCP service.
 * This defines the contract for inter-process communication
 * between the Android UI and the Rust-based service logic.
 */
interface IMcpService {
    /**
     * Retrieves a specific prompt by its unique ID.
     * @param id The ID of the prompt to retrieve.
     * @return A JSON string representing the prompt, or an error string.
     */
    String getPrompt(in String id);

    /**
     * Applies a set of variables to a prompt template.
     * @param id The ID of the template.
     * @param jsonVariables A JSON string of key-value pairs for template substitution.
     * @return The rendered prompt as a JSON string, or an error string.
     */
    String applyTemplate(in String id, in String jsonVariables);

    /**
     * Lists all available prompts.
     * @return A JSON string representing a list of prompts.
     */
    String listPrompts();

    void setApiKey(String apiKey);
} 