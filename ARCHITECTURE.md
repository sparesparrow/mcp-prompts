# MCP Prompts Server - Architecture Overview

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "MCP Prompts Server v3.0.8"
        subgraph "Dual Mode Operation"
            HTTP[HTTP Mode<br/>REST API Server]
            MCP[MCP Mode<br/>Model Context Protocol]
        end
        
        subgraph "Core Components"
            INDEX[src/index.ts<br/>Main Entry Point]
            HTTP_SERVER[src/http-server.ts<br/>HTTP Server]
            MCP_SERVER[src/mcp-server.ts<br/>MCP Server]
            UTILS[src/utils.ts<br/>Utilities]
        end
        
        subgraph "Data Layer"
            SAMPLE_DATA[data/sample-prompts.json<br/>Pre-loaded Templates]
            IN_MEMORY[In-Memory Storage<br/>Map<string, Prompt>]
        end
        
        subgraph "External Integrations"
            CURSOR[Cursor IDE<br/>MCP Client]
            DOCKER[Docker Container<br/>Production Deployment]
            NPM[NPM Package<br/>@sparesparrow/mcp-prompts]
        end
    end
    
    INDEX --> HTTP_SERVER
    INDEX --> MCP_SERVER
    MCP_SERVER --> SAMPLE_DATA
    MCP_SERVER --> IN_MEMORY
    HTTP_SERVER --> IN_MEMORY
    MCP --> CURSOR
    MCP --> DOCKER
    MCP --> NPM
```

## 🔧 MCP Server Architecture

```mermaid
graph LR
    subgraph "MCP Server Implementation"
        subgraph "Protocol Layer"
            MCP_PROTOCOL[MCP Protocol<br/>2024-11-05]
            STDIO[StdioServerTransport]
            JSONRPC[JSON-RPC 2.0]
        end
        
        subgraph "Tool Registry"
            ADD[add_prompt]
            GET[get_prompt]
            LIST[list_prompts]
            UPDATE[update_prompt]
            DELETE[delete_prompt]
            APPLY[apply_template]
            STATS[get_stats]
        end
        
        subgraph "Data Processing"
            VALIDATION[Zod Validation]
            TEMPLATE[Template Processing]
            VARIABLES[Variable Substitution]
        end
        
        subgraph "Storage"
            PROMPTS[Prompt Storage<br/>Map<string, Prompt>]
            SAMPLE[Sample Data<br/>5 Templates]
        end
    end
    
    MCP_PROTOCOL --> STDIO
    STDIO --> JSONRPC
    JSONRPC --> ADD
    JSONRPC --> GET
    JSONRPC --> LIST
    JSONRPC --> UPDATE
    JSONRPC --> DELETE
    JSONRPC --> APPLY
    JSONRPC --> STATS
    
    ADD --> VALIDATION
    GET --> VALIDATION
    LIST --> VALIDATION
    UPDATE --> VALIDATION
    DELETE --> VALIDATION
    APPLY --> TEMPLATE
    TEMPLATE --> VARIABLES
    
    VALIDATION --> PROMPTS
    TEMPLATE --> PROMPTS
    PROMPTS --> SAMPLE
```

## 📊 Data Flow

```mermaid
flowchart TD
    subgraph "Client Requests"
        CURSOR_CLIENT[Cursor IDE]
        HTTP_CLIENT[HTTP Client]
        MCP_CLIENT[MCP Client]
    end
    
    subgraph "Server Processing"
        subgraph "Request Handling"
            HTTP_HANDLER[HTTP Handler]
            MCP_HANDLER[MCP Handler]
        end
        
        subgraph "Business Logic"
            VALIDATE[Validate Input]
            PROCESS[Process Request]
            TEMPLATE[Template Processing]
        end
        
        subgraph "Data Operations"
            STORE[Store Prompt]
            RETRIEVE[Retrieve Prompt]
            UPDATE[Update Prompt]
            DELETE[Delete Prompt]
            APPLY[Apply Template]
        end
    end
    
    subgraph "Data Storage"
        MEMORY[In-Memory Storage]
        SAMPLE[Sample Templates]
    end
    
    subgraph "Response"
        HTTP_RESPONSE[HTTP Response]
        MCP_RESPONSE[MCP Response]
    end
    
    CURSOR_CLIENT --> MCP_HANDLER
    HTTP_CLIENT --> HTTP_HANDLER
    MCP_CLIENT --> MCP_HANDLER
    
    MCP_HANDLER --> VALIDATE
    HTTP_HANDLER --> VALIDATE
    
    VALIDATE --> PROCESS
    PROCESS --> TEMPLATE
    
    TEMPLATE --> STORE
    TEMPLATE --> RETRIEVE
    TEMPLATE --> UPDATE
    TEMPLATE --> DELETE
    TEMPLATE --> APPLY
    
    STORE --> MEMORY
    RETRIEVE --> MEMORY
    UPDATE --> MEMORY
    DELETE --> MEMORY
    APPLY --> SAMPLE
    
    MEMORY --> MCP_RESPONSE
    SAMPLE --> MCP_RESPONSE
    MEMORY --> HTTP_RESPONSE
    SAMPLE --> HTTP_RESPONSE
```

## 🔄 Template Processing Flow

```mermaid
flowchart LR
    subgraph "Template Input"
        TEMPLATE[Template with Variables<br/>{{variable}} syntax]
        VARIABLES[Variable Values<br/>JSON object]
    end
    
    subgraph "Processing Steps"
        PARSE[Parse Template]
        EXTRACT[Extract Variables]
        VALIDATE[Validate Variables]
        SUBSTITUTE[Substitute Variables]
    end
    
    subgraph "Output"
        RESULT[Processed Template<br/>Ready for use]
    end
    
    TEMPLATE --> PARSE
    VARIABLES --> EXTRACT
    
    PARSE --> EXTRACT
    EXTRACT --> VALIDATE
    VALIDATE --> SUBSTITUTE
    SUBSTITUTE --> RESULT
