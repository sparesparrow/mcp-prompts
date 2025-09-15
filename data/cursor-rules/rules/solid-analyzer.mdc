---
description: Standards for implementing SOLID principle analysis and code improvement tools
globs: ["**/solid/**/*.{ts,js,py}", "**/analyzer/**/*.{ts,js,py}"]
priority: 36
dependencies: ["02-typescript.mdc", "03-cognitive-architecture.mdc"]
---

# SOLID Analyzer Development Standards

## Core Principles

### Analysis Architecture
- Implement modular analysis components
- Support multiple programming languages
- Enable extensible rule sets

### Improvement Generation
- Provide actionable recommendations
- Maintain code functionality
- Support progressive enhancement

### Pattern Recognition
- Implement robust pattern matching
- Support custom pattern definitions
- Enable context-aware analysis

## Code Standards

### Analyzer Implementation
```typescript
// Good: Structured analyzer
class SOLIDAnalyzer implements Analyzer {
    private patterns: Map<Principle, Pattern[]>;
    private validators: Map<string, Validator>;

    async analyze(code: string): Promise<Analysis> {
        const ast = await this.parseCode(code);
        const violations = await this.findViolations(ast);
        return this.generateReport(violations);
    }

    private async findViolations(ast: AST): Promise<Violation[]> {
        return Promise.all(
            Array.from(this.patterns.entries())
                .map(([principle, patterns]) => 
                    this.validatePrinciple(principle, patterns, ast))
        );
    }
}

// Bad: Unstructured analyzer
class BadAnalyzer {
    check(code: string) { // ❌ No proper analysis structure
        return this.findIssues(code);
    }
}
```

### Pattern Matching
```typescript
// Good: Robust pattern matching
class PatternMatcher {
    async matchPattern(ast: AST, pattern: Pattern): Promise<Match[]> {
        const context = await this.buildContext(ast);
        const matches = await this.findMatches(pattern, context);
        return this.validateMatches(matches);
    }

    private async buildContext(ast: AST): Promise<Context> {
        const scope = await this.analyzeScope(ast);
        const dependencies = await this.analyzeDependencies(ast);
        return { scope, dependencies };
    }
}

// Bad: Simple matching
class BadMatcher {
    match(code: string, pattern: string) { // ❌ No context awareness
        return code.match(pattern);
    }
}
```

### Improvement Generation
```typescript
// Good: Structured improvement generation
class ImprovementGenerator {
    async generateImprovements(violations: Violation[]): Promise<Improvement[]> {
        const improvements = [];
        for (const violation of violations) {
            const suggestions = await this.createSuggestions(violation);
            const validatedSuggestions = await this.validateSuggestions(suggestions);
            improvements.push(...validatedSuggestions);
        }
        return this.prioritizeImprovements(improvements);
    }

    private async validateSuggestions(suggestions: Suggestion[]): Promise<Suggestion[]> {
        return Promise.all(
            suggestions.map(async suggestion => {
                const isValid = await this.validateSuggestion(suggestion);
                return isValid ? suggestion : null;
            })
        ).then(results => results.filter(Boolean));
    }
}

// Bad: Simple suggestions
class BadGenerator {
    suggest(violation: string) { // ❌ No validation or context
        return this.getTemplate(violation);
    }
}
```

## Validation Rules

```typescript
const SOLIDRules = {
    // Ensure proper analysis implementation
    analysisImplementation: {
        pattern: /class.*Analyzer.*{.*analyze.*ast/,
        message: "Implement proper AST-based analysis"
    },
    
    // Check pattern matching
    patternMatching: {
        pattern: /class.*Pattern.*{.*context|scope/,
        message: "Implement context-aware pattern matching"
    },
    
    // Verify improvement generation
    improvementGeneration: {
        pattern: /validate.*Suggestions|prioritize.*Improvements/,
        message: "Implement proper improvement validation and prioritization"
    }
};
```

## Best Practices

1. Analysis Design
   - AST-based analysis
   - Context awareness
   - Pattern extensibility

2. Pattern Management
   - Clear pattern definitions
   - Validation rules
   - Context building

3. Improvement Generation
   - Code preservation
   - Progressive enhancement
   - Validation checks

## Security Considerations

1. Code Analysis
   - Safe AST parsing
   - Memory management
   - Timeout handling

2. Pattern Security
   - Input validation
   - Resource limits
   - Safe regex execution

3. Improvement Safety
   - Code validation
   - Syntax verification
   - Security preservation 