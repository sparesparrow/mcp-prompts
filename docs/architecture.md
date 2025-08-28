# MCP Prompts Server Architecture

## Overview

MCP Prompts Server follows **Hexagonal Architecture** (Ports & Adapters) principles, providing a clean separation between domain logic and infrastructure concerns.

## 🏗️ High-Level Architecture

```mermaid
graph TB
    subgraph "External Systems"
        MCP[MCP Clients<br/>Claude Desktop, Cursor IDE]
        HTTP[HTTP Clients<br/>REST API, Web UI]
        CLI[CLI Tools<br/>Command Line]
    end
    
    subgraph "Driving Adapters (Inbound)"
        MCPAdapter[MCP Adapter<br/>JSON-RPC, SSE]
        RESTAdapter[REST Adapter<br/>Express.js]
        CLIAdapter[CLI Adapter<br/>Commander.js]
    end
    
    subgraph "Core Domain (Hexagon)"
        App[Prompt Application<br/>Use Cases]
        Entities[Domain Entities<br/>Prompt, Template, Category]
        Ports[Ports<br/>Interfaces]
    end
    
    subgraph "Driven Adapters (Outbound)"
        FileStorage[File Storage<br/>JSON Files]
        PostgresStorage[PostgreSQL<br/>Database]
        MemoryStorage[Memory Storage<br/>In-Memory]
        MDCStorage[MDC Storage<br/>Cursor Rules]
    end
    
    subgraph "Infrastructure"
        Config[Configuration<br/>Environment]
        Logging[Logging<br/>Pino]
        Security[Security<br/>API Keys, CORS]
    end
    
    MCP --> MCPAdapter
    HTTP --> RESTAdapter
    CLI --> CLIAdapter
    
    MCPAdapter --> App
    RESTAdapter --> App
    CLIAdapter --> App
    
    App --> Entities
    App --> Ports
    
    Ports --> FileStorage
    Ports --> PostgresStorage
    Ports --> MemoryStorage
    Ports --> MDCStorage
    
    App --> Config
    App --> Logging
    App --> Security
```

## 🔌 Ports & Adapters

### Primary Ports (Driving)

```mermaid
graph LR
    subgraph "Primary Ports"
        IPromptApplication[IPromptApplication]
    end
    
    subgraph "Driving Adapters"
        MCPAdapter[MCP Adapter]
        RESTAdapter[REST Adapter]
        CLIAdapter[CLI Adapter]
    end
    
    MCPAdapter --> IPromptApplication
    RESTAdapter --> IPromptApplication
    CLIAdapter --> IPromptApplication
```

### Secondary Ports (Driven)

```mermaid
graph LR
    subgraph "Secondary Ports"
        IPromptRepository[IPromptRepository]
        ITemplatingEngine[ITemplatingEngine]
        IEventPublisher[IEventPublisher]
        ISecurityValidator[ISecurityValidator]
    end
    
    subgraph "Driven Adapters"
        FileStorage[File Storage]
        PostgresStorage[PostgreSQL]
        MemoryStorage[Memory Storage]
        EtaTemplating[Eta Templating]
        EventBus[Event Bus]
        SecurityService[Security Service]
    end
    
    IPromptRepository --> FileStorage
    IPromptRepository --> PostgresStorage
    IPromptRepository --> MemoryStorage
    
    ITemplatingEngine --> EtaTemplating
    
    IEventPublisher --> EventBus
    
    ISecurityValidator --> SecurityService
```

## 🏛️ Domain Model

