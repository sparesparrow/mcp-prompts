// Core entrypoint: exports domain entities, ports, and use-cases
export * from './entities/Prompt';
export * from './entities/TemplateVariable';
export * from './entities/PromptSequence';
export * from './ports/IPromptApplication';
export * from './ports/IPromptRepository';
export * from './ports/ITemplatingEngine';
export * from './ports/IEventPublisher';
export * from './ports/ISecurityValidator';
// ...add more as you extract
