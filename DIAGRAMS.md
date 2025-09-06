# MCP Prompts Server - Key Diagrams

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "MCP Prompts Server v3.0.8"
        INDEX[src/index.ts<br/>Main Entry Point]
        HTTP[src/http-server.ts<br/>HTTP Server]
        MCP[src/mcp-server.ts<br/>MCP Server]
        DATA[data/sample-prompts.json<br/>5 Templates]
        STORAGE[In-Memory Storage]
    end
    
    subgraph "External"
        CURSOR[Cursor IDE]
        DOCKER[Docker Container]
        NPM[NPM Package]
    end
    
    INDEX --> HTTP
    INDEX --> MCP
    MCP --> DATA
    MCP --> STORAGE
    HTTP --> STORAGE
    MCP --> CURSOR
    MCP --> DOCKER
    MCP --> NPM
```

## 🔧 MCP Tools Architecture

```mermaid
graph LR
    subgraph "7 MCP Tools"
        ADD[add_prompt]
        GET[get_prompt]
        LIST[list_prompts]
        UPDATE[update_prompt]
        DELETE[delete_prompt]
        APPLY[apply_template]
        STATS[get_stats]
    end
    
    subgraph "Processing"
        VALIDATE[Zod Validation]
        TEMPLATE[Template Processing]
        STORAGE[Prompt Storage]
    end
    
    ADD --> VALIDATE
    GET --> VALIDATE
    LIST --> VALIDATE
    UPDATE --> VALIDATE
    DELETE --> VALIDATE
    APPLY --> TEMPLATE
    STATS --> STORAGE
    
    VALIDATE --> STORAGE
    TEMPLATE --> STORAGE
```

## 📊 Data Flow

```mermaid
flowchart TD
    CLIENT[Cursor IDE] --> MCP[MCP Server]
    MCP --> VALIDATE[Validate Input]
    VALIDATE --> PROCESS[Process Request]
    PROCESS --> STORAGE[In-Memory Storage]
    STORAGE --> RESPONSE[MCP Response]
    RESPONSE --> CLIENT
```

## 🔄 Template Processing

```mermaid
flowchart LR
    TEMPLATE[Template with {{variables}}] --> PARSE[Parse Template]
    VARIABLES[JSON Variables] --> SUBSTITUTE[Substitute Variables]
    PARSE --> SUBSTITUTE
    SUBSTITUTE --> RESULT[Final Template]
```

## 🐳 Docker Deployment

```mermaid
graph TB
    DOCKER[Docker Image<br/>node:20-alpine] --> APP[MCP Server]
    APP --> ENV[MODE=mcp]
    COMPOSE[docker-compose.mcp.yml] --> VOLUMES[Data Volume]
    COMPOSE --> PORTS[Port 3003]
```

## 📈 Version Evolution

```mermaid
timeline
    title MCP Prompts Server Evolution
    section Development
        v1.0.0 : Basic HTTP Server
        v3.0.0 : TypeScript Migration
        v3.0.7 : MCP Foundation
    section MCP Integration
        v3.0.8 : Complete MCP Server
        : 7 Tools + 5 Templates
        : Cursor Integration
        : Docker Support
```

## 🎯 Use Cases

```mermaid
graph LR
    subgraph "5 Templates"
        CODE[Code Review]
        DOCS[Documentation]
        BUG[Bug Analysis]
        ARCH[Architecture]
        TEST[Test Generation]
    end
    
    subgraph "Integration"
        CURSOR[Cursor IDE]
        HTTP[HTTP API]
        MCP[MCP Tools]
    end
    
    CODE --> CURSOR
    DOCS --> CURSOR
    BUG --> CURSOR
    ARCH --> CURSOR
    TEST --> CURSOR
    
    CODE --> HTTP
    DOCS --> HTTP
    BUG --> HTTP
    ARCH --> HTTP
    TEST --> HTTP
    
    CODE --> MCP
    DOCS --> MCP
    BUG --> MCP
    ARCH --> MCP
    TEST --> MCP
```

---

## 📋 Key Features Visualized

These diagrams show the core architecture and relationships of the MCP Prompts Server v3.0.8:

1. **Dual Mode Operation** - HTTP and MCP servers
2. **7 MCP Tools** - Complete prompt management
3. **5 Pre-loaded Templates** - Ready-to-use prompts
4. **Template Processing** - Variable substitution
5. **Docker Support** - Containerized deployment
6. **Cursor Integration** - IDE integration ready
7. **Data Flow** - Request processing pipeline
8. **Version Evolution** - Development timeline

The visual approach makes complex relationships immediately clear.
