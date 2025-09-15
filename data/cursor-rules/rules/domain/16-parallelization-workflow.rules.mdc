---
description: Rules for implementing and documenting the Parallelization workflow pattern
globs: ["**/DesignPatterns/Workflows/Parallelization.md"]
priority: 20
dependencies: ["01-base-design-patterns.rules.md"]
---

# Parallelization Workflow Rules

## Overview
These rules define requirements for implementing and documenting the Parallelization workflow pattern, which enables simultaneous task processing and result aggregation.

## Required Sections

### 1. Pattern Structure
Must include:
```markdown
### Parallelization Workflow Pattern
**Intent**: Enable parallel processing of tasks with result aggregation
**Problem**: Sequential processing is inefficient for independent tasks
**Solution**: Implementation details with parallel execution and aggregation
```

### 2. Components
Must define:
- Task Splitter
- Parallel Executor
- Result Aggregator
- Resource Manager

## Implementation Requirements

### 1. Task Management
```python
class ParallelProcessor:
    def __init__(
        self,
        llm_client,
        max_workers: int = 5,
        timeout: int = 30
    ):
        """
        Initialize the parallel processor.
        
        Args:
            llm_client: LLM client for processing
            max_workers: Maximum concurrent workers
            timeout: Operation timeout in seconds
        """
        self.llm = llm_client
        self.max_workers = max_workers
        self.timeout = timeout
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    def split_task(self, task: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Split task into parallel subtasks.
        
        Args:
            task: Task to split
            
        Returns:
            List of subtasks
        """
        try:
            # Analyze task for parallelization
            analysis = self._analyze_parallelization(task)
            
            # Generate subtasks
            subtasks = []
            for component in analysis['components']:
                subtask = self._create_subtask(
                    component,
                    task['context']
                )
                subtasks.append(subtask)
                
            return subtasks
        except Exception as e:
            logger.error(f"Task splitting failed: {str(e)}")
            raise SplittingError("Failed to split task")
```

### 2. Parallel Execution
```python
def execute_parallel(
    self,
    subtasks: List[Dict[str, Any]]
) -> List[Any]:
    """
    Execute subtasks in parallel.
    
    Args:
        subtasks: List of subtasks to execute
        
    Returns:
        List of results
    """
    try:
        # Submit all tasks
        futures = []
        for subtask in subtasks:
            future = self.executor.submit(
                self._process_subtask,
                subtask
            )
            futures.append(future)
            
        # Gather results
        results = []
        for future in as_completed(futures, timeout=self.timeout):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                logger.error(f"Subtask failed: {str(e)}")
                results.append(None)
                
        return results
    except TimeoutError:
        logger.error("Parallel execution timed out")
        raise ExecutionError("Execution timed out")
```

### 3. Result Aggregation
```python
def aggregate_results(
    self,
    results: List[Any],
    aggregation_type: str = 'default'
) -> Any:
    """
    Aggregate parallel execution results.
    
    Args:
        results: List of results to aggregate
        aggregation_type: Type of aggregation to perform
        
    Returns:
        Aggregated result
    """
    try:
        # Remove failed results
        valid_results = [r for r in results if r is not None]
        
        # Select aggregation strategy
        if aggregation_type == 'voting':
            return self._aggregate_by_voting(valid_results)
        elif aggregation_type == 'consensus':
            return self._aggregate_by_consensus(valid_results)
        else:
            return self._aggregate_default(valid_results)
    except Exception as e:
        logger.error(f"Result aggregation failed: {str(e)}")
        raise AggregationError("Failed to aggregate results")
```

## Validation Rules

### 1. Task Management
Must implement:
- Parallelization analysis
- Resource allocation
- Dependency checking
- Error handling

### 2. Execution Control
Must include:
- Worker management
- Timeout handling
- Progress tracking
- Resource monitoring

### 3. Result Quality
Must verify:
- Aggregation validity
- Consistency checking
- Error recovery
- Output quality

## Testing Requirements

### 1. Unit Tests
```python
def test_task_splitting():
    """Test task splitting for parallel execution."""
    processor = ParallelProcessor(llm_client)
    task = {"data": "test", "context": {}}
    subtasks = processor.split_task(task)
    assert len(subtasks) > 1
    assert all('context' in st for st in subtasks)

def test_parallel_execution():
    """Test parallel execution of subtasks."""
    processor = ParallelProcessor(llm_client)
    subtasks = [{"data": f"test{i}"} for i in range(3)]
    results = processor.execute_parallel(subtasks)
    assert len(results) == len(subtasks)
```

### 2. Integration Tests
Must verify:
- End-to-end processing
- Resource utilization
- Error handling
- Performance metrics

## Performance Guidelines

### 1. Optimization
- Efficient splitting
- Smart scheduling
- Resource pooling
- Result caching

### 2. Scaling
- Handle many tasks
- Manage resources
- Balance load
- Control timeouts

## Documentation Requirements

### 1. Architecture
Must document:
- Parallelization strategy
- Execution flow
- Resource management
- Error handling

### 2. Configuration
Must specify:
- Worker settings
- Timeout limits
- Resource limits
- Aggregation rules

### 3. Diagrams
Must include:
```mermaid
graph TD
    A[Task] --> B[Task Splitter]
    B --> C[Worker Pool]
    C --> D[Worker 1]
    C --> E[Worker 2]
    C --> F[Worker 3]
    D & E & F --> G[Result Aggregator]
    G --> H[Final Result]
    I[Resource Manager] --> C
    
    style B fill:#2ecc71,stroke:#27ae60
    style C fill:#e74c3c,stroke:#c0392b
    style G fill:#3498db,stroke:#2980b9
```

## Review Checklist

1. Implementation
- [ ] Task splitting implemented
- [ ] Parallel execution working
- [ ] Result aggregation complete
- [ ] Error handling robust

2. Testing
- [ ] Unit tests passing
- [ ] Integration tests complete
- [ ] Performance benchmarks run
- [ ] Resource tests covered

3. Documentation
- [ ] Architecture documented
- [ ] Configuration guide complete
- [ ] Diagrams included
- [ ] Examples provided

## Maintenance Guidelines

1. Code Updates
- Regular performance tuning
- Resource optimization
- Execution improvements
- Error handling refinement

2. Documentation Updates
- Keep examples current
- Update execution patterns
- Maintain resource guide
- Document new features 