import pino from 'pino';
import { IEventBus } from '../ports/event-bus.interface';
import { PromptUsageEvent } from '../events/prompt-usage.event';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface UsageRecord {
  id: string;
  promptId: string;
  promptVersion: string;
  userId?: string;
  sessionId?: string;
  context: UsageContext;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  outcome: UsageOutcome;
  effectiveness?: number;
  feedback?: UserFeedback;
  metadata: Record<string, any>;
}

export interface UsageContext {
  domain: string;
  task: string;
  complexity: 'low' | 'medium' | 'high';
  timePressure: boolean;
  previousAttempts: number;
  toolsUsed: string[];
  environment: Record<string, any>;
}

export interface UsageOutcome {
  success: boolean;
  result: 'completed' | 'abandoned' | 'error' | 'timeout';
  quality: 'excellent' | 'good' | 'adequate' | 'poor';
  insights: string[];
  lessonsLearned: string[];
  errorDetails?: string;
}

export interface UserFeedback {
  rating: number; // 1-5 scale
  comments?: string;
  wouldUseAgain: boolean;
  suggestions?: string[];
  timestamp: Date;
}

export interface UsageAnalytics {
  promptId: string;
  totalUses: number;
  successRate: number;
  averageDuration: number;
  averageEffectiveness: number;
  commonContexts: UsageContext[];
  improvementSuggestions: string[];
  lastUsed: Date;
}

export class UsageTrackingService {
  private usageRecords: Map<string, UsageRecord> = new Map();
  private analyticsCache: Map<string, UsageAnalytics> = new Map();
  private maxRecords = 10000; // Limit memory usage

  constructor(private eventBus: IEventBus) {}

  /**
   * Start tracking usage of a prompt
   */
  async startUsage(
    promptId: string,
    promptVersion: string,
    userId?: string,
    sessionId?: string,
    context?: Partial<UsageContext>
  ): Promise<string> {
    const usageId = this.generateUsageId();

    const usageRecord: UsageRecord = {
      id: usageId,
      promptId,
      promptVersion,
      userId,
      sessionId,
      context: {
        domain: context?.domain || 'unknown',
        task: context?.task || 'unknown',
        complexity: context?.complexity || 'medium',
        timePressure: context?.timePressure || false,
        previousAttempts: context?.previousAttempts || 0,
        toolsUsed: context?.toolsUsed || [],
        environment: context?.environment || {}
      },
      startTime: new Date(),
      outcome: {
        success: false,
        result: 'abandoned',
        quality: 'adequate',
        insights: [],
        lessonsLearned: []
      },
      metadata: {}
    };

    this.usageRecords.set(usageId, usageRecord);

    // Publish usage started event
    await this.eventBus.publish(new PromptUsageEvent('usage_started', usageId, new Date(), {
      promptId,
      userId,
      context: usageRecord.context
    }));

    logger.debug(`Started usage tracking for prompt ${promptId}: ${usageId}`);

    return usageId;
  }

  /**
   * End tracking usage with outcome
   */
  async endUsage(
    usageId: string,
    outcome: Partial<UsageOutcome>,
    effectiveness?: number,
    feedback?: UserFeedback
  ): Promise<void> {
    const record = this.usageRecords.get(usageId);
    if (!record) {
      logger.warn(`Usage record not found: ${usageId}`);
      return;
    }

    record.endTime = new Date();
    record.duration = record.endTime.getTime() - record.startTime.getTime();
    record.outcome = {
      success: outcome.success ?? false,
      result: outcome.result ?? 'completed',
      quality: outcome.quality ?? 'adequate',
      insights: outcome.insights ?? [],
      lessonsLearned: outcome.lessonsLearned ?? [],
      errorDetails: outcome.errorDetails
    };

    if (effectiveness !== undefined) {
      record.effectiveness = Math.max(0, Math.min(1, effectiveness)); // Clamp to 0-1
    }

    if (feedback) {
      record.feedback = feedback;
    }

    // Publish usage completed event
    await this.eventBus.publish(new PromptUsageEvent('usage_completed', usageId, new Date(), {
      promptId: record.promptId,
      success: record.outcome.success,
      duration: record.duration,
      effectiveness: record.effectiveness
    }));

    // Update analytics cache
    this.invalidateAnalyticsCache(record.promptId);

    logger.debug(`Ended usage tracking for prompt ${record.promptId}: ${usageId}`, {
      success: record.outcome.success,
      duration: record.duration,
      effectiveness: record.effectiveness
    });
  }

  /**
   * Record user feedback for a usage session
   */
  async recordFeedback(usageId: string, feedback: UserFeedback): Promise<void> {
    const record = this.usageRecords.get(usageId);
    if (!record) {
      logger.warn(`Usage record not found for feedback: ${usageId}`);
      return;
    }

    record.feedback = feedback;

    // Recalculate effectiveness based on feedback
    if (record.effectiveness === undefined) {
      record.effectiveness = this.calculateEffectivenessFromFeedback(feedback);
    }

    logger.debug(`Recorded feedback for usage ${usageId}: rating ${feedback.rating}`);
  }

