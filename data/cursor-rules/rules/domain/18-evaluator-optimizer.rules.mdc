---
description: Rules for implementing and documenting the Evaluator-Optimizer workflow pattern
globs: ["**/DesignPatterns/Workflows/EvaluatorOptimizer.md"]
priority: 20
dependencies: ["01-base-design-patterns.rules.md"]
---

# Evaluator-Optimizer Workflow Rules

## Overview
These rules define requirements for implementing and documenting the Evaluator-Optimizer workflow pattern, where one LLM call generates a response while another provides evaluation and feedback in a loop.

## Required Sections

### 1. Pattern Structure
Must include:
```markdown
### Evaluator-Optimizer Workflow Pattern
**Intent**: Enable iterative response improvement through evaluation and feedback
**Problem**: Initial responses may not meet quality criteria
**Solution**: Implementation details with evaluation and optimization loop
```

### 2. Components
Must define:
- Response Generator
- Quality Evaluator
- Feedback Generator
- Optimization Controller

## Implementation Requirements

### 1. Response Generation
```python
class EvaluatorOptimizer:
    def __init__(
        self,
        generator_llm,
        evaluator_llm,
        max_iterations: int = 3
    ):
        """
        Initialize the evaluator-optimizer.
        
        Args:
            generator_llm: LLM for response generation
            evaluator_llm: LLM for evaluation
            max_iterations: Maximum optimization iterations
        """
        self.generator = generator_llm
        self.evaluator = evaluator_llm
        self.max_iterations = max_iterations
        self.quality_threshold = 0.9
        self.improvement_history = []

    def generate_response(self, prompt: str) -> str:
        """
        Generate initial response to prompt.
        
        Args:
            prompt: Input prompt
            
        Returns:
            Generated response
        """
        try:
            # Generate initial response
            response = self.generator.generate(prompt)
            
            # Record in history
            self.improvement_history.append({
                'iteration': 0,
                'response': response,
                'quality_score': None,
                'feedback': None
            })
            
            return response
        except Exception as e:
            logger.error(f"Response generation failed: {str(e)}")
            raise GenerationError("Failed to generate response")
```

### 2. Response Evaluation
```python
def evaluate_response(
    self,
    response: str,
    criteria: List[str]
) -> Dict[str, Any]:
    """
    Evaluate response quality and generate feedback.
    
    Args:
        response: Response to evaluate
        criteria: Evaluation criteria
        
    Returns:
        Dict with quality score and feedback
    """
    try:
        # Create evaluation prompt
        eval_prompt = self._create_eval_prompt(response, criteria)
        
        # Get evaluation from LLM
        evaluation = self.evaluator.evaluate(eval_prompt)
        
        # Extract score and feedback
        quality_score = evaluation['score']
        feedback = evaluation['feedback']
        
        # Record in history
        current_iteration = len(self.improvement_history) - 1
        self.improvement_history[current_iteration].update({
            'quality_score': quality_score,
            'feedback': feedback
        })
        
        return {
            'quality_score': quality_score,
            'feedback': feedback
        }
    except Exception as e:
        logger.error(f"Response evaluation failed: {str(e)}")
        raise EvaluationError("Failed to evaluate response")
```

### 3. Response Optimization
```python
def optimize_response(
    self,
    original_prompt: str,
    current_response: str,
    feedback: Dict[str, Any]
) -> str:
    """
    Optimize response based on feedback.
    
    Args:
        original_prompt: Original input prompt
        current_response: Current response
        feedback: Evaluation feedback
        
    Returns:
        Optimized response
    """
    try:
        # Create optimization prompt
        opt_prompt = self._create_optimization_prompt(
            original_prompt,
            current_response,
            feedback
        )
        
        # Generate improved response
        improved_response = self.generator.generate(opt_prompt)
        
        # Record in history
        self.improvement_history.append({
            'iteration': len(self.improvement_history),
            'response': improved_response,
            'quality_score': None,
            'feedback': None
        })
        
        return improved_response
    except Exception as e:
        logger.error(f"Response optimization failed: {str(e)}")
        raise OptimizationError("Failed to optimize response")
```

## Validation Rules

### 1. Generation Quality
Must implement:
- Input validation
- Output verification
- History tracking
- Error handling

### 2. Evaluation Process
Must include:
- Criteria validation
- Score calculation
- Feedback generation
- Progress tracking

### 3. Optimization Control
Must verify:
- Improvement metrics
- Convergence checking
- Resource usage
- Loop prevention

## Testing Requirements

### 1. Unit Tests
```python
def test_response_generation():
    """Test initial response generation."""
    optimizer = EvaluatorOptimizer(generator_llm, evaluator_llm)
    response = optimizer.generate_response("test prompt")
    assert response is not None
    assert len(optimizer.improvement_history) == 1

def test_response_evaluation():
    """Test response evaluation and feedback."""
    optimizer = EvaluatorOptimizer(generator_llm, evaluator_llm)
    response = optimizer.generate_response("test prompt")
    evaluation = optimizer.evaluate_response(response, ["clarity"])
    assert 'quality_score' in evaluation
    assert 'feedback' in evaluation
```

### 2. Integration Tests
Must verify:
- End-to-end optimization
- Convergence behavior
- Error handling
- Performance metrics

## Performance Guidelines

### 1. Optimization
- Efficient evaluation
- Smart iteration
- Progress tracking
- Resource management

### 2. Scaling
- Handle complex responses
- Manage iterations
- Control quality
- Implement timeouts

## Documentation Requirements

### 1. Architecture
Must document:
- Evaluation strategy
- Optimization process
- Quality metrics
- Error handling

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
    A[Input Prompt] --> B[Response Generator]
    B --> C[Quality Evaluator]
    C --> D{Quality Check}
    D -->|Below Threshold| E[Feedback Generator]
    E --> F[Response Optimizer]
    F --> C
    D -->|Above Threshold| G[Final Response]
    
    style B fill:#2ecc71,stroke:#27ae60
    style C fill:#e74c3c,stroke:#c0392b
    style F fill:#3498db,stroke:#2980b9
```

## Review Checklist

1. Implementation
- [ ] Response generation implemented
- [ ] Quality evaluation working
- [ ] Optimization complete
- [ ] Error handling robust

2. Testing
- [ ] Unit tests passing
- [ ] Integration tests complete
- [ ] Performance benchmarks run
- [ ] Quality tests covered

3. Documentation
- [ ] Architecture documented
- [ ] Configuration guide complete
- [ ] Diagrams included
- [ ] Examples provided

## Maintenance Guidelines

1. Code Updates
- Regular quality tuning
- Evaluation refinement
- Performance optimization
- Error handling improvements

2. Documentation Updates
- Keep examples current
- Update quality metrics
- Maintain optimization guide
- Document new features 