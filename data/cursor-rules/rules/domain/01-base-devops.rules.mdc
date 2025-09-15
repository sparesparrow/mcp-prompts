---
description: Standards for implementing AI-driven DevOps pipelines and automation
globs: ["**/*.{yml,yaml,json,ts,js}", ".github/**/*", "Dockerfile*"]
priority: 15
---

# AI DevOps Pipeline Standards

## Core Components

### Predictive Analytics & Monitoring
- Implement proactive issue detection
- Use ML models for anomaly detection
- Set up comprehensive logging and metrics

### Automated Testing & Code Generation
- Implement AI-driven test case generation
- Use code quality analysis tools
- Automate code review processes

### Self-Healing Systems
- Implement auto-remediation capabilities
- Set up dynamic resource allocation
- Monitor system health metrics

## Code Standards

### Pipeline Configuration
```yaml
# Good: Structured pipeline with AI integration
name: AI-Enhanced CI/CD
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: AI Code Review
        uses: ai-code-review@v1
        with:
          model: 'code-review-v1'
          
  test:
    needs: analyze
    steps:
      - name: Generate Tests
        uses: ai-test-gen@v1
        
# Bad: Basic pipeline without intelligence
name: Basic CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2 # ❌ Missing intelligence layer
```

### Monitoring Implementation
```typescript
// Good: AI-driven monitoring
class AIPoweredMonitoring {
  async detectAnomalies(metrics: Metrics[]): Promise<Alert[]> {
    const predictions = await this.model.predict(metrics);
    return this.analyzeAnomalies(predictions);
  }
  
  private async analyzeAnomalies(predictions: Prediction[]): Promise<Alert[]> {
    return predictions
      .filter(p => p.confidence > this.threshold)
      .map(p => this.createAlert(p));
  }
}

// Bad: Simple threshold monitoring
class BasicMonitoring {
  checkMetrics(metrics: Metrics[]) {
    return metrics.filter(m => m.value > threshold); // ❌ No intelligence
  }
}
```

### Resource Management
```typescript
// Good: ML-based resource allocation
class ResourceManager {
  async optimizeResources(usage: Usage[]): Promise<Allocation[]> {
    const prediction = await this.predictFutureUsage(usage);
    return this.allocateBasedOnPrediction(prediction);
  }
}

// Bad: Static allocation
class BasicManager {
  allocateResources() {
    return DEFAULT_ALLOCATION; // ❌ No dynamic adjustment
  }
}
```

## Validation Rules

```typescript
const DevOpsRules = {
  // Ensure AI integration in pipelines
  requireAIIntegration: {
    pattern: /uses:\s*.*ai-.*@v\d/,
    message: "Pipelines should integrate AI capabilities"
  },
  
  // Validate monitoring implementation
  monitoringImplementation: {
    pattern: /class.*Monitoring.*{[^}]*predict|analyze/,
    message: "Monitoring should include predictive capabilities"
  },
  
  // Check for dynamic resource management
  resourceManagement: {
    pattern: /predict.*Usage|optimize.*Resources/,
    message: "Resource management should be dynamic and predictive"
  }
};
```

## Security Considerations

1. Model Security
   - Validate ML model inputs and outputs
   - Monitor for model drift
   - Implement model versioning

2. Pipeline Security
   - Secure CI/CD configurations
   - Implement least privilege access
   - Scan for security vulnerabilities

3. Resource Protection
   - Implement resource quotas
   - Monitor resource usage patterns
   - Set up abuse detection

## Infrastructure Requirements

1. Containerization
   - Use secure base images
   - Implement multi-stage builds
   - Regular security updates

2. Monitoring Stack
   - Prometheus for metrics
   - Grafana for visualization
   - ELK for log analysis

3. AI Integration
   - Model serving infrastructure
   - Feature store setup
   - Model monitoring tools 