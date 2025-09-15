---
description: Rules for implementing and documenting the Orchestrator-Workers workflow pattern
globs: ["**/DesignPatterns/Workflows/OrchestratorWorkers.md"]
priority: 20
dependencies: ["01-base-design-patterns.rules.md"]
---

# Orchestrator-Workers Workflow Rules

## Overview
These rules define requirements for implementing and documenting the Orchestrator-Workers workflow pattern, where a central LLM dynamically breaks down tasks and delegates them to worker LLMs.

## Required Sections

### 1. Pattern Structure
Must include:
```markdown
### Orchestrator-Workers Workflow Pattern
**Intent**: Enable dynamic task decomposition and delegation to specialized workers
**Problem**: Complex tasks require coordinated effort from multiple specialized workers
**Solution**: Implementation details with orchestration and worker coordination
```

### 2. Components
Must define:
- Task Orchestrator
- Worker Pool
- Task Scheduler
- Result Synthesizer

## Implementation Requirements

### 1. Task Orchestration
```python
class TaskOrchestrator:
    def __init__(
        self,
        orchestrator_llm,
        worker_pool: Dict[str, Any]
    ):
        """
        Initialize the task orchestrator.
        
        Args:
            orchestrator_llm: LLM for orchestration
            worker_pool: Dict mapping worker types to LLMs
        """
        self.orchestrator = orchestrator_llm
        self.workers = worker_pool
        self.scheduler = TaskScheduler()
        self.synthesizer = ResultSynthesizer()

    def decompose_task(self, task: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Decompose task into worker assignments.
        
        Args:
            task: Complex task to decompose
            
        Returns:
            List of worker assignments
        """
        try:
            # Analyze task requirements
            analysis = self.orchestrator.analyze_task(task)
            
            # Create worker assignments
            assignments = []
            for requirement in analysis['requirements']:
                worker_type = self._select_worker_type(requirement)
                assignment = {
                    'worker_type': worker_type,
                    'subtask': requirement,
                    'dependencies': requirement.get('dependencies', [])
                }
                assignments.append(assignment)
                
            return assignments
        except Exception as e:
            logger.error(f"Task decomposition failed: {str(e)}")
            raise DecompositionError("Failed to decompose task")
```

### 2. Worker Management
```python
def assign_workers(
    self,
    assignments: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Assign tasks to appropriate workers.
    
    Args:
        assignments: List of worker assignments
        
    Returns:
        Dict mapping assignment IDs to workers
    """
    try:
        # Create execution plan
        execution_plan = self.scheduler.create_plan(assignments)
        
        # Assign workers
        worker_assignments = {}
        for assignment in execution_plan:
            worker_type = assignment['worker_type']
            if worker_type not in self.workers:
                raise WorkerError(f"No worker for type {worker_type}")
                
            worker = self.workers[worker_type]
            worker_assignments[assignment['id']] = {
                'worker': worker,
                'assignment': assignment
            }
            
        return worker_assignments
    except Exception as e:
        logger.error(f"Worker assignment failed: {str(e)}")
        raise AssignmentError("Failed to assign workers")
```

### 3. Result Synthesis
```python
def synthesize_results(
    self,
    worker_results: Dict[str, Any]
) -> Any:
    """
    Synthesize results from multiple workers.
    
    Args:
        worker_results: Dict mapping assignment IDs to results
        
    Returns:
        Synthesized final result
    """
    try:
        # Validate results
        self._validate_results(worker_results)
        
        # Order results by dependencies
        ordered_results = self.scheduler.order_results(worker_results)
        
        # Synthesize final result
        return self.synthesizer.combine_results(
            ordered_results,
            self.orchestrator
        )
    except Exception as e:
        logger.error(f"Result synthesis failed: {str(e)}")
        raise SynthesisError("Failed to synthesize results")
```

## Validation Rules

### 1. Task Management
Must implement:
- Requirement analysis
- Worker selection
- Dependency tracking
- Error handling

### 2. Worker Coordination
Must include:
- Assignment validation
- Resource management
- Progress monitoring
- Error recovery

### 3. Result Quality
Must verify:
- Synthesis validity
- Dependency satisfaction
- Completeness checking
- Output quality

## Testing Requirements

### 1. Unit Tests
```python
def test_task_decomposition():
    """Test task decomposition into worker assignments."""
    orchestrator = TaskOrchestrator(orchestrator_llm, worker_pool)
    task = {"description": "complex task", "context": {}}
    assignments = orchestrator.decompose_task(task)
    assert len(assignments) > 0
    assert all('worker_type' in a for a in assignments)

def test_worker_assignment():
    """Test worker assignment and execution."""
    orchestrator = TaskOrchestrator(orchestrator_llm, worker_pool)
    assignments = [
        {'worker_type': 'type1', 'subtask': 'task1'},
        {'worker_type': 'type2', 'subtask': 'task2'}
    ]
    worker_assignments = orchestrator.assign_workers(assignments)
    assert len(worker_assignments) == len(assignments)
```

### 2. Integration Tests
Must verify:
- End-to-end orchestration
- Worker coordination
- Error handling
- Performance metrics

## Performance Guidelines

### 1. Optimization
- Efficient orchestration
- Smart scheduling
- Resource utilization
- Result caching

### 2. Scaling
- Handle complex tasks
- Manage worker pool
- Balance workload
- Control overhead

## Documentation Requirements

### 1. Architecture
Must document:
- Orchestration strategy
- Worker management
- Scheduling approach
- Error handling

### 2. Configuration
Must specify:
- Worker settings
- Scheduling rules
- Resource limits
- Synthesis parameters

### 3. Diagrams
Must include:
```mermaid
graph TD
    A[Complex Task] --> B[Task Orchestrator]
    B --> C[Task Scheduler]
    C --> D[Worker Pool]
    D --> E[Worker 1]
    D --> F[Worker 2]
    D --> G[Worker 3]
    E & F & G --> H[Result Synthesizer]
    H --> I[Final Result]
    
    style B fill:#2ecc71,stroke:#27ae60
    style D fill:#e74c3c,stroke:#c0392b
    style H fill:#3498db,stroke:#2980b9
```

## Review Checklist

1. Implementation
- [ ] Task orchestration implemented
- [ ] Worker management working
- [ ] Result synthesis complete
- [ ] Error handling robust

2. Testing
- [ ] Unit tests passing
- [ ] Integration tests complete
- [ ] Performance benchmarks run
- [ ] Worker tests covered

3. Documentation
- [ ] Architecture documented
- [ ] Configuration guide complete
- [ ] Diagrams included
- [ ] Examples provided

## Maintenance Guidelines

1. Code Updates
- Regular orchestration optimization
- Worker pool management
- Scheduling improvements
- Error handling refinement

2. Documentation Updates
- Keep examples current
- Update worker types
- Maintain scheduling guide
- Document new features 