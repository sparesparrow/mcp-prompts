---
description: Universal security standards for AI systems and agent implementations
globs: ["**/*"]
priority: 90
---

# Universal Security Standards

## Core Principles

### Input/Output Security
- Validate all inputs
- Sanitize all outputs
- Implement proper encoding

### Resource Protection
- Implement rate limiting
- Control resource usage
- Monitor system health

### Data Security
- Encrypt sensitive data
- Implement access control
- Secure data transmission

## Code Standards

### Input Validation
```typescript
// Good: Proper input validation
class SecureProcessor {
  async processInput(input: unknown): Promise<Result> {
    try {
      const validated = await this.validateInput(input);
      const sanitized = this.sanitizeInput(validated);
      return this.processValidated(sanitized);
    } catch (error) {
      this.handleValidationError(error);
      throw new SecurityError('Invalid input');
    }
  }

  private async validateInput(input: unknown): Promise<ValidInput> {
    const schema = this.getValidationSchema();
    return schema.parse(input);
  }
}

// Bad: No input validation
class UnsafeProcessor {
  process(input: any) { // ❌ No validation
    return this.directProcess(input);
  }
}
```

### Resource Management
```typescript
// Good: Resource protection
class RateLimiter {
  private requests: Map<string, RequestCount>;
  private limits: RateLimits;

  async checkLimit(key: string): Promise<boolean> {
    const count = await this.getCount(key);
    if (count >= this.limits.maxRequests) {
      throw new RateLimitError(key);
    }
    await this.incrementCount(key);
    return true;
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, count] of this.requests) {
      if (count.timestamp < now - this.limits.window) {
        this.requests.delete(key);
      }
    }
  }
}

// Bad: No rate limiting
class UnsafeService {
  handle(request: Request) { // ❌ No rate limiting
    return this.process(request);
  }
}
```

### Data Protection
```typescript
// Good: Data security
class SecureStorage {
  private encryption: Encryption;
  private access: AccessControl;

  async store(data: SensitiveData): Promise<void> {
    if (!this.access.canWrite(this.getCurrentUser())) {
      throw new AccessDeniedError();
    }
    
    const encrypted = await this.encryption.encrypt(data);
    await this.persistEncrypted(encrypted);
  }

  async retrieve(id: string): Promise<SensitiveData> {
    if (!this.access.canRead(this.getCurrentUser())) {
      throw new AccessDeniedError();
    }
    
    const encrypted = await this.fetchEncrypted(id);
    return this.encryption.decrypt(encrypted);
  }
}

// Bad: Unsafe storage
class UnsafeStorage {
  save(data: any) { // ❌ No encryption
    this.db.save(data);
  }
}
```

## Validation Rules

```typescript
const SecurityRules = {
  // Ensure input validation
  inputValidation: {
    pattern: /validate.*Input|sanitize.*Input/,
    message: "Implement input validation and sanitization"
  },
  
  // Check rate limiting
  rateLimiting: {
    pattern: /class.*RateLimiter|checkLimit/,
    message: "Implement rate limiting"
  },
  
  // Verify encryption usage
  encryption: {
    pattern: /encrypt|decrypt/,
    message: "Use encryption for sensitive data"
  }
};
```

## Security Requirements

1. Input Processing
   - Schema validation
   - Type checking
   - Sanitization rules

2. Resource Control
   - Request rate limits
   - Resource quotas
   - Usage monitoring

3. Data Protection
   - Encryption standards
   - Access control
   - Audit logging

## Implementation Guidelines

1. Authentication
   - Strong authentication
   - Session management
   - Token validation

2. Authorization
   - Role-based access
   - Permission checking
   - Principle of least privilege

3. Monitoring
   - Security logging
   - Anomaly detection
   - Incident response

## Best Practices

1. Code Security
   - Secure coding patterns
   - Dependency scanning
   - Regular updates

2. System Security
   - Network isolation
   - Service hardening
   - Regular audits

3. Data Security
   - Data classification
   - Retention policies
   - Secure deletion

## Critical Protections

1. Agent Security
   - Sandbox environments
   - Resource isolation
   - Input/output validation

2. API Security
   - Authentication
   - Rate limiting
   - Request validation

3. Storage Security
   - Encryption at rest
   - Secure transmission
   - Access logging 