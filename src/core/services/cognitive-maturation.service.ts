// cognitive-maturation.service.ts
// Main orchestrator for cognitive system self-improvement
// Coordinates usage tracking, pattern synthesis, prompt generation, and cross-domain transfer

import pino from 'pino';
import { Domain } from '../../types.js';
import { UsageTrackingService } from './usage-tracking.service.js';
import { PatternSynthesisService, EpisodeData } from './pattern-synthesis.service.js';
import { AutomaticPromptGenerationService } from './automatic-prompt-generation.service.js';
import { CrossDomainTransferService } from './cross-domain-transfer.service.js';
import { IEventBus } from '../ports/event-bus.interface.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface LearningCycleResult {
  patternsDiscovered: number;
  promptsGenerated: number;
  transfersApplied: number;
  insightsGenerated: string[];
  nextLearningCycle: Date;
}

export interface SystemHealthMetrics {
  totalPrompts: number;
  activePatterns: number;
  transferablePrinciples: number;
  averagePromptEffectiveness: number;
  learningEfficiency: number;
  domainCoverage: Record<string, number>;
}

export class CognitiveMaturationService {
  private usageService: UsageTrackingService;
  private patternService: PatternSynthesisService;
  private promptGenService: AutomaticPromptGenerationService;
  private transferService: CrossDomainTransferService;

  private learningCycleInterval = 24 * 60 * 60 * 1000; // 24 hours
  private lastLearningCycle = new Date(0); // Initialize to epoch

  constructor(eventBus: IEventBus) {
    this.usageService = new UsageTrackingService(eventBus);
    this.patternService = new PatternSynthesisService();
    this.promptGenService = new AutomaticPromptGenerationService();
    this.transferService = new CrossDomainTransferService();

    // Set up periodic learning cycles
    this.scheduleLearningCycles();
  }

  /**
   * Execute a complete learning cycle
   */
  async executeLearningCycle(): Promise<LearningCycleResult> {
    const startTime = Date.now();
    logger.info('Starting cognitive learning cycle');

    const results: LearningCycleResult = {
      patternsDiscovered: 0,
      promptsGenerated: 0,
      transfersApplied: 0,
      insightsGenerated: [],
      nextLearningCycle: new Date(Date.now() + this.learningCycleInterval)
    };

    try {
      // Phase 1: Analyze usage patterns and extract episodes
      const episodes = await this.extractEpisodesFromUsage();
      results.insightsGenerated.push(`Extracted ${episodes.length} episodes from recent usage`);

      if (episodes.length > 0) {
        // Phase 2: Synthesize patterns from episodes
        const newPatterns = await this.patternService.analyzeEpisodes(episodes);
        results.patternsDiscovered = newPatterns.length;

        if (newPatterns.length > 0) {
          results.insightsGenerated.push(`Synthesized ${newPatterns.length} new patterns`);
        }

        // Phase 3: Discover transferable principles
        const principles = await this.transferService.discoverTransferablePrinciples();
        results.insightsGenerated.push(`Discovered ${principles.length} transferable principles`);

        // Phase 4: Generate new prompts automatically
        const generatedPrompts = await this.promptGenService.evaluateAndGeneratePrompts();
        results.promptsGenerated = generatedPrompts.length;

        if (generatedPrompts.length > 0) {
          results.insightsGenerated.push(`Auto-generated ${generatedPrompts.length} new prompts`);
        }

        // Phase 5: Apply cross-domain transfers
        const transfersApplied = await this.applyIntelligentTransfers();
        results.transfersApplied = transfersApplied;

        if (transfersApplied > 0) {
          results.insightsGenerated.push(`Applied ${transfersApplied} cross-domain transfers`);
        }
      }

      // Phase 6: Update system knowledge base
      await this.updateKnowledgeBase(episodes);

      // Phase 7: Generate learning insights
      const insights = await this.generateLearningInsights();
      results.insightsGenerated.push(...insights);

      // Phase 8: Self-assessment and improvement
      await this.performSelfAssessment();

      this.lastLearningCycle = new Date();

      const duration = Date.now() - startTime;
      logger.info(`Learning cycle completed in ${duration}ms`, results);

    } catch (error) {
      logger.error('Learning cycle failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.insightsGenerated.push(`Learning cycle encountered error: ${errorMessage}`);
    }

    return results;
  }

  /**
   * Get current system health and learning metrics
   */
  async getSystemHealth(): Promise<SystemHealthMetrics> {
    // This would query actual metrics from the services
    const metrics: SystemHealthMetrics = {
      totalPrompts: 83, // Would be queried from actual storage
      activePatterns: this.patternService.getPatterns().length,
      transferablePrinciples: this.transferService.getTransferInsights().totalTransfers,
      averagePromptEffectiveness: 0.75, // Would be calculated from usage data
      learningEfficiency: this.calculateLearningEfficiency(),
      domainCoverage: {
        'software-development': 45,
        'embedded': 15,
        'security': 10,
        'data-science': 8,
        'infrastructure': 5
      }
    };

    return metrics;
  }

  /**
   * Manually trigger learning from specific episodes
   */
  async learnFromEpisodes(episodes: EpisodeData[]): Promise<{
    patterns: any[];
    generatedPrompts: any[];
    transfers: string[];
  }> {
    logger.info(`Manually learning from ${episodes.length} provided episodes`);

    // Synthesize patterns
    const patterns = await this.patternService.analyzeEpisodes(episodes);

    // Generate prompts from patterns
    const generatedPrompts = [];
    for (const pattern of patterns) {
      if (pattern.confidence > 0.7) {
        const prompt = await this.promptGenService.generatePromptForContext({
          trigger: 'novel_pattern',
          confidence: pattern.confidence,
          supportingData: pattern,
          domain: pattern.applicableDomains[0] || 1, // Default to software development
          complexity: 'medium'
        });

        if (prompt) {
          generatedPrompts.push(prompt);
        }
      }
    }

    // Apply transfers
    const transfers = [];
    for (const episode of episodes) {
      const opportunities = await this.transferService.findTransferOpportunities({
        symptoms: episode.symptoms,
        domain: episode.context.domain,
        problem: episode.symptoms.join(', '),
        availableTools: episode.context.tools
      });

      for (const opportunity of opportunities.slice(0, 2)) { // Limit to top 2 per episode
        const transferResult = await this.transferService.applyTransferOpportunity(opportunity);
        if (transferResult) {
          transfers.push(transferResult);
        }
      }
    }

    return {
      patterns,
      generatedPrompts,
      transfers
    };
  }

  /**
   * Get learning recommendations for system improvement
   */
  async getLearningRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    const health = await this.getSystemHealth();
    const patternCount = this.patternService.getPatterns().length;

    if (patternCount < 10) {
      recommendations.push('Increase pattern synthesis by providing more diverse usage episodes');
    }

    if (health.averagePromptEffectiveness < 0.7) {
      recommendations.push('Focus on improving prompt effectiveness through better context understanding');
    }

    const transferInsights = this.transferService.getTransferInsights();
    if (transferInsights.totalTransfers < 5) {
      recommendations.push('Expand cross-domain transfer capabilities with more domain mappings');
    }

    if (recommendations.length === 0) {
      recommendations.push('System learning is performing well - continue monitoring and refinement');
    }

    return recommendations;
  }

