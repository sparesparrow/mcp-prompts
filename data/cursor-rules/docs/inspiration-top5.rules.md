---
description: Top 5 inspiration rules to guide writing and structuring of Cursor rules
globs: ["**/*"]
priority: 50
---

# Top 5 Inspiration Rules for Cursor Rule Writing

This ruleset compiles the top 5 inspirations and ideas derived from the hard-coder repository insights and community discussions. These guidelines are designed to help you build a robust, maintainable, and secure ruleset for your project.

> **References:**
> - [Good examples of .cursorrules file](https://forum.cursor.com/t/good-examples-of-cursorrules-file/4346)
> - [Best practices: .cursorrules](https://forum.cursor.com/t/best-practices-cursorrules/41775)

---

## 1. Modularity and Hierarchical Layering

**Inspiration:** Divide your rules into modular components using numeric prefixes and clear domain segmentation. This ensures that core, framework-specific, and security rules are applied in order and can override each other where necessary.

**Guidelines:**
- Use numeric prefixes (e.g., 01-, 02-, etc.) to establish priority and layering.
- Segment rules by domain: Base, Language, Framework, Domain-specific, and Security.

**Example Implementation:**

```markdown
---
description: Base rules for all files
globs: ["**/*"]
priority: 10
---
```

## 2. Structured Validation and Enforcement

**Inspiration:** Leverage machine-readable validations using regex, AST patterns, and JSON schemas to ensure that the defined standards are enforced consistently across your codebase.

**Guidelines:**
- Include validation rules that check for proper error handling, type safety, and structural patterns.
- Use patterns that are precise and testable.

**Example Implementation:**

```typescript
const ValidationRules = {
  noExplicitAny: {
    pattern: /: any(?!\s*\/\/\s*allowed)/,
    message: "Avoid using 'any' type"
  },
  properErrorHandling: {
    pattern: /catch\s*\(error:\s*[A-Z][A-Za-z]+Error\)/,
    message: "Use typed error handling"
  }
};
```

## 3. CI/CD Integration for Progressive Enforcement

**Inspiration:** Integrate your rules into the CI/CD pipeline to automatically enforce and report on rule compliance. This ensures that changes are continuously validated and the codebase remains consistent.

**Guidelines:**
- Embed rule validations into your pipeline configuration.
- Use automated tools to scan and report rule violations.

**Example Implementation:**

```yaml
# CI/CD snippet for rule validation
name: Validate Cursor Rules
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Rule Validator
        run: cursor validate --rules .cursor/rules
```

## 4. Dynamic Feedback and Iterative Improvement

**Inspiration:** Implement iterative execution flows with progress tracking, safe rollbacks, and feedback loops to continuously refine and improve rule enforcement.

**Guidelines:**
- Track execution progress and maintain a log of rule validations.
- Integrate retry and rollback mechanisms when errors occur.

**Example Implementation:**

```typescript
class ExecutionManager {
  async executeWithFeedback(plan: ExecutionPlan): Promise<Result> {
    try {
      // Execute each step with feedback and progress tracking
      for (const step of plan.steps) {
        await this.executeStep(step);
        this.logProgress(step);
      }
      return this.finalizeExecution(plan);
    } catch (error) {
      await this.rollback(plan);
      throw error;
    }
  }
}
```

## 5. Security-First Approach

**Inspiration:** Embed security considerations into every rule. Ensure that input validation, rate limiting, and data protection measures are integral parts of the ruleset to safeguard the system.

**Guidelines:**
- Create universal security rules that apply to all code.
- Prioritize security with high priority levels in the ruleset.

**Example Implementation:**

```markdown
---
description: Universal security rules for all components
globs: ["**/*"]
priority: 90
---
```

---

By following these top 5 inspirations, you can build a comprehensive and maintainable ruleset for Cursor that enhances code quality and enforces best practices continuously. 