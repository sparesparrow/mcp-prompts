import pino from 'pino';
// import disabled for build
// import disabled for build
import { Domain, PromptLayer, SimpleMcpPromptsClient } from '../../types.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface EpisodePattern {
  patternId: string;
  name: string;
  description: string;
  confidence: number; // 0-1, how strong this pattern is
  occurrences: EpisodeData[];
  commonSymptoms: string[];
  commonSolutions: SolutionPattern[];
  applicableDomains: Domain[];
  abstractionLevel: number; // 1-10, how abstract/general this pattern is
  learnedAt: Date;
  lastUsed?: Date;
}

export interface SolutionPattern {
  description: string;
  steps: string[];
  successRate: number;
  averageTime: number;
  prerequisites: string[];
}

export interface EpisodeData {
  id: string;
  symptoms: string[];
  context: {
    domain: string;
    tools: string[];
    complexity: string;
  };
  investigationSteps: Array<{
    action: string;
    tool: string;
    success: boolean;
    duration: number;
  }>;
  solution: {
    description: string;
    steps: string[];
    success: boolean;
  };
  cognitiveLoad: number;
  tags: string[];
}

export class PatternSynthesisService {
  private patterns: Map<string, EpisodePattern> = new Map();
  private mcpClient: SimpleMcpPromptsClient;
  private minPatternConfidence = 0.6; // Minimum confidence to create a pattern
  private minOccurrences = 3; // Minimum episodes to form a pattern

  constructor(mcpClient?: SimpleMcpPromptsClient) {
    this.mcpClient = mcpClient || new SimpleMcpPromptsClient();
  }

  /**
   * Analyze episodes and synthesize new patterns
   */
  async analyzeEpisodes(episodes: EpisodeData[]): Promise<EpisodePattern[]> {
    logger.info(`Analyzing ${episodes.length} episodes for pattern synthesis`);

    const newPatterns: EpisodePattern[] = [];

    // Group episodes by similar symptoms and contexts
    const episodeGroups = this.groupSimilarEpisodes(episodes);

    for (const [groupKey, groupEpisodes] of episodeGroups) {
      if (groupEpisodes.length < this.minOccurrences) {
        continue; // Not enough episodes for a reliable pattern
      }

      // Check if we already have a similar pattern
      const existingPattern = this.findSimilarPattern(groupEpisodes[0]);
      if (existingPattern) {
        // Update existing pattern with new episodes
        this.updateExistingPattern(existingPattern, groupEpisodes);
        continue;
      }

      // Create new pattern
      const pattern = this.synthesizePattern(groupKey, groupEpisodes);
      if (pattern.confidence >= this.minPatternConfidence) {
        this.patterns.set(pattern.patternId, pattern);
        newPatterns.push(pattern);

        logger.info(`Synthesized new pattern: ${pattern.name} (confidence: ${pattern.confidence.toFixed(2)})`);
      }
    }

    // Create prompts for high-confidence patterns
    for (const pattern of newPatterns) {
      if (pattern.confidence >= 0.8) {
        await this.createPatternPrompt(pattern);
      }
    }

    return newPatterns;
  }

  /**
   * Get all discovered patterns
   */
  getPatterns(): EpisodePattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Find patterns applicable to a given context
   */
  findApplicablePatterns(context: {
    symptoms: string[];
    domain: string;
    tools: string[];
    complexity: string;
  }): EpisodePattern[] {
    const applicablePatterns = Array.from(this.patterns.values())
      .filter(pattern => {
        // Check if symptoms match
        const symptomOverlap = this.calculateOverlap(
          context.symptoms,
          pattern.commonSymptoms
        );

        // Check if domain is applicable
        const domainMatch = pattern.applicableDomains.some(d =>
          d === this.mapStringToDomain(context.domain)
        );

        // Check if tools are relevant
        const toolRelevance = pattern.occurrences.some(episode =>
          episode.context.tools.some(tool => context.tools.includes(tool))
        );

        // Calculate overall relevance score
        const relevanceScore = (
          symptomOverlap * 0.4 +
          (domainMatch ? 0.3 : 0) +
          (toolRelevance ? 0.3 : 0)
        );

        return relevanceScore >= 0.5 && pattern.confidence >= this.minPatternConfidence;
      })
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence

    return applicablePatterns;
  }

