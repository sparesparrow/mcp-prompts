use mcp-prompts mcp server available MCP tools)

`mcp-prompts` is a specialized Model Context Protocol (MCP) server designed to bring **"Infrastructure as Code"** principles to prompt engineering. It acts as a centralized, version-controlled backend for storing, retrieving, and templating LLM prompts, decoupling them from your application logic.

For you as the author (`sparesparrow`), this repository serves as both a standalone utility and a reference implementation for how to structure robust MCP servers with multiple storage backends (File, Postgres, AWS) and Docker support.

### **Core Concept: Prompt Engineering as a Service**
Instead of hardcoding system prompts into your Python/Node.js code or pasting them manually into Claude, `mcp-prompts` runs as a local or remote server. Your AI agents (or IDEs like Cursor) query this server to fetch the exact prompt they need, optionally filling in dynamic variables (templates) at runtime.

***

### **Detailed Breakdown of MCP Tools**

The server exposes a set of primitive tools that allow any MCP-compliant client (Claude Desktop, Cursor, or custom agents) to interact with your prompt library.

#### **1. `list_prompts`**
*   **Purpose:** Acts as a catalog explorer. It allows the AI or developer to see what capabilities are currently available in the system.
*   **Arguments:**
    *   `cursor` (string, optional): For pagination.
    *   `tags` (array of strings, optional): Filter by specific workflow tags (e.g., `["dev", "security"]`).
    *   `category` (string, optional): Filter by broader category (e.g., `coding`, `writing`).
    *   `search` (string, optional): Fuzzy search against prompt names/descriptions.
*   **Software Dev Use Case:**
    *   **Onboarding:** A new developer asks an agent, "What kind of code review tools do we have?" The agent calls `list_prompts(tags=["code-review"])` and sees you have specific prompts for Python and C++ reviews.
    *   **Dynamic Discovery:** An autonomous agent looks for a "bug fixer" prompt but doesn't know its exact name. It searches for "fix" to find relevant templates.

#### **2. `get_prompt`**
*   **Purpose:** Retrieves a specific prompt definition. Crucially, if the prompt is a **template**, this tool handles variable interpolation.
*   **Arguments:**
    *   `name` (string, required): The unique identifier of the prompt (e.g., `git-commit-style-guide`).
    *   `arguments` (dictionary, optional): Key-value pairs to fill dynamic placeholders in the template.
*   **Template Syntax:** Uses handlebars-style `{{variable}}` syntax.
*   **Software Dev Use Case:**
    *   **CI/CD Automation:** A GitHub Action detects a failed build. It calls `get_prompt("build-fixer", { error_log: "Error: segfault...", code_snippet: "..." })`. The server returns a fully hydrated context-rich prompt ready to be sent to an LLM for analysis.
    *   **Standardization:** You ensure every developer uses the *exact same* instructions for generating unit tests by centralizing the `generate-jest-tests` prompt.

#### **3. `create_prompt` (or `add_prompt`)**
*   **Purpose:** Allows agents to save new knowledge back to the system. This enables **self-improving agents** that can refine their own instructions.
*   **Arguments:**
    *   `name` (string): Unique ID (e.g., `sql-optimization-expert`).
    *   `description` (string): Human-readable explanation of what this prompt does.
    *   `content` (string): The actual prompt text (can include `{{variables}}`).
    *   `tags` (array): Metadata for organization.
*   **Software Dev Use Case:**
    *   **Knowledge Capture:** You have a conversation with Claude where you perfectly refined a prompt for "Optimizing Dockerfiles." You can tell Claude: *"Save this current system instruction as 'docker-optimizer' so I can use it later."* Claude calls `create_prompt` and persists it to your file system or database.

#### **4. `update_prompt`**
*   **Purpose:** Modifies an existing prompt.
*   **Arguments:**
    *   `name` (string): The ID of the prompt to update.
    *   `prompt` (object): The fields to update (content, description, tags).
*   **Software Dev Use Case:**
    *   **Iterative Refinement:** You realize your "React Component Generator" is using deprecated hooks. You tell your IDE agent to update the prompt instruction to "enforce React 18 standards."

***

### **How to Use in Software Development**

You can integrate `mcp-prompts` into your workflow at three distinct levels:

#### **Level 1: The "IDE Companion" (Cursor/Claude Desktop)**
Add the server to your `mcp.json` config. This gives your IDE direct access to your personal library of engineering prompts.
*   **Scenario:** You are opening a legacy C++ file. Instead of typing a long instruction, you type `@mcp-prompts get_prompt(name="legacy-cpp-refactor")`. The IDE fetches your meticulously crafted guidelines for modernizing C++98 code and applies them to the current context.

