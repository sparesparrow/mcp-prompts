---
description: Foundational patterns for implementing agentic workflows and self-improving systems
globs: ["**/*.{ts,js,py}"]
priority: 10
---

# Agentic Design Patterns

## Core Principles

### Reflection Pattern
- Implement self-assessment and improvement mechanisms
- Use structured feedback loops for output refinement
- Support both self-reflection and external validation

### Tool Use Pattern
- Integrate external tools and APIs effectively
- Implement proper error handling for tool interactions
- Cache tool results when appropriate

### Planning Pattern
- Break complex tasks into manageable steps
- Maintain state across multi-step operations
- Handle failures gracefully with retry mechanisms

### Multi-Agent Collaboration
- Define clear interfaces between agents
- Implement proper message passing protocols
- Handle agent coordination and synchronization

## Code Standards

### Reflection Implementation
```typescript
// Good: Structured reflection with feedback loop
class ReflectiveAgent {
  async generateWithReflection(input: string): Promise<string> {
    const output = await this.generate(input);
    const feedback = await this.reflect(output);
    return await this.refine(output, feedback);
  }
}

// Bad: No reflection or improvement
class SimpleAgent {
  async generate(input: string): Promise<string> {
    return await this.model.complete(input); // ❌ No self-improvement
  }
}
```

### Tool Integration
```typescript
// Good: Proper tool error handling
async function useTool(input: any) {
  try {
    const result = await tool.execute(input);
    return this.validateToolResult(result);
  } catch (error) {
    this.handleToolError(error);
    return this.fallbackBehavior();
  }
}

// Bad: Missing error handling
async function badToolUse(input: any) {
  const result = await tool.execute(input); // ❌ No error handling
  return result;
}
```

### Planning Implementation
```typescript
// Good: Structured planning with steps
interface PlanStep {
  action: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'complete' | 'failed';
}

class PlanningAgent {
  async executePlan(steps: PlanStep[]): Promise<void> {
    for (const step of this.orderSteps(steps)) {
      await this.executeStep(step);
    }
  }
}

// Bad: No structured planning
class SimpleAgent {
  async execute(task: string) {
    await this.doTask(task); // ❌ No planning or step management
  }
}
```

## Validation Rules

```typescript
const AgenticRules = {
  // Ensure reflection capability
  requireReflection: {
    pattern: /class.*Agent.*{[^}]*reflect/,
    message: "Agents should implement reflection capabilities"
  },
  
  // Validate tool error handling
  toolErrorHandling: {
    pattern: /try\s*{[^}]*tool\.[^}]*}\s*catch/,
    message: "Tool usage must include error handling"
  },
  
  // Check for planning structures
  planningImplementation: {
    pattern: /interface.*Plan|class.*Planning/,
    message: "Complex tasks should use planning structures"
  }
};
```

## Security Considerations

1. Tool Access Control
   - Implement proper authentication for tool access
   - Validate tool inputs and outputs
   - Monitor tool usage patterns

2. Agent Boundaries
   - Enforce clear separation between agents
   - Implement proper message sanitization
   - Control resource usage per agent

3. Reflection Safety
   - Validate reflected outputs
   - Implement feedback loop limits
   - Monitor for recursive reflection patterns 