  /**
   * Update pattern usage statistics
   */
  updatePatternUsage(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.lastUsed = new Date();
      // Could also track usage frequency for pattern ranking
    }
  }

  /**
   * Clean up old or low-confidence patterns
   */
  cleanupPatterns(maxAgeDays: number = 90, minConfidence: number = 0.5): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const toDelete: string[] = [];

    for (const [id, pattern] of this.patterns) {
      const isOld = !pattern.lastUsed || pattern.lastUsed < cutoffDate;
      const isLowConfidence = pattern.confidence < minConfidence;
      const hasFewOccurrences = pattern.occurrences.length < this.minOccurrences;

      if (isOld && (isLowConfidence || hasFewOccurrences)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.patterns.delete(id);
    }

    if (toDelete.length > 0) {
      logger.info(`Cleaned up ${toDelete.length} outdated patterns`);
    }
  }

  private groupSimilarEpisodes(episodes: EpisodeData[]): Map<string, EpisodeData[]> {
    const groups = new Map<string, EpisodeData[]>();

    for (const episode of episodes) {
      // Create a grouping key based on symptoms and context
      const symptomKey = episode.symptoms.slice(0, 3).sort().join('|');
      const contextKey = `${episode.context.domain}|${episode.context.complexity}`;
      const groupKey = `${symptomKey}::${contextKey}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(episode);
    }

    return groups;
  }

  private findSimilarPattern(episode: EpisodeData): EpisodePattern | null {
    for (const pattern of this.patterns.values()) {
      // Check if symptoms overlap significantly
      const symptomOverlap = this.calculateOverlap(
        episode.symptoms,
        pattern.commonSymptoms
      );

      // Check if context matches
      const contextMatch = pattern.occurrences.some(existingEpisode =>
        existingEpisode.context.domain === episode.context.domain &&
        existingEpisode.context.complexity === episode.context.complexity
      );

      if (symptomOverlap >= 0.7 && contextMatch) {
        return pattern;
      }
    }

    return null;
  }

  private updateExistingPattern(pattern: EpisodePattern, newEpisodes: EpisodeData[]): void {
    // Add new episodes
    pattern.occurrences.push(...newEpisodes);

    // Recalculate common symptoms
    pattern.commonSymptoms = this.extractCommonSymptoms(pattern.occurrences);

    // Recalculate solution patterns
    pattern.commonSolutions = this.extractSolutionPatterns(pattern.occurrences);

    // Update confidence based on more data
    pattern.confidence = Math.min(1.0, pattern.confidence + (newEpisodes.length * 0.1));

    // Update abstraction level based on variety
    const uniqueDomains = new Set(pattern.occurrences.map(e => e.context.domain));
    pattern.abstractionLevel = Math.min(10, Math.max(1, uniqueDomains.size));

    logger.debug(`Updated existing pattern: ${pattern.name} (${pattern.occurrences.length} episodes)`);
  }

  private synthesizePattern(groupKey: string, episodes: EpisodeData[]): EpisodePattern {
    const commonSymptoms = this.extractCommonSymptoms(episodes);
    const commonSolutions = this.extractSolutionPatterns(episodes);
    const applicableDomains = this.inferApplicableDomains(episodes);
    const abstractionLevel = this.calculateAbstractionLevel(episodes);

    // Calculate confidence based on consistency and sample size
    const solutionConsistency = this.calculateSolutionConsistency(commonSolutions);
    const sampleSize = episodes.length;
    const confidence = Math.min(1.0,
      (solutionConsistency * 0.6) +
      (Math.min(sampleSize / 10, 1.0) * 0.4) // More samples = higher confidence
    );

    const patternName = this.generatePatternName(commonSymptoms, episodes[0].context.domain);

    const pattern: EpisodePattern = {
      patternId: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: patternName,
      description: this.generatePatternDescription(commonSymptoms, commonSolutions, episodes[0].context),
      confidence,
      occurrences: episodes,
      commonSymptoms,
      commonSolutions,
      applicableDomains,
      abstractionLevel,
      learnedAt: new Date()
    };

    return pattern;
  }

  private extractCommonSymptoms(episodes: EpisodeData[]): string[] {
    const symptomCounts = new Map<string, number>();

    for (const episode of episodes) {
      for (const symptom of episode.symptoms) {
        symptomCounts.set(symptom, (symptomCounts.get(symptom) || 0) + 1);
      }
    }

    // Return symptoms that appear in at least 60% of episodes
    const threshold = episodes.length * 0.6;
    return Array.from(symptomCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([symptom]) => symptom)
      .sort();
  }

  private extractSolutionPatterns(episodes: EpisodeData[]): SolutionPattern[] {
    const solutionGroups = new Map<string, EpisodeData[]>();

    // Group episodes by similar solutions
    for (const episode of episodes) {
      if (episode.solution.success) {
        const solutionKey = episode.solution.description;
        if (!solutionGroups.has(solutionKey)) {
          solutionGroups.set(solutionKey, []);
        }
        solutionGroups.get(solutionKey)!.push(episode);
      }
    }

    const patterns: SolutionPattern[] = [];

    for (const [description, episodesWithSolution] of solutionGroups) {
      const successRate = episodesWithSolution.length / episodes.length;
      const averageTime = episodesWithSolution
        .filter(e => e.investigationSteps.length > 0)
        .reduce((sum, e) => {
          const totalTime = e.investigationSteps.reduce((s, step) => s + step.duration, 0);
          return sum + totalTime;
        }, 0) / episodesWithSolution.length;

      const steps = this.extractCommonSteps(episodesWithSolution);

      patterns.push({
        description,
        steps,
        successRate,
        averageTime,
        prerequisites: [] // Could be inferred from context
      });
    }

    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  private extractCommonSteps(episodes: EpisodeData[]): string[] {
    const stepCounts = new Map<string, number>();

    for (const episode of episodes) {
      for (const step of episode.solution.steps) {
        stepCounts.set(step, (stepCounts.get(step) || 0) + 1);
      }
    }

    // Return steps that appear in successful solutions
    const threshold = episodes.length * 0.5;
    return Array.from(stepCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([step]) => step);
  }

  private inferApplicableDomains(episodes: EpisodeData[]): Domain[] {
    const domainCounts = new Map<string, number>();

    for (const episode of episodes) {
      domainCounts.set(episode.context.domain, (domainCounts.get(episode.context.domain) || 0) + 1);
    }

    // Return domains that appear in episodes
    return Array.from(domainCounts.keys())
      .map(domain => this.mapStringToDomain(domain))
      .filter(domain => domain !== Domain.General);
  }

  private calculateAbstractionLevel(episodes: EpisodeData[]): number {
    const uniqueDomains = new Set(episodes.map(e => e.context.domain));
    const uniqueComplexities = new Set(episodes.map(e => e.context.complexity));
    const uniqueTools = new Set(episodes.flatMap(e => e.context.tools));

    // Higher abstraction with more variety
    const domainVariety = Math.min(uniqueDomains.size / 3, 1);
    const complexityVariety = Math.min(uniqueComplexities.size / 3, 1);
    const toolVariety = Math.min(uniqueTools.size / 5, 1);

    return Math.round((domainVariety + complexityVariety + toolVariety) * 10 / 3);
  }

  private calculateSolutionConsistency(solutions: SolutionPattern[]): number {
    if (solutions.length === 0) return 0;

    // Calculate how consistent solutions are
    const totalSuccessRate = solutions.reduce((sum, s) => sum + s.successRate, 0) / solutions.length;

    // Higher consistency if top solution has much higher success rate
    const topSolutionRate = solutions[0]?.successRate || 0;
    const consistencyBonus = topSolutionRate > 0.7 ? 0.2 : 0;

    return Math.min(1.0, totalSuccessRate + consistencyBonus);
  }

  private generatePatternName(symptoms: string[], domain: string): string {
    const primarySymptom = symptoms[0] || 'unknown';
    const domainName = domain.charAt(0).toUpperCase() + domain.slice(1);

    // Create a concise, descriptive name
    const symptomWords = primarySymptom.split(' ').slice(0, 2).join(' ');
    return `${domainName}: ${symptomWords} Pattern`;
  }

  private generatePatternDescription(
    symptoms: string[],
    solutions: SolutionPattern[],
    context: { domain: string; tools: string[]; complexity: string }
  ): string {
    const symptomStr = symptoms.slice(0, 2).join(', ');
    const bestSolution = solutions[0];

    let description = `Pattern for handling ${symptomStr} in ${context.domain} contexts`;

    if (bestSolution) {
      description += `. Most effective solution: ${bestSolution.description} (success rate: ${(bestSolution.successRate * 100).toFixed(0)}%)`;
    }

    if (context.complexity) {
      description += `. Typically occurs in ${context.complexity} complexity scenarios.`;
    }

    return description;
  }

  private async createPatternPrompt(pattern: EpisodePattern): Promise<void> {
    const promptContent = this.generatePatternPromptContent(pattern);

    try {
      await this.mcpClient.createPrompt({
        name: `pattern-${pattern.patternId}`,
        content: promptContent,
        layer: PromptLayer.Procedural, // Patterns are procedural knowledge
        domain: pattern.applicableDomains[0] || Domain.General,
        tags: ['pattern', 'synthesized', 'cognitive', pattern.name.toLowerCase().replace(/\s+/g, '-')],
        abstractionLevel: pattern.abstractionLevel
      });

      logger.info(`Created prompt for pattern: ${pattern.name}`);
    } catch (error) {
      logger.error(`Failed to create prompt for pattern ${pattern.name}:`, error);
    }
  }

  private generatePatternPromptContent(pattern: EpisodePattern): string {
    const sections = [
      `# ${pattern.name}`,
      '',
      `**Confidence**: ${(pattern.confidence * 100).toFixed(1)}%`,
      `**Abstraction Level**: ${pattern.abstractionLevel}/10`,
      `**Occurrences**: ${pattern.occurrences.length}`,
      `**Applicable Domains**: ${pattern.applicableDomains.map(d => Domain[d]).join(', ')}`,
      '',
      `## Description`,
      pattern.description,
      '',
      `## Common Symptoms`,
      ...pattern.commonSymptoms.map(s => `- ${s}`),
      '',
      `## Recommended Solutions`
    ];

    for (const solution of pattern.commonSolutions.slice(0, 3)) { // Top 3 solutions
      sections.push(
        `### ${solution.description}`,
        `**Success Rate**: ${(solution.successRate * 100).toFixed(1)}%`,
        `**Average Time**: ${Math.round(solution.averageTime / 1000)}s`,
        '',
        'Steps:',
        ...solution.steps.map(step => `1. ${step}`)
      );
    }

    sections.push(
      '',
      `## Context Information`,
      `- **Complexity**: ${pattern.occurrences[0]?.context.complexity || 'unknown'}`,
      `- **Common Tools**: ${this.getCommonTools(pattern.occurrences).join(', ')}`,
      '',
      `## Pattern Synthesis`,
      `This pattern was automatically synthesized from ${pattern.occurrences.length} similar episodes on ${pattern.learnedAt.toISOString()}.`
    );

    return sections.join('\n');
  }

  private getCommonTools(episodes: EpisodeData[]): string[] {
    const toolCounts = new Map<string, number>();

    for (const episode of episodes) {
      for (const tool of episode.context.tools) {
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      }
    }

    const threshold = episodes.length * 0.3; // Tools used in 30% of episodes
    return Array.from(toolCounts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([tool]) => tool)
      .sort();
  }

  private calculateOverlap(array1: string[], array2: string[]): number {
    if (array1.length === 0 || array2.length === 0) return 0;

    const set2 = new Set(array2);
    const matches = array1.filter(item => set2.has(item)).length;

    return matches / Math.max(array1.length, array2.length);
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
}