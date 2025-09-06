#!/usr/bin/env node

// Core entrypoint: exports domain entities, ports, and use-cases

// Entities
export * from './entities/Prompt';
export * from './entities/TemplateVariable';
export * from './entities/PromptSequence';
export * from './entities/Category';
export * from './entities/User';

// Value Objects
export * from './value-objects/PromptId';
export * from './value-objects/Tag';
export * from './value-objects/TemplateVariable';

// Ports (Interfaces)
export * from './ports/IPromptRepository';
export * from './ports/IPromptApplication';
export * from './ports/ITemplatingEngine';
export * from './ports/IEventPublisher';
export * from './ports/ISecurityValidator';

// Use Cases
export * from './use-cases/addPrompt';
export * from './use-cases/getPromptById';
export * from './use-cases/listPrompts';
export * from './use-cases/updatePrompt';
export * from './use-cases/deletePrompt';
export * from './use-cases/applyTemplate';
export * from './use-cases/validatePrompt';
export * from './use-cases/searchPrompts';
export * from './use-cases/getPromptStats';

// Schemas and Validation
export * from './schemas';

// Errors
export * from './errors';

// Configuration
export * from './config';

// Utilities
export * from './utils';

// Application Layer
export * from './application/PromptApplication';

// Types
export * from './types';

// Re-export contracts for compatibility
export * from '@sparesparrow/mcp-prompts-contracts';
