---
description: Standards for implementing AI cognitive architectures and workflow patterns
globs: ["**/cognitive/**/*.ts", "**/architecture/**/*.ts"]
priority: 35
dependencies: ["01-base-agentic.rules.md", "03-composer-agent.rules.md"]
---

# AI Cognitive Architecture Standards

## Core Principles

### Architecture Design
- Implement modular cognitive components
- Support hierarchical processing
- Enable dynamic adaptation

### Pattern Integration
- Support multiple workflow patterns
- Enable pattern composition
- Implement pattern selection

### Memory Management
- Implement working memory
- Support long-term storage
- Enable memory retrieval

## Code Standards

### Cognitive Components
```typescript
// Good: Modular cognitive design
interface CognitiveComponent {
  process(input: Input): Promise<Output>;
  adapt(feedback: Feedback): Promise<void>;
  getState(): ComponentState;
}

class PerceptionComponent implements CognitiveComponent {
  async process(input: SensoryInput): Promise<PerceptualOutput> {
    const features = await this.extractFeatures(input);
    const patterns = await this.recognizePatterns(features);
    return this.integratePatterns(patterns);
  }

  async adapt(feedback: Feedback): Promise<void> {
    await this.updatePatternRecognition(feedback);
  }
}

// Bad: Monolithic processing
class BadProcessor {
  process(data: any) { // ❌ No cognitive structure
    return this.doEverything(data);
  }
}
```

### Pattern Orchestration
```typescript
// Good: Pattern management
class PatternOrchestrator {
  private patterns: Map<string, WorkflowPattern>;
  private context: ExecutionContext;

  async selectPattern(task: Task): Promise<WorkflowPattern> {
    const analysis = await this.analyzeTask(task);
    return this.matchPattern(analysis);
  }

  async composePatterns(patterns: WorkflowPattern[]): Promise<CompositePattern> {
    return new CompositePattern(
      patterns,
      this.resolveDependencies(patterns)
    );
  }
}

// Bad: Static pattern usage
class BadOrchestration {
  execute(task: Task) {
    return this.defaultPattern.run(task); // ❌ No pattern selection
  }
}
```

### Memory Implementation
```typescript
// Good: Structured memory system
interface MemorySystem {
  workingMemory: WorkingMemory;
  longTermMemory: LongTermMemory;
  episodicMemory: EpisodicMemory;
}

class WorkingMemory {
  private items: MemoryItem[] = [];
  private capacity: number;

  async store(item: MemoryItem): Promise<void> {
    await this.consolidateIfNeeded();
    this.items.push(item);
  }

  private async consolidateIfNeeded(): Promise<void> {
    if (this.items.length >= this.capacity) {
      await this.consolidateToLongTerm();
    }
  }
}

// Bad: Simple storage
class BadMemory {
  items: any[] = []; // ❌ No memory structure
  
  add(item: any) { // ❌ No capacity management
    this.items.push(item);
  }
}
```

## Validation Rules

```typescript
const CognitiveRules = {
  // Ensure component structure
  componentStructure: {
    pattern: /implements\s+CognitiveComponent/,
    message: "Implement proper cognitive component interface"
  },
  
  // Validate memory management
  memoryManagement: {
    pattern: /class\s+.*Memory|interface\s+.*Memory/,
    message: "Implement structured memory systems"
  },
  
  // Check pattern orchestration
  patternOrchestration: {
    pattern: /class\s+.*Orchestrator|selectPattern/,
    message: "Implement proper pattern orchestration"
  }
};
```

## Architecture Requirements

1. Perception System
   - Feature extraction
   - Pattern recognition
   - Multi-modal integration

2. Memory System
   - Working memory management
   - Long-term storage
   - Memory consolidation

3. Executive Control
   - Task scheduling
   - Resource allocation
   - Goal management

## Pattern Integration

1. Workflow Patterns
   - Dynamic pattern selection
   - Pattern composition
   - Pattern evaluation

2. Learning Patterns
   - Feedback integration
   - Adaptation mechanisms
   - Performance optimization

3. Memory Patterns
   - Retrieval optimization
   - Storage efficiency
   - Access patterns

## Best Practices

1. Component Design
   - Clear interfaces
   - State management
   - Error handling

2. Pattern Management
   - Context awareness
   - Pattern selection
   - Composition rules

3. Memory Usage
   - Capacity management
   - Consolidation strategies
   - Retrieval optimization

## Security Considerations

1. Component Isolation
   - Resource boundaries
   - State protection
   - Access control

2. Pattern Security
   - Input validation
   - Output verification
   - Resource limits

3. Memory Protection
   - Access control
   - Data encryption
   - Privacy preservation 