```mermaid
classDiagram
    class Prompt {
        +id: PromptId
        +name: string
        +content: string
        +isTemplate: boolean
        +version: number
        +createdAt: string
        +updatedAt: string
        +description?: string
        +category?: string
        +tags?: Tag[]
        +variables?: TemplateVariable[]
        +metadata?: Record~string, unknown~
    }
    
    class PromptId {
        +value: string
        +generate(): PromptId
        +fromString(value: string): PromptId
        +fromName(name: string): PromptId
        +isValid(value: string): boolean
        +toString(): string
        +equals(other: PromptId): boolean
    }
    
    class Tag {
        +value: string
        +fromString(value: string): Tag
        +sanitize(value: string): Tag
        +isValid(value: string): boolean
        +toString(): string
        +matches(pattern: string|RegExp): boolean
    }
    
    class TemplateVariable {
        +name: string
        +description?: string
        +default?: string
        +required: boolean
        +type: VariableType
        +options?: string[]
        +create(name, description, default, required, type, options): TemplateVariable
        +fromString(name: string): TemplateVariable
        +fromObject(obj: object): TemplateVariable
        +toObject(): object
        +with(updates): TemplateVariable
    }
    
    class PromptSequence {
        +id: string
        +name: string
        +description?: string
        +promptIds: string[]
        +version: number
        +createdAt: string
        +updatedAt: string
        +metadata?: Record~string, any~
        +tags?: string[]
    }
    
    class Category {
        +id: string
        +name: string
        +description?: string
        +parentId?: string
        +color?: string
        +icon?: string
    }
    
    class User {
        +id: string
        +username: string
        +email: string
        +role: UserRole
        +isActive: boolean
        +apiKeys?: string[]
    }
    
    Prompt --> PromptId
    Prompt --> Tag
    Prompt --> TemplateVariable
    Prompt --> Category
    PromptSequence --> Prompt
    Category --> Category
    User --> Prompt
```

## 🔄 Use Cases

```mermaid
graph TD
    subgraph "Use Cases"
        AddPrompt[Add Prompt]
        GetPrompt[Get Prompt]
        ListPrompts[List Prompts]
        UpdatePrompt[Update Prompt]
        DeletePrompt[Delete Prompt]
        ApplyTemplate[Apply Template]
        ValidatePrompt[Validate Prompt]
        SearchPrompts[Search Prompts]
        GetStats[Get Statistics]
    end
    
    subgraph "Application Layer"
        PromptApplication[Prompt Application]
    end
    
    subgraph "Repository Layer"
        PromptRepository[Prompt Repository]
    end
    
    AddPrompt --> PromptApplication
    GetPrompt --> PromptApplication
    ListPrompts --> PromptApplication
    UpdatePrompt --> PromptApplication
    DeletePrompt --> PromptApplication
    ApplyTemplate --> PromptApplication
    ValidatePrompt --> PromptApplication
    SearchPrompts --> PromptApplication
    GetStats --> PromptApplication
    
    PromptApplication --> PromptRepository
```

## 🗄️ Storage Architecture

```mermaid
graph TB
    subgraph "Storage Layer"
        subgraph "File Storage"
            JSONFiles[JSON Files]
            IndexFile[Index File]
            BackupDir[Backup Directory]
        end
        
        subgraph "PostgreSQL"
            PromptsTable[Prompts Table]
            SequencesTable[Sequences Table]
            UsersTable[Users Table]
            TagsTable[Tags Table]
            CategoriesTable[Categories Table]
        end
        
        subgraph "Memory Storage"
            InMemoryMap[In-Memory Map]
            Cache[Cache Layer]
        end
        
        subgraph "MDC Storage"
            CursorRules[Cursor Rules Files]
            MDCParser[MDC Parser]
        end
    end
    
    subgraph "Storage Interface"
        IPromptRepository[IPromptRepository]
    end
    
    subgraph "Adapters"
        FileAdapter[File Adapter]
        PostgresAdapter[PostgreSQL Adapter]
        MemoryAdapter[Memory Adapter]
        MDCAdapter[MDC Adapter]
    end
    
    IPromptRepository --> FileAdapter
    IPromptRepository --> PostgresAdapter
    IPromptRepository --> MemoryAdapter
    IPromptRepository --> MDCAdapter
    
    FileAdapter --> JSONFiles
    FileAdapter --> IndexFile
    FileAdapter --> BackupDir
    
    PostgresAdapter --> PromptsTable
    PostgresAdapter --> SequencesTable
    PostgresAdapter --> UsersTable
    PostgresAdapter --> TagsTable
    PostgresAdapter --> CategoriesTable
    
    MemoryAdapter --> InMemoryMap
    MemoryAdapter --> Cache
    
    MDCAdapter --> CursorRules
    MDCAdapter --> MDCParser
```

## 🔐 Security Architecture

```mermaid
graph TB
    subgraph "Security Layer"
        APIKeyAuth[API Key Authentication]
        CORS[CORS Policy]
        RateLimiting[Rate Limiting]
        InputValidation[Input Validation]
        ContentSecurity[Content Security]
    end
    
    subgraph "Security Interface"
        ISecurityValidator[ISecurityValidator]
    end
    
    subgraph "Security Implementation"
        SecurityService[Security Service]
        ValidationService[Validation Service]
    end
    
    APIKeyAuth --> SecurityService
    CORS --> SecurityService
    RateLimiting --> SecurityService
    InputValidation --> ValidationService
    ContentSecurity --> ValidationService
    
    SecurityService --> ISecurityValidator
    ValidationService --> ISecurityValidator
```

