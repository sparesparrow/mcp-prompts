import pino from 'pino';
// import disabled for build
// import disabled for build
import { Domain, PromptLayer, SimpleMcpPromptsClient } from '../../types.js';
import { PatternSynthesisService, EpisodePattern } from './pattern-synthesis.service.js';
import { UsageTrackingService, UsageAnalytics } from './usage-tracking.service.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface PromptGenerationContext {
  trigger: 'novel_pattern' | 'ineffective_prompt' | 'usage_pattern' | 'user_request';
  confidence: number;
  supportingData: any;
  domain: Domain;
  complexity: 'low' | 'medium' | 'high';
}

export interface GeneratedPrompt {
  id: string;
  name: string;
  content: string;
  layer: PromptLayer;
  domain: Domain;
  tags: string[];
  abstractionLevel: number;
  generationReason: string;
  expectedEffectiveness: number;
  createdAt: Date;
}

export class AutomaticPromptGenerationService {
  private mcpClient: SimpleMcpPromptsClient;
  private patternService: PatternSynthesisService;
  private usageService: UsageTrackingService;

  // Generation thresholds
  private minNoveltyScore = 0.7; // Minimum novelty for new prompt creation
  private minEffectivenessThreshold = 0.3; // Below this, consider generating improvement
  private maxPromptsPerDay = 5; // Limit prompt generation rate
  private generatedToday = 0;
  private lastGenerationDate = new Date().toDateString();

  constructor(
    mcpClient?: SimpleMcpPromptsClient,
    patternService?: PatternSynthesisService,
    usageService?: UsageTrackingService
  ) {
    this.mcpClient = mcpClient || new SimpleMcpPromptsClient();
    this.patternService = patternService || new PatternSynthesisService();
    this.usageService = usageService || new UsageTrackingService(null as any); // Will be properly initialized
  }

  /**
   * Evaluate and potentially generate new prompts based on system observations
   */
  async evaluateAndGeneratePrompts(): Promise<GeneratedPrompt[]> {
    logger.info('Evaluating system for automatic prompt generation opportunities');

    const generatedPrompts: GeneratedPrompt[] = [];

    // Reset daily counter if it's a new day
    if (new Date().toDateString() !== this.lastGenerationDate) {
      this.generatedToday = 0;
      this.lastGenerationDate = new Date().toDateString();
    }

    if (this.generatedToday >= this.maxPromptsPerDay) {
      logger.info('Reached maximum prompts per day limit');
      return generatedPrompts;
    }

    try {
      // 1. Check for novel patterns that need prompts
      const novelPatterns = await this.identifyNovelPatterns();
      for (const pattern of novelPatterns) {
        if (this.generatedToday >= this.maxPromptsPerDay) break;

        const prompt = await this.generatePatternPrompt(pattern);
        if (prompt) {
          generatedPrompts.push(prompt);
          this.generatedToday++;
        }
      }

      // 2. Check for ineffective prompts that need improvement
      const ineffectivePrompts = await this.identifyIneffectivePrompts();
      for (const promptData of ineffectivePrompts) {
        if (this.generatedToday >= this.maxPromptsPerDay) break;

        const improvedPrompt = await this.generateImprovedPrompt(promptData);
        if (improvedPrompt) {
          generatedPrompts.push(improvedPrompt);
          this.generatedToday++;
        }
      }

      // 3. Check for usage patterns that suggest new prompt needs
      const usagePatterns = await this.identifyUsagePatterns();
      for (const pattern of usagePatterns) {
        if (this.generatedToday >= this.maxPromptsPerDay) break;

        const prompt = await this.generateUsagePatternPrompt(pattern);
        if (prompt) {
          generatedPrompts.push(prompt);
          this.generatedToday++;
        }
      }

      // 4. Check for domain gaps that need coverage
      const domainGaps = await this.identifyDomainGaps();
      for (const gap of domainGaps) {
        if (this.generatedToday >= this.maxPromptsPerDay) break;

        const prompt = await this.generateDomainGapPrompt(gap);
        if (prompt) {
          generatedPrompts.push(prompt);
          this.generatedToday++;
        }
      }

      logger.info(`Generated ${generatedPrompts.length} new prompts`);

    } catch (error) {
      logger.error('Error during automatic prompt generation:', error);
    }

    return generatedPrompts;
  }

