---
description: Rules for implementing and documenting the Multi-Modal Coordinator pattern for LLMs
globs: ["**/DesignPatterns/Agentic/Multi-ModalCoordinator.md"]
priority: 20
dependencies: ["01-base-design-patterns.rules.md"]
---

# Multi-Modal Coordinator Pattern Rules

## Overview
These rules define requirements for implementing and documenting the Multi-Modal Coordinator pattern, which coordinates interactions between text, images, and other modalities.

## Required Sections

### 1. Pattern Structure
Must include:
```markdown
### Multi-Modal Coordinator Pattern
**Intent**: Coordinate interactions between different modalities (text, images, etc.)
**Research Background**: Reference to papers on multi-modal LLMs
**Solution**: Implementation details with modality coordination
```

### 2. Components
Must define:
- Modality Processors
- Input Coordinator
- Output Synthesizer
- Format Converter

## Implementation Requirements

### 1. Modality Processing
```python
class MultiModalCoordinator:
    def __init__(self, modality_processors: Dict[str, Any]):
        """
        Initialize the multi-modal coordinator.
        
        Args:
            modality_processors: Dict mapping modality types to processors
        """
        self.processors = modality_processors
        self.supported_modalities = set(modality_processors.keys())
        self.converter = FormatConverter()

    def process_input(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process multi-modal inputs.
        
        Args:
            inputs: Dict mapping modality types to content
            
        Returns:
            Dict containing processed outputs for each modality
        """
        try:
            # Validate modalities
            self._validate_modalities(inputs.keys())
            
            # Process each modality
            outputs = {}
            for modality, content in inputs.items():
                processor = self.processors[modality]
                outputs[modality] = processor.process(content)
                
            return outputs
        except Exception as e:
            logger.error(f"Failed to process inputs: {str(e)}")
            raise ProcessingError("Failed to process multi-modal inputs")
```

### 2. Modality Coordination
```python
def coordinate_processing(self, inputs: Dict[str, Any]) -> None:
    """
    Coordinate processing across modalities.
    
    Args:
        inputs: Dict mapping modality types to content
    """
    try:
        # Determine processing order
        processing_order = self._determine_processing_order(inputs)
        
        # Process in sequence
        intermediate_results = {}
        for modality in processing_order:
            content = inputs[modality]
            context = self._gather_context(intermediate_results)
            result = self.processors[modality].process_with_context(
                content,
                context
            )
            intermediate_results[modality] = result
            
    except Exception as e:
        logger.error(f"Failed to coordinate processing: {str(e)}")
        raise CoordinationError("Failed to coordinate modalities")
```

### 3. Output Synthesis
```python
def synthesize_output(
    self,
    processed_inputs: Dict[str, Any],
    target_modality: str
) -> Any:
    """
    Synthesize final output in target modality.
    
    Args:
        processed_inputs: Dict of processed inputs by modality
        target_modality: Desired output modality
        
    Returns:
        Synthesized output in target modality
    """
    try:
        # Convert all inputs to target modality format
        converted_inputs = {}
        for modality, content in processed_inputs.items():
            if modality != target_modality:
                converted_inputs[modality] = self.converter.convert(
                    content,
                    from_modality=modality,
                    to_modality=target_modality
                )
            else:
                converted_inputs[modality] = content
                
        # Synthesize final output
        return self.processors[target_modality].synthesize(
            converted_inputs
        )
    except Exception as e:
        logger.error(f"Failed to synthesize output: {str(e)}")
        raise SynthesisError("Failed to synthesize output")
```

## Validation Rules

### 1. Modality Support
Must implement:
- Input validation
- Format verification
- Conversion checks
- Error handling

### 2. Processing Flow
Must include:
- Order determination
- Context sharing
- Progress tracking
- Error recovery

### 3. Output Quality
Must verify:
- Format consistency
- Content preservation
- Modality alignment
- Synthesis quality

## Testing Requirements

### 1. Unit Tests
```python
def test_modality_processing():
    """Test individual modality processing."""
    coordinator = MultiModalCoordinator(processors)
    inputs = {
        'text': 'test text',
        'image': image_data
    }
    outputs = coordinator.process_input(inputs)
    assert 'text' in outputs
    assert 'image' in outputs

def test_output_synthesis():
    """Test output synthesis to target modality."""
    coordinator = MultiModalCoordinator(processors)
    processed = {
        'text': processed_text,
        'image': processed_image
    }
    result = coordinator.synthesize_output(processed, 'text')
    assert isinstance(result, str)
```

