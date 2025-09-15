---
description: Standards for implementing AI composer agents and workflow patterns
globs: ["**/composer/**/*.ts", "**/agents/**/*.ts"]
priority: 30
dependencies: ["01-base-agentic.rules.md", "02-typescript.rules.md"]
---

# AI Composer Agent Standards

## Core Principles

### Agent Architecture
- Implement modular agent design
- Support workflow composition
- Enable agent collaboration

### Pattern Implementation
- Support reflection capabilities
- Enable dynamic task decomposition
- Implement parallel delegation

### State Management
- Maintain agent state properly
- Handle workflow context
- Support persistence

## Code Standards

### Agent Implementation
```typescript
// Good: Modular agent design
class ComposerAgent implements Agent {
  private state: AgentState;
  private tools: Map<string, Tool>;
  private workflows: WorkflowRegistry;

  async compose(task: Task): Promise<Result> {
    const plan = await this.planExecution(task);
    const workflow = await this.createWorkflow(plan);
    return await this.executeWorkflow(workflow);
  }

  private async planExecution(task: Task): Promise<ExecutionPlan> {
    const steps = await this.decompose(task);
    return this.optimizeSteps(steps);
  }
}

// Bad: Monolithic agent
class BadAgent {
  async process(input: string) { // ❌ No proper task modeling
    const result = await this.doEverything(input);
    return result;
  }
}
```

### Workflow Patterns
```typescript
// Good: Pattern implementation
class ReflectionPattern implements Pattern {
  async apply(agent: Agent, task: Task): Promise<Result> {
    const initialResult = await agent.execute(task);
    const feedback = await agent.reflect(initialResult);
    return await agent.refine(initialResult, feedback);
  }
}

class ParallelDelegationPattern implements Pattern {
  async apply(agent: Agent, tasks: Task[]): Promise<Result[]> {
    const delegates = tasks.map(task => this.assignDelegate(task));
    return await Promise.all(
      delegates.map(delegate => delegate.execute())
    );
  }
}

// Bad: No pattern structure
class BadPattern {
  execute(task: any) { // ❌ No pattern implementation
    return this.justDoIt(task);
  }
}
```

### State Management
```typescript
// Good: Proper state handling
interface AgentState {
  currentTask?: Task;
  workflowContext: WorkflowContext;
  executionHistory: ExecutionRecord[];
}

class StateManager {
  private state: AgentState;

  async updateState(update: Partial<AgentState>): Promise<void> {
    this.validateStateUpdate(update);
    this.state = { ...this.state, ...update };
    await this.persistState();
  }

  private validateStateUpdate(update: Partial<AgentState>): void {
    // Validation logic
  }
}

// Bad: Poor state management
class BadStateHandling {
  state: any = {}; // ❌ Untyped state
  
  update(data: any) { // ❌ No validation
    Object.assign(this.state, data);
  }
}
```

## Validation Rules

```typescript
const ComposerRules = {
  // Ensure pattern implementation
  patternImplementation: {
    pattern: /implements\s+Pattern/,
    message: "Implement proper pattern interface"
  },
  
  // Validate state management
  stateManagement: {
    pattern: /interface\s+.*State|class\s+.*StateManager/,
    message: "Implement proper state management"
  },
  
  // Check workflow handling
  workflowHandling: {
    pattern: /class\s+.*Workflow|interface\s+.*Workflow/,
    message: "Define proper workflow structures"
  }
};
```

## Pattern Requirements

1. Reflection Pattern
   - Self-assessment capability
   - Feedback integration
   - Improvement mechanisms

2. Task Decomposition
   - Subtask identification
   - Dependency management
   - Resource allocation

3. Parallel Delegation
   - Task distribution
   - Result aggregation
   - Error handling

## Best Practices

1. Agent Design
   - Single responsibility principle
   - Clear interfaces
   - Proper error handling

2. Workflow Management
   - Modular workflows
   - State persistence
   - Progress tracking

3. Pattern Usage
   - Pattern composition
   - Context awareness
   - Failure recovery

## Security Considerations

1. Agent Isolation
   - Proper sandboxing
   - Resource limits
   - Access control

2. State Protection
   - Secure persistence
   - Access validation
   - Data encryption

3. Workflow Security
   - Input validation
   - Output sanitization
   - Execution monitoring 