  /**
   * Manually trigger prompt generation for a specific context
   */
  async generatePromptForContext(context: PromptGenerationContext): Promise<GeneratedPrompt | null> {
    logger.info(`Generating prompt for context: ${context.trigger}`, { confidence: context.confidence });

    let prompt: GeneratedPrompt | null = null;

    switch (context.trigger) {
      case 'novel_pattern':
        prompt = await this.generateNovelPatternPrompt(context.supportingData);
        break;
      case 'ineffective_prompt':
        prompt = await this.generateIneffectivePromptImprovement(context.supportingData);
        break;
      case 'usage_pattern':
        prompt = await this.generateUsageBasedPrompt(context.supportingData);
        break;
      case 'user_request':
        prompt = await this.generateUserRequestedPrompt(context.supportingData);
        break;
    }

    if (prompt) {
      // Validate the generated prompt
      if (await this.validateGeneratedPrompt(prompt)) {
        await this.saveGeneratedPrompt(prompt);
        logger.info(`Successfully generated and saved prompt: ${prompt.name}`);
        return prompt;
      } else {
        logger.warn(`Generated prompt failed validation: ${prompt.name}`);
      }
    }

    return null;
  }

  private async identifyNovelPatterns(): Promise<EpisodePattern[]> {
    const patterns = this.patternService.getPatterns();

    // Filter for high-confidence patterns that don't have corresponding prompts
    const novelPatterns: EpisodePattern[] = [];

    for (const pattern of patterns) {
      if (pattern.confidence >= this.minNoveltyScore) {
        // Check if we already have a prompt for this pattern
        const existingPrompts = await this.mcpClient.searchPrompts({
          tags: ['pattern', pattern.patternId],
          limit: 1
        });

        if (existingPrompts.length === 0) {
          novelPatterns.push(pattern);
        }
      }
    }

    return novelPatterns.sort((a, b) => b.confidence - a.confidence);
  }

  private async identifyIneffectivePrompts(): Promise<Array<{ promptId: string; analytics: UsageAnalytics }>> {
    // Get all prompts and their usage analytics
    // This would need to be implemented to fetch all prompts
    const ineffectivePrompts: Array<{ promptId: string; analytics: UsageAnalytics }> = [];

    // Placeholder implementation
    // In real implementation, would query all prompts and check effectiveness

    return ineffectivePrompts;
  }

  private async identifyUsagePatterns(): Promise<any[]> {
    // Analyze usage tracking data for patterns that suggest new prompt needs
    const usagePatterns = this.usageService.getUsagePatterns();

    const patterns: any[] = [];

    // Look for common failure modes that don't have good prompts
    if (usagePatterns.domainDistribution) {
      for (const [domain, count] of Object.entries(usagePatterns.domainDistribution)) {
        if (count > 10) { // Significant usage in this domain
          // Check if we have adequate prompt coverage for this domain
          const domainPrompts = await this.mcpClient.searchPrompts({
            tags: [domain.toLowerCase()],
            limit: 10
          });

          if (domainPrompts.length < 3) { // Insufficient coverage
            patterns.push({
              type: 'domain_coverage_gap',
              domain,
              usageCount: count,
              existingPrompts: domainPrompts.length
            });
          }
        }
      }
    }

    return patterns;
  }

  private async identifyDomainGaps(): Promise<any[]> {
    // Analyze which domains have usage but poor prompt coverage
    const gaps: any[] = [];

    // This would analyze usage patterns vs prompt availability
    // Placeholder implementation

    return gaps;
  }

  private async generatePatternPrompt(pattern: EpisodePattern): Promise<GeneratedPrompt | null> {
    const promptContent = this.buildPatternPromptContent(pattern);

    const prompt: GeneratedPrompt = {
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `pattern-${pattern.name.toLowerCase().replace(/\s+/g, '-')}`,
      content: promptContent,
      layer: PromptLayer.Procedural,
      domain: pattern.applicableDomains[0] || Domain.General,
      tags: ['generated', 'pattern', 'cognitive', pattern.name.toLowerCase().replace(/\s+/g, '-')],
      abstractionLevel: pattern.abstractionLevel,
      generationReason: `Synthesized from ${pattern.occurrences.length} similar episodes with ${pattern.confidence.toFixed(2)} confidence`,
      expectedEffectiveness: pattern.confidence * 0.8, // Slightly conservative estimate
      createdAt: new Date()
    };

    return prompt;
  }

