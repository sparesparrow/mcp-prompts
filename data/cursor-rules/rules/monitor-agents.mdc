---
description: Standards for implementing monitoring agents and observability systems
globs: ["**/monitor/**/*.{ts,js,py}", "**/agents/**/*.{ts,js,py}"]
priority: 38
dependencies: ["01-base-agentic.mdc", "03-cognitive-architecture.mdc"]
---

# Monitoring Agent Development Standards

## Core Principles

### Agent Architecture
- Implement modular monitoring components
- Support multiple data sources
- Enable real-time processing

### Data Management
- Handle data collection efficiently
- Implement proper data storage
- Support data aggregation

### Alert Management
- Implement flexible alert rules
- Support multiple notification channels
- Enable alert correlation

## Code Standards

### Monitor Implementation
```typescript
// Good: Structured monitoring
class MonitoringAgent implements Agent {
    private collectors: Map<string, DataCollector>;
    private processors: Map<string, DataProcessor>;
    private alertManager: AlertManager;

    async monitor(): Promise<void> {
        try {
            const data = await this.collectData();
            const processed = await this.processData(data);
            await this.evaluateAlerts(processed);
        } catch (error) {
            await this.handleMonitoringError(error);
            throw error;
        }
    }

    private async collectData(): Promise<MonitoringData[]> {
        return Promise.all(
            Array.from(this.collectors.values())
                .map(collector => collector.collect())
        );
    }
}

// Bad: Simple monitoring
class BadMonitor {
    check() { // ❌ No proper monitoring structure
        return this.getData();
    }
}
```

### Data Processing
```typescript
// Good: Structured data processing
class DataProcessor {
    async process(data: RawData[]): Promise<ProcessedData[]> {
        const validated = await this.validateData(data);
        const normalized = await this.normalizeData(validated);
        return this.aggregateData(normalized);
    }

    private async validateData(data: RawData[]): Promise<ValidatedData[]> {
        return Promise.all(
            data.map(async item => {
                const isValid = await this.validator.validate(item);
                if (!isValid) {
                    throw new DataValidationError(`Invalid data: ${item}`);
                }
                return item;
            })
        );
    }
}

// Bad: Simple processing
class BadProcessor {
    process(data: any[]) { // ❌ No validation or typing
        return data.map(d => d * 2);
    }
}
```

### Alert Management
```typescript
// Good: Structured alert handling
class AlertManager {
    private rules: Map<string, AlertRule>;
    private notifiers: Map<string, Notifier>;

    async evaluateAlerts(data: ProcessedData): Promise<void> {
        const triggeredRules = await this.findTriggeredRules(data);
        const correlatedAlerts = await this.correlateAlerts(triggeredRules);
        await this.sendNotifications(correlatedAlerts);
    }

    private async correlateAlerts(rules: AlertRule[]): Promise<Alert[]> {
        const correlator = new AlertCorrelator(this.correlationRules);
        return correlator.correlate(rules);
    }
}

// Bad: Simple alerting
class BadAlerting {
    alert(value: number) { // ❌ No correlation or management
        if (value > 100) this.sendAlert();
    }
}
```

## Validation Rules

```typescript
const MonitoringRules = {
    // Ensure proper monitoring implementation
    monitoringImplementation: {
        pattern: /class.*Monitor.*{.*collect.*process/,
        message: "Implement proper monitoring structure"
    },
    
    // Check data processing
    dataProcessing: {
        pattern: /validate.*Data|normalize.*Data/,
        message: "Implement proper data validation and normalization"
    },
    
    // Verify alert handling
    alertHandling: {
        pattern: /correlate.*Alerts|evaluate.*Alerts/,
        message: "Implement proper alert correlation and evaluation"
    }
};
```

## Best Practices

1. Monitor Design
   - Modular components
   - Data validation
   - Error handling

2. Data Management
   - Efficient collection
   - Proper storage
   - Aggregation support

3. Alert Handling
   - Correlation rules
   - Notification management
   - Error recovery

## Security Considerations

1. Data Collection
   - Access control
   - Data validation
   - Resource limits

2. Data Storage
   - Secure storage
   - Access logging
   - Retention policies

3. Alert Security
   - Notification validation
   - Channel security
   - Access control 