```

## 🐳 Docker Deployment

```mermaid
graph TB
    subgraph "Docker Environment"
        subgraph "Container"
            DOCKER_IMAGE[Docker Image<br/>node:20-alpine]
            APP[Application<br/>MCP Prompts Server]
            ENV[Environment<br/>MODE=mcp]
        end
        
        subgraph "Docker Compose"
            COMPOSE[docker-compose.mcp.yml]
            VOLUMES[Volume Mounts<br/>./data:/app/data]
            PORTS[Port Mapping<br/>3003:3003]
        end
        
        subgraph "External"
            HOST[Host Machine]
            NETWORK[Docker Network]
        end
    end
    
    subgraph "Deployment Commands"
        BUILD[pnpm run docker:build:mcp]
        UP[pnpm run docker:up:mcp]
        LOGS[pnpm run docker:logs:mcp]
    end
    
    DOCKER_IMAGE --> APP
    APP --> ENV
    COMPOSE --> VOLUMES
    COMPOSE --> PORTS
    VOLUMES --> HOST
    PORTS --> NETWORK
    
    BUILD --> DOCKER_IMAGE
    UP --> COMPOSE
    LOGS --> APP
```

## 📈 Version Evolution

```mermaid
timeline
    title MCP Prompts Server Version Evolution
    section Initial Development
        v1.0.0 : Basic HTTP Server
        v1.2.x : Feature Development
        v1.8.x : Stability Improvements
    section Major Refactor
        v3.0.0 : TypeScript Migration
        v3.0.1 : Core Improvements
        v3.0.7 : MCP Foundation
    section MCP Integration
        v3.0.8 : Complete MCP Server
        : 7 MCP Tools
        : 5 Pre-loaded Templates
        : Cursor Integration
        : Docker Support
```

## 🔧 Tool Interaction Flow

```mermaid
sequenceDiagram
    participant C as Cursor IDE
    participant M as MCP Server
    participant S as Storage
    participant T as Templates
    
    C->>M: Initialize Connection
    M->>C: Protocol Version & Capabilities
    
    C->>M: list_prompts()
    M->>S: Get All Prompts
    S->>M: Return Prompt List
    M->>C: JSON Response
    
    C->>M: get_prompt(id)
    M->>S: Get Specific Prompt
    S->>M: Return Prompt
    M->>C: Prompt Data
    
    C->>M: apply_template(id, variables)
    M->>S: Get Template
    S->>M: Return Template
    M->>T: Process Variables
    T->>M: Processed Template
    M->>C: Final Template
    
    C->>M: add_prompt(data)
    M->>S: Store New Prompt
    S->>M: Confirmation
    M->>C: Success Response
```

## 📊 Data Model

```mermaid
erDiagram
    PROMPT {
        string id PK
        string name
        string content
        boolean isTemplate
        array tags
        array variables
        object metadata
        string createdAt
        string updatedAt
        number version
    }
    
    VARIABLE {
        string name
        string description
        boolean required
        string type
    }
    
    METADATA {
        string category
        string difficulty
        string estimatedTime
    }
    
    PROMPT ||--o{ VARIABLE : "has"
    PROMPT ||--o| METADATA : "contains"
```

## 🎯 Use Case Scenarios

```mermaid
graph LR
    subgraph "Use Cases"
        subgraph "Development"
            CODE_REVIEW[Code Review<br/>Assistant Template]
            DOCS[Documentation<br/>Writer Template]
        end
        
        subgraph "Debugging"
            BUG_ANALYSIS[Bug Analyzer<br/>Template]
        end
        
        subgraph "Architecture"
            ARCH_REVIEW[Architecture<br/>Reviewer Template]
        end
        
        subgraph "Testing"
            TEST_GEN[Test Case<br/>Generator Template]
        end
    end
    
    subgraph "Integration Points"
        CURSOR[Cursor IDE]
        HTTP_API[HTTP API]
        MCP_TOOLS[MCP Tools]
    end
    
    CODE_REVIEW --> CURSOR
    DOCS --> CURSOR
    BUG_ANALYSIS --> CURSOR
    ARCH_REVIEW --> CURSOR
    TEST_GEN --> CURSOR
    
    CODE_REVIEW --> HTTP_API
    DOCS --> HTTP_API
    BUG_ANALYSIS --> HTTP_API
    ARCH_REVIEW --> HTTP_API
    TEST_GEN --> HTTP_API
    
    CODE_REVIEW --> MCP_TOOLS
    DOCS --> MCP_TOOLS
    BUG_ANALYSIS --> MCP_TOOLS
    ARCH_REVIEW --> MCP_TOOLS
    TEST_GEN --> MCP_TOOLS
```

---

## 📋 Summary

These diagrams provide a comprehensive visual representation of the MCP Prompts Server architecture, demonstrating the "show over tell" approach by visualizing:

1. **System Architecture** - Overall structure and component relationships
2. **MCP Server Implementation** - Detailed MCP protocol integration
3. **Data Flow** - How requests are processed through the system
4. **Template Processing** - Variable substitution workflow
5. **Docker Deployment** - Containerization strategy
6. **Version Evolution** - Project development timeline
7. **Tool Interactions** - MCP tool communication flow
8. **Use Cases** - Real-world application scenarios
9. **Data Model** - Entity relationships and structure

The diagrams make complex architectural decisions and relationships immediately clear through visual representation rather than lengthy textual descriptions.