### 2. Integration Tests
Must verify:
- Cross-modality processing
- Format conversions
- Error handling
- Output quality

## Performance Guidelines

### 1. Optimization
- Efficient conversions
- Parallel processing
- Resource sharing
- Memory management

### 2. Scaling
- Handle multiple modalities
- Support large inputs
- Manage processing load
- Implement timeouts

## Documentation Requirements

### 1. Architecture
Must document:
- Modality handling
- Processing flow
- Conversion logic
- Synthesis approach

### 2. Configuration
Must specify:
- Supported modalities
- Processing parameters
- Conversion settings
- Quality thresholds

### 3. Diagrams
Must include:
```mermaid
graph TD
    A[Multi-Modal Input] --> B[Input Coordinator]
    B --> C[Text Processor]
    B --> D[Image Processor]
    B --> E[Audio Processor]
    C & D & E --> F[Context Aggregator]
    F --> G[Output Synthesizer]
    G --> H[Final Output]
    
    style B fill:#2ecc71,stroke:#27ae60
    style F fill:#e74c3c,stroke:#c0392b
    style G fill:#3498db,stroke:#2980b9
```

## Review Checklist

1. Implementation
- [ ] Modality processing implemented
- [ ] Coordination logic working
- [ ] Output synthesis complete
- [ ] Error handling robust

2. Testing
- [ ] Unit tests passing
- [ ] Integration tests complete
- [ ] Performance benchmarks run
- [ ] Format tests covered

3. Documentation
- [ ] Architecture documented
- [ ] Configuration guide complete
- [ ] Diagrams included
- [ ] Examples provided

## Maintenance Guidelines

1. Code Updates
- Regular processor updates
- Conversion improvements
- Performance optimization
- Error handling refinement

2. Documentation Updates
- Keep examples current
- Update supported formats
- Maintain troubleshooting guide
- Document new features 

### Error Handling

```python
class MultiModalError(Exception):
    """Base class for multi-modal processing errors."""
    pass

class ModalityError(MultiModalError):
    """Error in specific modality processing."""
    def __init__(self, modality: str, message: str):
        self.modality = modality
        super().__init__(f"Error in {modality}: {message}")

class ConversionError(MultiModalError):
    """Error in modality conversion."""
    def __init__(self, from_mod: str, to_mod: str, message: str):
        self.from_mod = from_mod
        self.to_mod = to_mod
        super().__init__(
            f"Conversion error {from_mod}->{to_mod}: {message}"
        )

class ValidationError(MultiModalError):
    """Error in input validation."""
    pass

def handle_modality_error(
    error: ModalityError,
    context: Dict[str, Any]
) -> Any:
    """
    Handle modality-specific errors.
    
    Args:
        error: The modality error
        context: Processing context
        
    Returns:
        Fallback result or raises
    """
    logger.error(
        f"Modality error in {error.modality}",
        extra={'context': context}
    )
    
    if error.modality in FALLBACK_PROCESSORS:
        return FALLBACK_PROCESSORS[error.modality](context)
    raise

def safe_convert_modality(
    content: Any,
    from_mod: str,
    to_mod: str,
    context: Dict[str, Any]
) -> Any:
    """
    Safely convert between modalities with error handling.
    
    Args:
        content: Content to convert
        from_mod: Source modality
        to_mod: Target modality
        context: Conversion context
        
    Returns:
        Converted content
        
    Raises:
        ConversionError: If conversion fails
    """
    try:
        converter = get_converter(from_mod, to_mod)
        return converter.convert(content, context)
    except Exception as e:
        raise ConversionError(
            from_mod,
            to_mod,
            str(e)
        ) from e
```

### Validation Requirements

```python
def validate_modality_input(
    modality: str,
    content: Any
) -> bool:
    """
    Validate input for specific modality.
    
    Args:
        modality: Modality type
        content: Content to validate
        
    Returns:
        bool indicating if content is valid
        
    Raises:
        ValidationError: If validation fails
    """
    validator = MODALITY_VALIDATORS.get(modality)
    if not validator:
        raise ValidationError(f"No validator for {modality}")
        
    try:
        return validator.validate(content)
    except Exception as e:
        raise ValidationError(f"Validation failed: {str(e)}")

def validate_conversion_path(
    from_mod: str,
    to_mod: str
) -> List[str]:
    """
    Validate and get conversion path between modalities.
    
    Args:
        from_mod: Source modality
        to_mod: Target modality
        
    Returns:
        List of intermediate conversion steps
        
    Raises:
        ConversionError: If no valid path exists
    """
    try:
        return find_conversion_path(from_mod, to_mod)
    except Exception as e:
        raise ConversionError(
            from_mod,
            to_mod,
            f"No conversion path: {str(e)}"
        )
```

