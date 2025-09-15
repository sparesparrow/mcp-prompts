---
description: Rules for implementing and documenting the Reflection Loop pattern for LLM self-improvement
globs: ["**/DesignPatterns/Agentic/ReflectionLoop.md"]
priority: 20
dependencies: ["01-base-design-patterns.rules.md"]
---

# Reflection Loop Pattern Rules

## Overview
These rules define requirements for implementing and documenting the Reflection Loop pattern, which enables LLMs to improve their responses through self-reflection and iteration.

## Required Sections

### 1. Pattern Structure
Must include:
```markdown
### Reflection Loop Pattern
**Intent**: Enable LLMs to improve responses through self-reflection
**Problem**: Initial LLM responses may be suboptimal or contain errors
**Solution**: Implementation details with reflection and iteration
```

### 2. Components
Must define:
- Response Generator
- Quality Evaluator
- Improvement Suggester
- Iteration Controller

## Implementation Requirements

### 1. Response Generation
```python
class ReflectionLoop:
    def __init__(self, llm_client, max_iterations: int = 3):
        """
        Initialize the reflection loop.
        
        Args:
            llm_client: LLM client for response generation
            max_iterations: Maximum number of improvement iterations
        """
        self.llm = llm_client
        self.max_iterations = max_iterations
        self.quality_threshold = 0.9
        self.improvement_history = []

    def generate_initial_response(self, prompt: str) -> str:
        """
        Generate initial response to prompt.
        
        Args:
            prompt: Input prompt
            
        Returns:
            Initial response string
        """
        try:
            response = self.llm.generate(prompt)
            self.improvement_history.append({
                'iteration': 0,
                'response': response,
                'quality_score': None
            })
            return response
        except Exception as e:
            logger.error(f"Initial generation failed: {str(e)}")
            raise GenerationError("Failed to generate initial response")
```

### 2. Quality Evaluation
```python
def evaluate_response(self, response: str, criteria: List[str]) -> float:
    """
    Evaluate response quality against criteria.
    
    Args:
        response: Response to evaluate
        criteria: List of evaluation criteria
        
    Returns:
        Quality score between 0 and 1
    """
    try:
        # Evaluate against each criterion
        scores = []
        for criterion in criteria:
            score = self.llm.evaluate_criterion(response, criterion)
            scores.append(score)
            
        # Calculate overall quality score
        quality_score = sum(scores) / len(scores)
        
        # Record evaluation
        self.improvement_history[-1]['quality_score'] = quality_score
        
        return quality_score
    except Exception as e:
        logger.error(f"Quality evaluation failed: {str(e)}")
        raise EvaluationError("Failed to evaluate response")
```

### 3. Improvement Generation
```python
def generate_improvements(
    self,
    response: str,
    quality_score: float,
    criteria: List[str]
) -> Dict[str, Any]:
    """
    Generate suggested improvements for response.
    
    Args:
        response: Current response
        quality_score: Current quality score
        criteria: Evaluation criteria
        
    Returns:
        Dict containing improvement suggestions
    """
    try:
        # Analyze areas for improvement
        weak_criteria = self._identify_weak_points(
            response,
            criteria,
            quality_score
        )
        
        # Generate specific suggestions
        suggestions = self.llm.suggest_improvements(
            response,
            weak_criteria
        )
        
        return {
            'weak_points': weak_criteria,
            'suggestions': suggestions,
            'priority': self._prioritize_improvements(suggestions)
        }
    except Exception as e:
        logger.error(f"Improvement generation failed: {str(e)}")
        raise ImprovementError("Failed to generate improvements")
```

## Validation Rules

### 1. Response Quality
Must implement:
- Quality metrics
- Criteria validation
- Progress tracking
- Convergence checking

### 2. Improvement Process
Must include:
- Weakness detection
- Suggestion generation
- Priority assignment
- History tracking

### 3. Iteration Control
Must verify:
- Termination conditions
- Progress metrics
- Resource usage
- Loop prevention

## Testing Requirements

### 1. Unit Tests
```python
def test_quality_evaluation():
    """Test response quality evaluation."""
    loop = ReflectionLoop(llm_client)
    response = "test response"
    criteria = ["clarity", "accuracy"]
    score = loop.evaluate_response(response, criteria)
    assert 0 <= score <= 1

def test_improvement_generation():
    """Test improvement suggestion generation."""
    loop = ReflectionLoop(llm_client)
    response = "test response"
    improvements = loop.generate_improvements(response, 0.5, ["clarity"])
    assert 'suggestions' in improvements
    assert len(improvements['suggestions']) > 0
```

### 2. Integration Tests
Must verify:
- End-to-end improvement
- Convergence behavior
- Resource efficiency
- Error handling

## Performance Guidelines

### 1. Optimization
- Efficient evaluation
- Smart iteration
- Progress caching
- Resource pooling

### 2. Scaling
- Handle complex responses
- Support parallel evaluation
- Manage iteration limits
- Implement timeouts

## Documentation Requirements

### 1. Architecture
Must document:
- Reflection process
- Quality metrics
- Improvement strategies
- Iteration control

### 2. Configuration
Must specify:
- Quality thresholds
- Iteration limits
- Evaluation criteria
- Timeout settings

### 3. Diagrams
Must include:
```mermaid
graph TD
    A[Initial Response] --> B[Quality Evaluator]
    B --> C{Quality Check}
    C -->|Below Threshold| D[Improvement Suggester]
    D --> E[Response Generator]
    E --> B
    C -->|Above Threshold| F[Final Response]
    
    style B fill:#2ecc71,stroke:#27ae60
    style D fill:#e74c3c,stroke:#c0392b
    style E fill:#3498db,stroke:#2980b9
```

## Review Checklist

1. Implementation
- [ ] Response generation implemented
- [ ] Quality evaluation working
- [ ] Improvement generation complete
- [ ] Iteration control robust

2. Testing
- [ ] Unit tests passing
- [ ] Integration tests complete
- [ ] Performance benchmarks run
- [ ] Convergence tests covered

3. Documentation
- [ ] Architecture documented
- [ ] Configuration guide complete
- [ ] Diagrams included
- [ ] Examples provided

## Maintenance Guidelines

1. Code Updates
- Regular metric updates
- Evaluation improvements
- Performance optimization
- Error handling refinement

2. Documentation Updates
- Keep examples current
- Update quality metrics
- Maintain tuning guide
- Document new features 