  private async generateImprovedPrompt(promptData: { promptId: string; analytics: UsageAnalytics }): Promise<GeneratedPrompt | null> {
    // Get the original prompt
    const originalPrompt = await this.mcpClient.getPrompt(promptData.promptId);
    if (!originalPrompt) return null;

    // Analyze failure modes from usage data
    const improvementSuggestions = promptData.analytics.improvementSuggestions;
    if (improvementSuggestions.length === 0) return null;

    // Generate improved version
    const improvedContent = this.improvePromptContent(originalPrompt.content, improvementSuggestions);

    const prompt: GeneratedPrompt = {
      id: `gen_improved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${originalPrompt.name}-improved`,
      content: improvedContent,
      layer: originalPrompt.layer,
      domain: originalPrompt.domain,
      tags: [...originalPrompt.tags, 'improved', 'generated'],
      abstractionLevel: originalPrompt.abstractionLevel,
      generationReason: `Improved version of ${originalPrompt.name} based on usage analytics (${improvementSuggestions.length} improvements applied)`,
      expectedEffectiveness: Math.min(1.0, (promptData.analytics.averageEffectiveness || 0) + 0.2),
      createdAt: new Date()
    };

    return prompt;
  }

  private async generateUsagePatternPrompt(pattern: any): Promise<GeneratedPrompt | null> {
    // Generate prompts for identified usage patterns
    if (pattern.type === 'domain_coverage_gap') {
      const promptContent = this.buildDomainCoveragePrompt(pattern.domain, pattern.usageCount);

      const prompt: GeneratedPrompt = {
        id: `gen_domain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${pattern.domain.toLowerCase()}-guidance`,
        content: promptContent,
        layer: PromptLayer.Procedural,
        domain: this.mapStringToDomain(pattern.domain),
        tags: ['generated', 'domain-coverage', pattern.domain.toLowerCase()],
        abstractionLevel: 3,
        generationReason: `Generated to address coverage gap in ${pattern.domain} domain (${pattern.usageCount} usages without adequate guidance)`,
        expectedEffectiveness: 0.6,
        createdAt: new Date()
      };

      return prompt;
    }

    return null;
  }

  private async generateDomainGapPrompt(gap: any): Promise<GeneratedPrompt | null> {
    // Generate prompts for domain gaps
    // Placeholder implementation
    return null;
  }

  private async generateNovelPatternPrompt(data: any): Promise<GeneratedPrompt | null> {
    // Generate prompt for novel pattern
    // Placeholder implementation
    return null;
  }

  private async generateIneffectivePromptImprovement(data: any): Promise<GeneratedPrompt | null> {
    // Generate improvement for ineffective prompt
    // Placeholder implementation
    return null;
  }

  private async generateUsageBasedPrompt(data: any): Promise<GeneratedPrompt | null> {
    // Generate prompt based on usage patterns
    // Placeholder implementation
    return null;
  }

  private async generateUserRequestedPrompt(data: any): Promise<GeneratedPrompt | null> {
    // Generate prompt based on user request
    // Placeholder implementation
    return null;
  }

  private buildPatternPromptContent(pattern: EpisodePattern): string {
    const sections = [
      `# ${pattern.name}`,
      '',
      `## Pattern Overview`,
      pattern.description,
      '',
      `**Confidence**: ${(pattern.confidence * 100).toFixed(1)}%`,
      `**Based on**: ${pattern.occurrences.length} episodes`,
      `**Abstraction Level**: ${pattern.abstractionLevel}/10`,
      '',
      `## Common Symptoms`,
      ...pattern.commonSymptoms.map(symptom => `- ${symptom}`),
      '',
      `## Recommended Approaches`
    ];

    for (const solution of pattern.commonSolutions.slice(0, 3)) {
      sections.push(
        `### ${solution.description}`,
        `**Success Rate**: ${(solution.successRate * 100).toFixed(1)}%`,
        `**Estimated Time**: ${Math.round(solution.averageTime / 1000)} seconds`,
        '',
        'Steps to follow:',
        ...solution.steps.map((step, i) => `${i + 1}. ${step}`),
        ''
      );
    }

    sections.push(
      `## Context Information`,
      `- **Applicable Domains**: ${pattern.applicableDomains.map(d => Domain[d]).join(', ')}`,
      `- **Complexity Level**: ${pattern.occurrences[0]?.context.complexity || 'mixed'}`,
      `- **Common Tools**: ${this.extractCommonTools(pattern.occurrences).join(', ')}`,
      '',
      `## When to Apply`,
      `Use this pattern when you encounter:`,
      ...pattern.commonSymptoms.map(symptom => `- ${symptom}`),
      '',
      `This pattern was automatically synthesized from successful problem-solving experiences.`
    );

    return sections.join('\n');
  }