  /**
   * Get usage analytics for a prompt
   */
  async getUsageAnalytics(promptId: string): Promise<UsageAnalytics | null> {
    // Check cache first
    if (this.analyticsCache.has(promptId)) {
      return this.analyticsCache.get(promptId)!;
    }

    // Find all usage records for this prompt
    const promptUsages = Array.from(this.usageRecords.values())
      .filter(record => record.promptId === promptId);

    if (promptUsages.length === 0) {
      return null;
    }

    // Calculate analytics
    const totalUses = promptUsages.length;
    const successfulUses = promptUsages.filter(r => r.outcome.success).length;
    const successRate = successfulUses / totalUses;

    const completedUsages = promptUsages.filter(r => r.duration !== undefined);
    const averageDuration = completedUsages.length > 0
      ? completedUsages.reduce((sum, r) => sum + r.duration!, 0) / completedUsages.length
      : 0;

    const ratedUsages = promptUsages.filter(r => r.effectiveness !== undefined);
    const averageEffectiveness = ratedUsages.length > 0
      ? ratedUsages.reduce((sum, r) => sum + r.effectiveness!, 0) / ratedUsages.length
      : 0;

    // Find common contexts
    const contextCounts = new Map<string, { context: UsageContext; count: number }>();
    for (const usage of promptUsages) {
      const key = `${usage.context.domain}-${usage.context.task}-${usage.context.complexity}`;
      if (!contextCounts.has(key)) {
        contextCounts.set(key, { context: usage.context, count: 0 });
      }
      contextCounts.get(key)!.count++;
    }

    const commonContexts = Array.from(contextCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => item.context);

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(promptUsages);

    const analytics: UsageAnalytics = {
      promptId,
      totalUses,
      successRate,
      averageDuration,
      averageEffectiveness,
      commonContexts,
      improvementSuggestions,
      lastUsed: promptUsages
        .filter(r => r.endTime)
        .sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())[0]?.endTime || new Date()
    };

    // Cache the analytics
    this.analyticsCache.set(promptId, analytics);

    return analytics;
  }

  /**
   * Get usage patterns and trends
   */
  getUsagePatterns(timeRange?: { start: Date; end: Date }): {
    totalUsages: number;
    successTrend: Array<{ date: string; successRate: number }>;
    popularPrompts: Array<{ promptId: string; uses: number }>;
    domainDistribution: Record<string, number>;
  } {
    let records = Array.from(this.usageRecords.values());

    // Apply time filter
    if (timeRange) {
      records = records.filter(r =>
        r.startTime >= timeRange.start && r.startTime <= timeRange.end
      );
    }

    const totalUsages = records.length;

    // Calculate success trend (daily)
    const dailyStats = new Map<string, { total: number; successful: number }>();
    for (const record of records) {
      const date = record.startTime.toISOString().split('T')[0];
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { total: 0, successful: 0 });
      }
      const stats = dailyStats.get(date)!;
      stats.total++;
      if (record.outcome.success) {
        stats.successful++;
      }
    }

    const successTrend = Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        successRate: stats.total > 0 ? stats.successful / stats.total : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Find popular prompts
    const promptCounts = new Map<string, number>();
    for (const record of records) {
      promptCounts.set(record.promptId, (promptCounts.get(record.promptId) || 0) + 1);
    }

    const popularPrompts = Array.from(promptCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([promptId, uses]) => ({ promptId, uses }));

    // Domain distribution
    const domainDistribution: Record<string, number> = {};
    for (const record of records) {
      domainDistribution[record.context.domain] =
        (domainDistribution[record.context.domain] || 0) + 1;
    }

    return {
      totalUsages,
      successTrend,
      popularPrompts,
      domainDistribution
    };
  }

  /**
   * Clean up old usage records to prevent memory bloat
   */
  cleanupOldRecords(maxAgeDays: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const toDelete: string[] = [];
    for (const [id, record] of this.usageRecords) {
      if (record.endTime && record.endTime < cutoffDate) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.usageRecords.delete(id);
    }

    // Also clean up analytics cache
    this.analyticsCache.clear();

    logger.info(`Cleaned up ${toDelete.length} old usage records`);
  }

  private generateUsageId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateEffectivenessFromFeedback(feedback: UserFeedback): number {
    // Convert 1-5 rating to 0-1 effectiveness score
    const ratingScore = (feedback.rating - 1) / 4; // 0-1 range
    const wouldUseAgainBonus = feedback.wouldUseAgain ? 0.1 : 0;

    return Math.min(1.0, ratingScore + wouldUseAgainBonus);
  }

  private generateImprovementSuggestions(usages: UsageRecord[]): string[] {
    const suggestions: string[] = [];

    const successRate = usages.filter(u => u.outcome.success).length / usages.length;

    if (successRate < 0.7) {
      suggestions.push('Consider adding more detailed error handling guidance');
    }

    const averageDuration = usages
      .filter(u => u.duration !== undefined)
      .reduce((sum, u) => sum + u.duration!, 0) / usages.length;

    if (averageDuration > 300000) { // 5 minutes
      suggestions.push('Consider breaking down complex tasks into smaller steps');
    }

    const commonErrors = usages
      .filter(u => u.outcome.errorDetails)
      .map(u => u.outcome.errorDetails!)
      .reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topErrors = Object.entries(commonErrors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    for (const [error, count] of topErrors) {
      if (count > usages.length * 0.1) { // More than 10% of usages
        suggestions.push(`Address common error: "${error}" (${count} occurrences)`);
      }
    }

    return suggestions;
  }

  private invalidateAnalyticsCache(promptId: string): void {
    this.analyticsCache.delete(promptId);
  }
}