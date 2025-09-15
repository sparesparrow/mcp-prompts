---
description: Advanced patterns and best practices inspired by top 5 agentic workflow implementations
globs: ["**/*.{ts,js,py}", "**/agents/**/*", "**/workflows/**/*"]
priority: 50
dependencies: ["01-base-agentic.rules.md", "03-cognitive-architecture.rules.md", "03-composer-agent.rules.md"]
---

# Advanced Agentic Workflow Patterns

## Core Principles

### Pattern Selection
- Choose appropriate workflow pattern based on task characteristics
- Consider scalability and complexity requirements
- Enable pattern composition for complex tasks

### Dynamic Adaptation
- Support runtime pattern selection
- Enable workflow modification based on feedback
- Implement learning from execution history

### Resource Optimization
- Manage computational resources efficiently
- Implement proper cleanup mechanisms
- Support parallel execution when possible

## Implementation Patterns

### Reflection Pattern
```typescript
// Good: Structured reflection with feedback loop
class ReflectionWorkflow implements WorkflowPattern {
  async execute(task: Task): Promise<Result> {
    const initialResult = await this.performTask(task);
    const feedback = await this.analyzeFeedback(initialResult);
    return await this.refineResult(initialResult, feedback);
  }

  private async analyzeFeedback(result: Result): Promise<Feedback> {
    const analysis = await this.critic.analyze(result);
    return this.synthesizeFeedback(analysis);
  }
}

// Bad: No feedback integration
class SimpleWorkflow {
  async run(task: Task) { // ❌ Missing reflection capabilities
    return await this.execute(task);
  }
}
```

### Web Access Pattern
```typescript
// Good: Structured web access with caching
class WebAccessWorkflow implements WorkflowPattern {
  private cache: ResultCache;
  private rateLimiter: RateLimiter;

  async search(query: string): Promise<SearchResult> {
    if (await this.cache.has(query)) {
      return await this.cache.get(query);
    }

    await this.rateLimiter.checkLimit();
    const result = await this.performSearch(query);
    await this.cache.set(query, result);
    return result;
  }

  private async performSearch(query: string): Promise<SearchResult> {
    const optimizedQuery = await this.optimizeQuery(query);
    return await this.searchAgent.execute(optimizedQuery);
  }
}

// Bad: Unstructured web access
class BasicSearch {
  search(query: string) { // ❌ No caching or rate limiting
    return fetch(query);
  }
}
```

### Semantic Routing Pattern
```typescript
// Good: Intent-based routing with validation
class SemanticRouter implements WorkflowPattern {
  private agents: Map<string, Agent>;
  private intentAnalyzer: IntentAnalyzer;

  async route(request: Request): Promise<Response> {
    const intent = await this.intentAnalyzer.analyze(request);
    const agent = await this.selectAgent(intent);
    
    if (!agent) {
      throw new RoutingError(`No agent found for intent: ${intent}`);
    }

    return await agent.handle(request);
  }

  private async selectAgent(intent: Intent): Promise<Agent | null> {
    return this.agents.get(intent.type) || this.fallbackAgent;
  }
}

// Bad: Simple routing
class BasicRouter {
  route(req: Request) { // ❌ No intent analysis
    return this.defaultHandler(req);
  }
}
```

### Dynamic Decomposition Pattern
```typescript
// Good: Task decomposition with dependency management
class DynamicDecomposer implements WorkflowPattern {
  async decompose(task: ComplexTask): Promise<SubTask[]> {
    const analysis = await this.analyzeTask(task);
    const subTasks = await this.createSubTasks(analysis);
    return this.optimizeExecution(subTasks);
  }

  private async optimizeExecution(tasks: SubTask[]): Promise<SubTask[]> {
    const graph = await this.buildDependencyGraph(tasks);
    return this.scheduleParallelExecution(graph);
  }
}

// Bad: No task analysis
class SimpleDecomposer {
  split(task: Task) { // ❌ Missing dependency analysis
    return task.split();
  }
}
```

### DAG Orchestration Pattern
```typescript
// Good: Structured workflow orchestration
class DAGOrchestrator implements WorkflowPattern {
  private dag: DAG;
  private executors: Map<string, Executor>;

  async orchestrate(workflow: Workflow): Promise<Result> {
    const plan = await this.createExecutionPlan(workflow);
    await this.validatePlan(plan);
    return await this.executeDAG(plan);
  }

  private async executeDAG(plan: ExecutionPlan): Promise<Result> {
    const executor = new DAGExecutor(plan, this.executors);
    return await executor.execute();
  }
}

// Bad: Linear execution
class SimpleOrchestrator {
  execute(steps: Step[]) { // ❌ No parallel execution
    return steps.reduce((p, s) => p.then(() => s.execute()), Promise.resolve());
  }
}
```

## Validation Rules

```typescript
const WorkflowRules = {
  // Ensure pattern implementation
  patternImplementation: {
    pattern: /implements\s+WorkflowPattern/,
    message: "Implement proper workflow pattern interface"
  },
  
  // Check error handling
  errorHandling: {
    pattern: /try\s*{.*}\s*catch.*{.*throw\s+new\s+\w+Error/,
    message: "Implement proper error handling with custom errors"
  },
  
  // Verify parallel execution
  parallelExecution: {
    pattern: /Promise\.all|parallel|concurrent/,
    message: "Consider parallel execution where appropriate"
  }
};
```

## Best Practices

1. Pattern Selection
   - Choose patterns based on task requirements
   - Consider composition opportunities
   - Plan for extensibility

2. Resource Management
   - Implement proper cleanup
   - Handle concurrent execution
   - Monitor resource usage

3. Error Handling
   - Define custom error types
   - Implement recovery strategies
   - Maintain execution context

## Security Considerations

1. Input Validation
   - Validate all external inputs
   - Sanitize web content
   - Check resource limits

2. Execution Safety
   - Implement timeouts
   - Handle resource exhaustion
   - Monitor execution state

3. Data Protection
   - Secure sensitive data
   - Implement access control
   - Audit execution logs 