  private async extractEpisodesFromUsage(): Promise<EpisodeData[]> {
    // Extract episodes from recent usage data
    // This would analyze usage tracking data to create episode representations
    const episodes: EpisodeData[] = [];

    // Get recent usage data (simplified - would query actual usage service)
    // For now, return mock episodes based on known patterns

    // This would be replaced with actual usage data analysis
    return episodes;
  }

  private async applyIntelligentTransfers(): Promise<number> {
    let transfersApplied = 0;

    // Find patterns that could benefit from cross-domain transfer
    const patterns = this.patternService.getPatterns();

    for (const pattern of patterns) {
      if (pattern.confidence > 0.8 && pattern.abstractionLevel > 6) {
        // Look for transfer opportunities
        const opportunities = await this.transferService.findTransferOpportunities({
          symptoms: pattern.commonSymptoms,
          domain: Domain[pattern.applicableDomains[0]],
          problem: pattern.commonSymptoms.join(', '),
          availableTools: ['cognitive-transfer'] // Placeholder
        });

        // Apply top opportunity if confidence is high enough
        if (opportunities.length > 0 && opportunities[0].expectedEffectiveness > 0.7) {
          const result = await this.transferService.applyTransferOpportunity(opportunities[0]);
          if (result) {
            transfersApplied++;
          }
        }
      }
    }

    return transfersApplied;
  }

  private async updateKnowledgeBase(episodes: EpisodeData[]): Promise<void> {
    // Update pattern confidence based on new episodes
    for (const episode of episodes) {
      // Find related patterns and update them
      const relatedPatterns = this.patternService.getPatterns().filter(pattern =>
        pattern.commonSymptoms.some(symptom =>
          episode.symptoms.some(episodeSymptom =>
            this.calculateSimilarity(symptom, episodeSymptom) > 0.7
          )
        )
      );

      for (const pattern of relatedPatterns) {
        // Update pattern with new episode data
        this.patternService['updateExistingPattern'](pattern, [episode]);
      }
    }

    // Clean up old patterns
    this.patternService.cleanupPatterns();
  }