## 📊 Data Flow

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant MCPAdapter as MCP Adapter
    participant App as Prompt Application
    participant Repo as Prompt Repository
    participant Storage as File Storage
    
    Client->>MCPAdapter: prompts/get {id: "prompt-1"}
    MCPAdapter->>App: getPrompt("prompt-1")
    App->>Repo: getPrompt("prompt-1")
    Repo->>Storage: Read JSON file
    Storage-->>Repo: Prompt data
    Repo-->>App: Prompt object
    App-->>MCPAdapter: Prompt response
    MCPAdapter-->>Client: MCP response
```

## 🚀 Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        subgraph "Load Balancer"
            Nginx[Nginx/HAProxy]
        end
        
        subgraph "Application Layer"
            MCPPrompts1[MCP Prompts Instance 1]
            MCPPrompts2[MCP Prompts Instance 2]
            MCPPrompts3[MCP Prompts Instance 3]
        end
        
        subgraph "Database Layer"
            PostgresPrimary[PostgreSQL Primary]
            PostgresReplica[PostgreSQL Replica]
        end
        
        subgraph "Storage Layer"
            FileStorage[File Storage<br/>NFS/Cloud Storage]
            BackupStorage[Backup Storage<br/>S3/Backup Server]
        end
        
        subgraph "Monitoring"
            Prometheus[Prometheus]
            Grafana[Grafana]
            Logs[Centralized Logging]
        end
    end
    
    Nginx --> MCPPrompts1
    Nginx --> MCPPrompts2
    Nginx --> MCPPrompts3
    
    MCPPrompts1 --> PostgresPrimary
    MCPPrompts2 --> PostgresPrimary
    MCPPrompts3 --> PostgresPrimary
    
    PostgresPrimary --> PostgresReplica
    
    MCPPrompts1 --> FileStorage
    MCPPrompts2 --> FileStorage
    MCPPrompts3 --> FileStorage
    
    PostgresPrimary --> BackupStorage
    
    MCPPrompts1 --> Prometheus
    MCPPrompts2 --> Prometheus
    MCPPrompts3 --> Prometheus
    
    Prometheus --> Grafana
```

## 🔧 Configuration Management

```mermaid
graph LR
    subgraph "Configuration Sources"
        EnvVars[Environment Variables]
        ConfigFile[Config File]
        DockerEnv[Docker Environment]
        Secrets[Secrets Management]
    end
    
    subgraph "Configuration Layer"
        ConfigSchema[Zod Schema]
        ConfigValidator[Config Validator]
        ConfigLoader[Config Loader]
    end
    
    subgraph "Application"
        AppConfig[Application Config]
        StorageConfig[Storage Config]
        SecurityConfig[Security Config]
        LoggingConfig[Logging Config]
    end
    
    EnvVars --> ConfigSchema
    ConfigFile --> ConfigSchema
    DockerEnv --> ConfigSchema
    Secrets --> ConfigSchema
    
    ConfigSchema --> ConfigValidator
    ConfigValidator --> ConfigLoader
    
    ConfigLoader --> AppConfig
    ConfigLoader --> StorageConfig
    ConfigLoader --> SecurityConfig
    ConfigLoader --> LoggingConfig
```

## 📈 Performance Considerations

- **Caching**: In-memory caching for frequently accessed prompts
- **Indexing**: JSON index files for fast prompt discovery
- **Lazy Loading**: Load prompt content only when needed
- **Batch Operations**: Bulk import/export operations
- **Connection Pooling**: Database connection management
- **Async Operations**: Non-blocking I/O operations

## 🔒 Security Considerations

- **API Key Authentication**: Secure access control
- **Input Validation**: Zod schema validation
- **Content Security**: Sanitization of prompt content
- **Rate Limiting**: Protection against abuse
- **CORS Policy**: Cross-origin request control
- **Audit Logging**: Track all operations

## 🧪 Testing Strategy

- **Unit Tests**: Test individual use cases and entities
- **Integration Tests**: Test adapter implementations
- **E2E Tests**: Test complete workflows
- **Performance Tests**: Load testing and benchmarking
- **Security Tests**: Vulnerability scanning and penetration testing

## 📚 References

- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://domainlanguage.com/ddd/)