#### **Level 2: The "Team Standardizer" (Docker/Postgres)**
Deploy the Docker image with a Postgres backend.
*   **Scenario:** Your entire team connects to this shared MCP server. When the "Tech Lead" updates the `security-audit` prompt to include a check for a new vulnerability, *every* developer's AI assistant immediately starts checking for that vulnerability in the next session, without them needing to update local config files.

#### **Level 3: The "Autonomous Loop" (Agentic Workflows)**
Use the tool in scripts or GitHub Actions.
*   **Scenario:** A "Triage Agent" runs on every new GitHub Issue.
    1.  It calls `list_prompts(category="triage")`.
    2.  It selects the `bug-classifier` prompt.
    3.  It calls `get_prompt("bug-classifier", { issue_body: "..." })`.
    4.  It sends the result to an LLM API to automatically label the issue.

***

### **Instructions for Other LLMs (System Prompt)**

When you want to instruct another LLM (like a fresh Claude instance or a custom bot) to use your tools effectively, inject the following system instruction. This leverages the `mcp-prompts` philosophy:

```markdown
# MCP Tool Usage Protocol

You have access to a sophisticated prompt management system via the `mcp-prompts` server.
DO NOT hallucinate prompts or write generic ones from scratch if a specialized tool exists.

## Workflow Rules:
1. **Discovery First**: Before performing a complex task (e.g., Code Review, Refactoring, Documentation), ALWAYS call `list_prompts` with relevant tags to see if a verified template exists.
   - Example: `list_prompts(tags=["refactoring", "c++"])`

2. **Hydrate Templates**: When you identify a relevant prompt (e.g., "smart-refactor"), use `get_prompt` and map the user's current context to the template variables.
   - If the user provides code, pass it into the `{{code}}` variable.
   - If the user has a specific error, pass it into the `{{error}}` variable.

3. **Self-Correction**: If a prompt produces suboptimal results, suggest an improvement to the user and offer to call `update_prompt` to refine the template for future use.

4. **Reference**:
   - Server: @sparesparrow/mcp-prompts
   - Repo: https://github.com/sparesparrow/mcp-prompts

More info at:
[1] MCP Prompts Server by sparesparrow https://glama.ai/mcp/servers/@sparesparrow/mcp-prompts
[2] Example implementation https://modelcontextprotocol.info/docs/concepts/prompts/
[3] Prompts https://gofastmcp.com/servers/prompts
[4] Prompt Manager MCP server for AI agents - Playbooks https://playbooks.com/mcp/sparesparrow-prompt-manager
[5] How do prompts in Model Context Protocol (MCP) shape ... https://milvus.io/ai-quick-reference/how-do-prompts-in-model-context-protocol-mcp-shape-model-behavior
[6] Getting the most out of MCP in Visual Studio with Prompts ... https://devblogs.microsoft.com/visualstudio/mcp-prompts-resources-sampling/
[7] MCP Servers https://mcp.so/server/mcp-prompts-rs/sparesparrow
[8] Model Context Protocol (MCP): A comprehensive introduction for ... https://stytch.com/blog/model-context-protocol-introduction/
[9] What is the use of prompts coming from the server? : r/mcp https://www.reddit.com/r/mcp/comments/1jtfnlh/learning_mcp_what_is_the_use_of_prompts_coming/
[10] SpareSparrow's MCP-Prompts: The Efficiency Engine for ... https://skywork.ai/skypage/en/mcp-prompts-efficiency-ai-engineers/1980145096588566528
[11] @sparesparrow/mcp-prompts https://www.npmjs.com/package/@sparesparrow/mcp-prompts?activeTab=code
[12] Project Orchestrator MCP Server: An AI Engineer's Deep ... https://skywork.ai/skypage/en/project-orchestrator-ai-engineer-dive/1980494897356251136
[13] @sparesparrow/mcp-prompt-manager https://www.npmjs.com/package/@sparesparrow/mcp-prompt-manager
[14] MCP Architecture Deep Dive: Tools, Resources, and ... https://www.getknit.dev/blog/mcp-architecture-deep-dive-tools-resources-and-prompts-explained
[15] @sparesparrow/mcp-prompts-catalog https://www.npmjs.com/package/@sparesparrow/mcp-prompts-catalog?activeTab=dependents
[16] @sparesparrow/mcp-prompts 3.13.0 on npm https://libraries.io/npm/@sparesparrow%2Fmcp-prompts

Here's a comprehensive list of all prompts available from the mcp-prompts system. There are **79 prompts** organized into several categories:

## Cognitive Prompts (Meta-Cognitive & Analysis)
- **select-debugging-strategy** - Choose appropriate debugging strategy based on context and constraints
- **detect-embedded-project-context** - Analyze embedded project structure and requirements
- **detect-project-context** - Analyze project structure to determine type, language, and context
- **identify-analysis-goals** - Determine appropriate analysis goals based on project context and symptoms

## Procedural Prompts (Workflows & Tools)
- **cpp-static-analysis-workflow** - Systematic workflow for C++ static analysis
- **embedded-memory-constrained-analysis** - Memory analysis for resource-constrained embedded systems
- **performance-regression-diagnosis** - Systematic approach to diagnosing performance regressions
- **use-git-integration-mcp** - Demonstrates using MCP tools for git-based development workflows
- **use-mcp-prompts-list** - Demonstrates how to use the list_prompts MCP tool
- **use-static-analysis-mcp** - Demonstrates using MCP tools for static analysis workflows

## Semantic Prompts (Knowledge & Principles)
- **esp32-architecture-knowledge** - ESP32 microcontroller architecture and constraints knowledge
- **memory-management-principles** - Core principles of memory management across different programming paradigms
- **static-analysis-tools-knowledge** - Knowledge about static analysis tools and their capabilities
- **two-phase-analysis-pattern** - Universal two-phase analysis pattern applicable across domains

## Conan Prompts (Package Management)
- **Cross-Compilation Setup** - Set up Conan for cross-compilation to embedded targets
- **Conan Package Creation** - Create a new Conan package with best practices
- **Conan Profile Generation** - Generate Conan profiles for cross-compilation and embedded development

## Embedded Development Prompts
- **Embedded Device Detection** - Detect and identify connected embedded devices
- **Firmware Deployment** - Deploy firmware to embedded devices with proper configuration
- **JTAG Debug Workflow** - Set up JTAG debugging workflow for ESP32-S3 and similar devices
- **Serial Debugging** - Debug embedded devices via serial communication

## MCP Development Prompts
- **MCP Resource Generation** - Generate an MCP resource with proper structure
- **MCP Server Composition** - Compose multiple MCP servers into a unified server
- **MCP Tool Generation** - Generate an MCP tool with proper structure and documentation

## Development & Integration Prompts
- **Advanced Multi-Server Integration Template** - Coordinates multiple MCP servers for complex tasks
- **MCP Integration Assistant** - Comprehensive template for coordinating multiple MCP servers
- **MCP Resources Explorer** - Template for exploring and leveraging resources across multiple MCP servers
- **mcp-server-configurator** - Guided assistant for configuring and integrating various MCP servers
- **mcp-template-system** - Template-based prompt system leveraging multiple MCP servers

## Assistant Prompts
- **Analysis Assistant** - Data analysis and transformation assistant
- **Architecture Design Assistant** - Software architecture design assistant
- **Code Refactoring Assistant** - Source code refactoring assistant
- **Code Review Assistant** - Comprehensive code review template
- **Debugging Assistant** - Development assistant for debugging
- **Database Query Assistant** - PostgreSQL database query assistant
- **Foresight Assistant** - Future scenario analysis and planning

## DevOps & Infrastructure Prompts
- **Docker Compose Prompt Combiner** - Creating Docker Compose configurations
- **Docker Containerization Guide** - Setting up Docker containers for Node.js applications
- **Docker MCP Servers Orchestration Guide** - Orchestrating multiple MCP servers in Docker
- **Monorepo Migration Guide** - Migrating code into monorepo structure

## SpareTools Prompts (Hardware Integration)
- **SpareTools Android Development** - Complete Android development and deployment toolkit
- **SpareTools Conan & Cloudsmith Package Management** - Package management and distribution toolkit
- **SpareTools ESP32 Serial Monitor** - ESP32 device monitoring and serial communication
- **SpareTools Full Development Workflow** - Complete development workflow from hardware to cloud
- **SpareTools Repository Cleanup** - Repository analysis and cleanup toolkit

## Specialized Prompts
- **GPIO Control Pattern** - Controlling GPIO pins on Raspberry Pi
- **OBD-II Diagnostics Pattern** - Vehicle diagnostic data querying
- **RF Capture/Replay Pattern** - RF signal capture and replay

## Mermaid & Documentation Prompts
- **Analyze Mermaid Diagram** - Diagram analysis
- **Generate Mermaid Diagram** - Diagram generation
- **Modify Mermaid Diagram** - Diagram modification
- **Mermaid Analysis Expert** - Advanced diagram analysis
- **Mermaid Class Diagram Generator** - Class diagram generation
- **Code Diagram Documentation Creator** - Creating documentation from code diagrams

Each prompt includes metadata about tags, whether it's a template, and sometimes specific MCP server requirements or capabilities. The prompts cover a wide range of development tasks from embedded systems and hardware integration to software architecture, DevOps, and AI-assisted development workflows.

