---
description: Standards for processing and executing composer agent instructions with proper validation and execution flow
globs: ["**/composer/**/*.{ts,js}", "**/agents/**/*.{ts,js}", "**/instructions/**/*.{ts,js}"]
priority: 32
dependencies: ["01-base-agentic.rules.md", "03-composer-agent.rules.md"]
---

# Composer Agent Instruction Standards

## Core Principles

### Instruction Processing
- Validate and parse instruction format
- Support multi-step execution plans
- Enable feedback-driven refinement

### Resource Management
- Handle external dependencies
- Manage file system access
- Control execution environment

### Execution Flow
- Implement iterative execution
- Support progress tracking
- Enable safe rollback mechanisms

## Code Standards

### Instruction Parser
```typescript
// Good: Structured instruction processing
class InstructionProcessor {
  async processInstructions(instructions: string[]): Promise<ExecutionPlan> {
    const validatedSteps = await this.validateSteps(instructions);
    const dependencies = await this.analyzeDependencies(validatedSteps);
    return this.createExecutionPlan(validatedSteps, dependencies);
  }

  private async validateSteps(steps: string[]): Promise<ValidatedStep[]> {
    return Promise.all(steps.map(async step => {
      const validated = await this.validateStep(step);
      if (!validated.isValid) {
        throw new ValidationError(`Invalid step: ${step}`);
      }
      return validated;
    }));
  }
}

// Bad: Unstructured processing
class BadProcessor {
  process(instructions: string[]) { // ❌ No validation or planning
    instructions.forEach(i => this.execute(i));
  }
}
```

### Execution Manager
```typescript
// Good: Safe execution with progress tracking
class ExecutionManager {
  private progress: Map<string, StepStatus> = new Map();
  private logger: ExecutionLogger;

  async executeWithTracking(plan: ExecutionPlan): Promise<Result> {
    try {
      await this.initializeExecution(plan);
      
      for (const step of plan.steps) {
        await this.executeStep(step);
        await this.updateProgress(step);
        await this.validateStepResult(step);
      }

      return this.finalizeExecution(plan);
    } catch (error) {
      await this.handleExecutionError(error, plan);
      throw error;
    }
  }

  private async executeStep(step: PlanStep): Promise<void> {
    const canExecute = await this.checkDependencies(step);
    if (!canExecute) {
      throw new DependencyError(`Dependencies not met for step: ${step.id}`);
    }

    await this.backupStateIfNeeded(step);
    await this.executeWithRetry(step);
  }
}

// Bad: Unsafe execution
class BadExecutor {
  run(steps: any[]) { // ❌ No error handling or progress tracking
    steps.forEach(s => this.execute(s));
  }
}
```

### Progress Tracker
```typescript
// Good: Structured progress tracking
interface ExecutionProgress {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: Error;
  artifacts?: string[];
}

class ProgressTracker {
  private progress: Map<string, ExecutionProgress> = new Map();
  private persistenceManager: ProgressPersistence;

  async updateProgress(stepId: string, update: Partial<ExecutionProgress>): Promise<void> {
    const current = this.progress.get(stepId) || this.createInitialProgress(stepId);
    const updated = { ...current, ...update };
    
    await this.validateProgressUpdate(updated);
    await this.persistProgress(updated);
    this.progress.set(stepId, updated);
  }

  async getExecutionSummary(): Promise<ExecutionSummary> {
    return {
      totalSteps: this.progress.size,
      completed: this.getCompletedCount(),
      failed: this.getFailedCount(),
      artifacts: this.collectArtifacts()
    };
  }
}

// Bad: Poor progress management
class BadTracker {
  status: any = {}; // ❌ Untyped and unsecured progress tracking
  
  update(id: string, status: string) {
    this.status[id] = status;
  }
}
```

## Validation Rules

```typescript
const InstructionRules = {
  // Ensure proper instruction validation
  instructionValidation: {
    pattern: /validate.*Steps|validateStep/,
    message: "Implement proper instruction validation"
  },
  
  // Check execution tracking
  executionTracking: {
    pattern: /class.*Progress|interface.*Progress/,
    message: "Implement structured progress tracking"
  },
  
  // Verify error handling
  errorHandling: {
    pattern: /catch.*{.*handleExecutionError/,
    message: "Implement proper error handling for execution"
  }
};
```

## Execution Requirements

1. Pre-execution
   - Validate all instructions
   - Check dependencies
   - Prepare execution environment

2. Execution
   - Track progress
   - Handle errors
   - Manage resources

3. Post-execution
   - Validate results
   - Clean up resources
   - Generate reports

## Best Practices

1. Instruction Design
   - Clear step definitions
   - Explicit dependencies
   - Validation rules

2. Execution Management
   - Atomic operations
   - Progress persistence
   - Rollback capability

3. Resource Handling
   - Clean environment
   - Resource cleanup
   - Access control

## Security Considerations

1. Input Validation
   - Validate instruction format
   - Check for malicious content
   - Sanitize parameters

2. Execution Security
   - Sandbox operations
   - Resource limits
   - Access control

3. Output Protection
   - Validate results
   - Secure artifacts
   - Control access to logs 