  private async generateLearningInsights(): Promise<string[]> {
    const insights: string[] = [];

    const patternCount = this.patternService.getPatterns().length;
    const transferInsights = this.transferService.getTransferInsights();

    if (patternCount > 0) {
      insights.push(`System now recognizes ${patternCount} distinct problem-solving patterns`);
    }

    if (transferInsights.totalTransfers > 0) {
      insights.push(`Successfully transferred knowledge across ${transferInsights.totalTransfers} domain boundaries`);
    }

    // Analyze learning trends
    const usagePatterns = this.usageService.getUsagePatterns();
    if (usagePatterns.successTrend.length > 1) {
      const recentSuccess = usagePatterns.successTrend.slice(-7); // Last week
      const avgRecentSuccess = recentSuccess.reduce((sum, day) => sum + day.successRate, 0) / recentSuccess.length;

      const earlierSuccess = usagePatterns.successTrend.slice(-14, -7); // Previous week
      const avgEarlierSuccess = earlierSuccess.length > 0
        ? earlierSuccess.reduce((sum, day) => sum + day.successRate, 0) / earlierSuccess.length
        : avgRecentSuccess;

      if (avgRecentSuccess > avgEarlierSuccess + 0.05) {
        insights.push('Learning effectiveness improving - system success rate increasing');
      } else if (avgRecentSuccess < avgEarlierSuccess - 0.05) {
        insights.push('Learning effectiveness declining - investigate prompt quality or context matching');
      }
    }

    return insights;
  }

  private async performSelfAssessment(): Promise<void> {
    // Analyze system performance and identify improvement areas
    const health = await this.getSystemHealth();

    if (health.averagePromptEffectiveness < 0.6) {
      logger.warn('Prompt effectiveness below threshold - consider prompt quality improvements');
    }

    if (health.activePatterns < 5) {
      logger.info('Low pattern count - system needs more usage data for learning');
    }

    // Adjust learning parameters based on performance
    if (health.learningEfficiency > 0.8) {
      // Learning is efficient, can increase learning rate
      this.learningCycleInterval = Math.max(12 * 60 * 60 * 1000, this.learningCycleInterval * 0.9);
    } else if (health.learningEfficiency < 0.4) {
      // Learning is inefficient, slow down to allow better analysis
      this.learningCycleInterval = Math.min(48 * 60 * 60 * 1000, this.learningCycleInterval * 1.2);
    }
  }

  private calculateLearningEfficiency(): number {
    // Calculate how efficiently the system is learning
    // Based on pattern discovery rate, prompt generation success, etc.
    const patternCount = this.patternService.getPatterns().length;
    const transferCount = this.transferService.getTransferInsights().totalTransfers;

    // Simple efficiency metric
    const baseEfficiency = 0.5;
    const patternBonus = Math.min(0.3, patternCount / 50); // Up to 0.3 bonus for patterns
    const transferBonus = Math.min(0.2, transferCount / 20); // Up to 0.2 bonus for transfers

    return Math.min(1.0, baseEfficiency + patternBonus + transferBonus);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private scheduleLearningCycles(): void {
    // Schedule periodic learning cycles
    setInterval(async () => {
      try {
        await this.executeLearningCycle();
      } catch (error) {
        logger.error('Scheduled learning cycle failed:', error);
      }
    }, this.learningCycleInterval);

    logger.info(`Scheduled learning cycles every ${this.learningCycleInterval / (60 * 60 * 1000)} hours`);
  }

  /**
   * Get learning cycle statistics
   */
  getLearningStats(): {
    lastCycle: Date;
    nextCycle: Date;
    cycleInterval: number;
    patternsLearned: number;
    transfersApplied: number;
  } {
    return {
      lastCycle: this.lastLearningCycle,
      nextCycle: new Date(this.lastLearningCycle.getTime() + this.learningCycleInterval),
      cycleInterval: this.learningCycleInterval,
      patternsLearned: this.patternService.getPatterns().length,
      transfersApplied: this.transferService.getTransferInsights().totalTransfers
    };
  }
}

// Re-export for convenience
export { UsageTrackingService } from './usage-tracking.service.js';
export { PatternSynthesisService } from './pattern-synthesis.service.js';
export { AutomaticPromptGenerationService } from './automatic-prompt-generation.service.js';
export { CrossDomainTransferService } from './cross-domain-transfer.service.js';