### Recovery Mechanisms

```python
class ModalityRecovery:
    """Recovery mechanisms for modality processing."""
    
    def __init__(self):
        self.recovery_strategies = {}
        self.fallback_processors = {}
        
    def register_recovery(
        self,
        error_type: Type[Exception],
        strategy: Callable
    ) -> None:
        """Register recovery strategy for error type."""
        self.recovery_strategies[error_type] = strategy
        
    def register_fallback(
        self,
        modality: str,
        processor: Callable
    ) -> None:
        """Register fallback processor for modality."""
        self.fallback_processors[modality] = processor
        
    def attempt_recovery(
        self,
        error: Exception,
        context: Dict[str, Any]
    ) -> Any:
        """
        Attempt to recover from error.
        
        Args:
            error: The error to recover from
            context: Recovery context
            
        Returns:
            Recovery result or raises
        """
        for error_type, strategy in self.recovery_strategies.items():
            if isinstance(error, error_type):
                return strategy(error, context)
        raise error
```

### Testing Requirements

```python
class TestMultiModalProcessing(unittest.TestCase):
    """Test multi-modal processing with error cases."""
    
    def setUp(self):
        self.coordinator = MultiModalCoordinator()
        self.recovery = ModalityRecovery()
        
    def test_modality_validation(self):
        """Test modality input validation."""
        with self.assertRaises(ValidationError):
            self.coordinator.process_input({
                'text': None,  # Invalid
                'image': 'valid.jpg'
            })
            
    def test_conversion_errors(self):
        """Test modality conversion errors."""
        with self.assertRaises(ConversionError):
            self.coordinator.convert_modality(
                'invalid_content',
                'text',
                'image'
            )
            
    def test_recovery_mechanism(self):
        """Test error recovery mechanisms."""
        def recovery_strategy(error, context):
            return {'recovered': True}
            
        self.recovery.register_recovery(
            ModalityError,
            recovery_strategy
        )
        
        result = self.recovery.attempt_recovery(
            ModalityError('text', 'test error'),
            {}
        )
        self.assertTrue(result['recovered'])
```

### Performance Requirements

```python
class PerformanceMonitor:
    """Monitor multi-modal processing performance."""
    
    def __init__(self):
        self.metrics = defaultdict(list)
        
    def record_metric(
        self,
        metric_name: str,
        value: float
    ) -> None:
        """Record performance metric."""
        self.metrics[metric_name].append({
            'value': value,
            'timestamp': time.time()
        })
        
    def check_thresholds(self) -> List[str]:
        """Check performance thresholds."""
        violations = []
        for metric, values in self.metrics.items():
            if self._is_threshold_violated(metric, values):
                violations.append(metric)
        return violations
        
    def generate_report(self) -> Dict[str, Any]:
        """Generate performance report."""
        return {
            'metrics': self.metrics,
            'violations': self.check_thresholds(),
            'timestamp': time.time()
        }
```

### Documentation Requirements

```python
class MultiModalProcessor:
    """
    Process multi-modal inputs with error handling.
    
    Attributes:
        supported_modalities (Set[str]): Supported input types
        converters (Dict[str, Converter]): Modality converters
        validators (Dict[str, Validator]): Input validators
        
    Error Handling:
        - ValidationError: Invalid input format
        - ModalityError: Processing error in specific modality
        - ConversionError: Error converting between modalities
        
    Recovery:
        1. Attempt modality-specific recovery
        2. Use fallback processor if available
        3. Convert to alternative modality
        4. Return partial results with warnings
    """
    
    def process_input(
        self,
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process multi-modal inputs safely.
        
        Args:
            inputs: Dict mapping modality to content
            
        Returns:
            Processed results per modality
            
        Raises:
            ValidationError: If input validation fails
            ModalityError: If processing fails
            ConversionError: If conversion fails
        """
        pass
``` 