  private improvePromptContent(originalContent: string, suggestions: string[]): string {
    let improvedContent = originalContent;

    // Add improvement notes at the beginning
    const improvementHeader = [
      '## Recent Improvements',
      '',
      ...suggestions.map(suggestion => `- ${suggestion}`),
      '',
      '---',
      ''
    ].join('\n');

    improvedContent = improvementHeader + improvedContent;

    // Add specific improvements based on suggestions
    for (const suggestion of suggestions) {
      if (suggestion.includes('error handling')) {
        improvedContent += '\n\n## Error Handling\nAlways check for common error conditions before proceeding.';
      } else if (suggestion.includes('step breakdown')) {
        improvedContent += '\n\n## Detailed Steps\nBreak complex tasks into smaller, verifiable steps.';
      }
      // Add more improvement logic as needed
    }

    return improvedContent;
  }

  private buildDomainCoveragePrompt(domain: string, usageCount: number): string {
    return [
      `# ${domain} Development Guidance`,
      '',
      `## Overview`,
      `This guide provides comprehensive support for ${domain} development tasks.`,
      '',
      `**Usage Statistics**: This domain has seen ${usageCount} interactions without dedicated guidance.`,
      '',
      `## Common Tasks in ${domain}`,
      '',
      `### Getting Started`,
      `1. Assess the specific requirements of your ${domain} project`,
      `2. Identify the tools and frameworks you'll need`,
      `3. Set up your development environment`,
      `4. Create a basic project structure`,
      '',
      `### Development Workflow`,
      `1. Break down your project into manageable components`,
      `2. Implement core functionality incrementally`,
      `3. Test each component thoroughly`,
      `4. Integrate components systematically`,
      '',
      `### Best Practices`,
      `- Follow established patterns for ${domain}`,
      `- Use appropriate testing strategies`,
      `- Document your code and decisions`,
      `- Consider performance and scalability`,
      '',
      `## Available Resources`,
      `- Domain-specific documentation`,
      `- Tool and framework guides`,
      `- Example projects and templates`,
      `- Community resources and forums`,
      '',
      `## Getting Help`,
      `If you need more specific guidance for your ${domain} project, provide details about:`,
      `- Your specific goals and requirements`,
      `- Tools and technologies you're using`,
      `- Challenges you're facing`,
      `- Previous approaches you've tried`,
      '',
      `This guide was automatically generated to address a coverage gap in ${domain} guidance.`
    ].join('\n');
  }

  private extractCommonTools(occurrences: any[]): string[] {
    const toolCounts = new Map<string, number>();

    for (const occurrence of occurrences) {
      if (occurrence.context?.tools) {
        for (const tool of occurrence.context.tools) {
          toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
        }
      }
    }

    const threshold = occurrences.length * 0.3; // Tools used in 30% of cases
    return Array.from(toolCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([tool]) => tool)
      .sort();
  }

  private async validateGeneratedPrompt(prompt: GeneratedPrompt): Promise<boolean> {
    // Basic validation checks
    if (!prompt.name || prompt.name.length < 3) return false;
    if (!prompt.content || prompt.content.length < 50) return false;
    if (prompt.expectedEffectiveness < 0 || prompt.expectedEffectiveness > 1) return false;

    // Check for duplicate names
    const existingPrompts = await this.mcpClient.searchPrompts({
      tags: [prompt.name],
      limit: 1
    });

    if (existingPrompts.length > 0) return false;

    return true;
  }

  private async saveGeneratedPrompt(prompt: GeneratedPrompt): Promise<void> {
    await this.mcpClient.createPrompt({
      name: prompt.name,
      content: prompt.content,
      layer: prompt.layer,
      domain: prompt.domain,
      tags: prompt.tags,
      abstractionLevel: prompt.abstractionLevel
    });

    logger.info(`Saved generated prompt: ${prompt.name}`);
  }

  private mapStringToDomain(domainStr: string): Domain {
    const domainMap: Record<string, Domain> = {
      'software-development': Domain.SoftwareDevelopment,
      'medical': Domain.MedicalAnalysis,
      'financial': Domain.FinancialModeling,
      'creative': Domain.CreativeProduction,
      'infrastructure': Domain.Infrastructure,
      'data-science': Domain.DataScience,
      'security': Domain.Security
    };

    return domainMap[domainStr.toLowerCase()] || Domain.General;
  }

  /**
   * Get generation statistics
   */
  getGenerationStats(): {
    generatedToday: number;
    maxPerDay: number;
    lastGenerationDate: string;
  } {
    return {
      generatedToday: this.generatedToday,
      maxPerDay: this.maxPromptsPerDay,
      lastGenerationDate: this.lastGenerationDate
    };
  }

  /**
   * Reset daily generation counter (for testing)
   */
  resetDailyCounter(): void {
    this.generatedToday = 0;
    this.lastGenerationDate = new Date().toDateString();
  }
}