import pino from 'pino';
import { McpPromptsClient } from '../adapters/mcp-prompts-client.js';
import { PromptLayer, Domain } from '@sparesparrow/mcp-fbs';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface ToolExecutionResult {
  tool: string;
  args: Record<string, any>;
  success: boolean;
  output: string;
  duration: number;
  context: Record<string, any>;
}

export interface PatternCandidate {
  pattern: string;
  confidence: number;
  occurrences: ToolExecutionResult[];
  abstraction_level: number;
}

export class KnowledgeCaptureService {
  private mcpClient: McpPromptsClient;
  private executionHistory: ToolExecutionResult[] = [];
  private maxHistorySize = 1000;

  constructor(mcpClient?: McpPromptsClient) {
    this.mcpClient = mcpClient || new McpPromptsClient();
  }

  /**
   * Record a tool execution for potential knowledge capture
   */
  async recordExecution(result: ToolExecutionResult): Promise<void> {
    logger.info(`Recording tool execution: ${result.tool}`, {
      success: result.success,
      duration: result.duration
    });

    // Add to execution history
    this.executionHistory.push(result);

    // Maintain history size limit
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }

    // Analyze for learning opportunities
    if (result.success) {
      await this.analyzeForLearningOpportunities(result);
    } else {
      await this.analyzeFailureForLearning(result);
    }
  }

  /**
   * Analyze successful executions for pattern extraction
   */
  private async analyzeForLearningOpportunities(result: ToolExecutionResult): Promise<void> {
    // Look for patterns in recent executions
    const patternCandidates = this.identifyPatterns(result);

    for (const candidate of patternCandidates) {
      if (candidate.confidence > 0.7) {
        await this.captureSuccessfulPattern(candidate);
      }
    }

    // Check if this represents a novel successful approach
    const isNovel = await this.isNovelSuccessPattern(result);
    if (isNovel) {
      await this.captureNovelSuccess(result);
    }
  }

  /**
   * Analyze failed executions for learning opportunities
   */
  private async analyzeFailureForLearning(result: ToolExecutionResult): Promise<void> {
    // Extract failure signature
    const failureSignature = this.extractFailureSignature(result);

    // Query for existing knowledge about this failure
    const existingKnowledge = await this.mcpClient.searchEpisodes({
      symptoms: failureSignature.symptoms,
      context_fingerprint: failureSignature.context_hash
    });

    if (existingKnowledge.length === 0) {
      // This is a novel failure - capture it
      await this.captureNovelFailure(result, failureSignature);
    } else {
      // Update existing knowledge with new instance
      await this.updateExistingFailureKnowledge(result, existingKnowledge[0]);
    }
  }

  /**
   * Identify patterns in tool executions
   */
  private identifyPatterns(currentResult: ToolExecutionResult): PatternCandidate[] {
    const candidates: PatternCandidate[] = [];

    // Look for successful execution sequences
    const recentSuccesses = this.executionHistory
      .filter(r => r.success && r.tool === currentResult.tool)
      .slice(-10); // Last 10 successful executions of this tool

    if (recentSuccesses.length >= 3) {
      // Check for common argument patterns
      const commonArgs = this.findCommonArguments(recentSuccesses);

      if (Object.keys(commonArgs).length > 0) {
        candidates.push({
          pattern: `successful-${currentResult.tool}-configuration`,
          confidence: Math.min(recentSuccesses.length / 10, 1.0),
          occurrences: recentSuccesses,
          abstraction_level: 2
        });
      }
    }

    // Look for tool sequences that commonly succeed together
    const toolSequences = this.findSuccessfulToolSequences();
    for (const sequence of toolSequences) {
      if (sequence.tools.includes(currentResult.tool)) {
        candidates.push({
          pattern: `successful-tool-sequence-${sequence.tools.join('-')}`,
          confidence: sequence.confidence,
          occurrences: sequence.executions,
          abstraction_level: 3
        });
      }
    }

    return candidates;
  }

  /**
   * Find common arguments across successful executions
   */
  private findCommonArguments(executions: ToolExecutionResult[]): Record<string, any> {
    const argCounts: Record<string, Record<string, number>> = {};

    // Count occurrences of each argument value
    for (const execution of executions) {
      for (const [key, value] of Object.entries(execution.args)) {
        if (!argCounts[key]) argCounts[key] = {};
        const valueStr = JSON.stringify(value);
        argCounts[key][valueStr] = (argCounts[key][valueStr] || 0) + 1;
      }
    }

    // Find arguments that are common across most executions
    const commonArgs: Record<string, any> = {};
    const threshold = executions.length * 0.7; // 70% agreement

    for (const [key, valueCounts] of Object.entries(argCounts)) {
      for (const [valueStr, count] of Object.entries(valueCounts)) {
        if (count >= threshold) {
          try {
            commonArgs[key] = JSON.parse(valueStr);
          } catch {
            commonArgs[key] = valueStr;
          }
          break; // Take the most common value
        }
      }
    }

    return commonArgs;
  }

  /**
   * Find sequences of tools that commonly succeed together
   */
  private findSuccessfulToolSequences(): Array<{tools: string[], confidence: number, executions: ToolExecutionResult[]}> {
    // Group executions by time windows and look for successful sequences
    const sequences: Array<{tools: string[], confidence: number, executions: ToolExecutionResult[]}> = [];

    // Simple implementation: look for pairs of tools that often execute successfully together
    const toolPairs = new Map<string, ToolExecutionResult[]>();

    // Group by time windows (simplified - using execution order)
    const windowSize = 5;
    for (let i = 0; i < this.executionHistory.length - windowSize; i++) {
      const window = this.executionHistory.slice(i, i + windowSize);
      const successfulTools = window.filter(r => r.success).map(r => r.tool);

      if (successfulTools.length >= 2) {
        const pairKey = successfulTools.slice(0, 2).sort().join('-');
        if (!toolPairs.has(pairKey)) {
          toolPairs.set(pairKey, []);
        }
        toolPairs.get(pairKey)!.push(...window);
      }
    }

    // Convert to sequences with confidence scores
    for (const [pairKey, executions] of toolPairs) {
      const tools = pairKey.split('-');
      const successRate = executions.filter(r => r.success).length / executions.length;

      if (successRate > 0.8 && executions.length >= 3) {
        sequences.push({
          tools,
          confidence: successRate,
          executions
        });
      }
    }

    return sequences;
  }

  /**
   * Capture a successful pattern as new knowledge
   */
  private async captureSuccessfulPattern(candidate: PatternCandidate): Promise<void> {
    logger.info(`Capturing successful pattern: ${candidate.pattern}`, {
      confidence: candidate.confidence,
      occurrences: candidate.occurrences.length
    });

    // Create configuration prompt for this pattern
    const configArgs = this.findCommonArguments(candidate.occurrences);

    const promptContent = `## Successful ${candidate.pattern} Configuration

Based on ${candidate.occurrences.length} successful executions, this configuration works well:

\`\`\`json
${JSON.stringify(configArgs, null, 2)}
\`\`\`

### Success Rate
${(candidate.confidence * 100).toFixed(1)}% success rate across ${candidate.occurrences.length} executions.

### Common Context
- Tools: ${[...new Set(candidate.occurrences.map(r => r.tool))].join(', ')}
- Average duration: ${this.calculateAverageDuration(candidate.occurrences)}ms

### Usage Recommendation
Use this configuration when:
${this.generateUsageRecommendations(candidate)}
`;

    await this.mcpClient.createPrompt({
      name: candidate.pattern,
      content: promptContent,
      layer: PromptLayer.Procedural,
      domain: Domain.SoftwareDevelopment,
      tags: ['configuration', 'successful-pattern', 'derived-knowledge'],
      abstractionLevel: candidate.abstraction_level
    });
  }

  /**
   * Check if this represents a novel success pattern
   */
  private async isNovelSuccessPattern(result: ToolExecutionResult): Promise<boolean> {
    // Query existing knowledge for this tool + context combination
    const existingPrompts = await this.mcpClient.searchPrompts({
      layer: 4, // Procedural
      tags: [result.tool, 'successful']
    });

    // Check if we have similar successful configurations
    const similarConfigs = existingPrompts.filter(prompt => {
      // TODO: Implement similarity checking
      return false; // For now, assume all are novel
    });

    return similarConfigs.length === 0;
  }

  /**
   * Capture a novel successful execution
   */
  private async captureNovelSuccess(result: ToolExecutionResult): Promise<void> {
    const episode = {
      name: `novel-success-${result.tool}-${Date.now()}`,
      problem_signature: {
        symptoms: result.context.symptoms || ['tool execution'],
        context_fingerprint: JSON.stringify(result.context),
        affected_components: [result.tool]
      },
      context: {
        project_type: result.context.project_type || 'unknown',
        domain: 'software-development'
      },
      investigation_path: [{
        step_number: 1,
        action: `Execute ${result.tool} with args: ${JSON.stringify(result.args)}`,
        findings: `Success: ${result.output.substring(0, 200)}...`,
        led_to_solution: true
      }],
      solution: {
        description: `Successfully executed ${result.tool}`,
        implementation_steps: [`Run ${result.tool} with configuration`],
        validation_method: 'Tool execution completed without errors'
      },
      success: true,
      cognitive_load: 1,
      generalization_cues: [`${result.tool}-success-pattern`],
      tags: ['novel-success', result.tool, 'learning-opportunity']
    };

    await this.mcpClient.captureEpisode(episode);
  }

  /**
   * Extract failure signature from failed execution
   */
  private extractFailureSignature(result: ToolExecutionResult): any {
    return {
      symptoms: this.parseErrorSymptoms(result.output),
      context_hash: this.hashContext(result.context),
      error_patterns: this.extractErrorPatterns(result.output),
      tool: result.tool
    };
  }

  /**
   * Capture a novel failure for future learning
   */
  private async captureNovelFailure(
    result: ToolExecutionResult,
    failureSignature: any
  ): Promise<void> {
    const episode = {
      name: `novel-failure-${result.tool}-${Date.now()}`,
      problem_signature: failureSignature,
      context: {
        project_type: result.context.project_type || 'unknown',
        domain: 'software-development'
      },
      investigation_path: [{
        step_number: 1,
        action: `Execute ${result.tool} with args: ${JSON.stringify(result.args)}`,
        findings: `Failed: ${result.output.substring(0, 200)}...`,
        led_to_solution: false
      }],
      solution: {
        description: 'Failure - no solution found',
        implementation_steps: [],
        validation_method: 'N/A - execution failed'
      },
      success: false,
      cognitive_load: 2,
      generalization_cues: [`${result.tool}-failure-pattern`],
      tags: ['novel-failure', result.tool, 'learning-opportunity']
    };

    await this.mcpClient.captureEpisode(episode);
  }

  /**
   * Update existing failure knowledge with new instance
   */
  private async updateExistingFailureKnowledge(
    result: ToolExecutionResult,
    existingEpisode: any
  ): Promise<void> {
    // Update usage statistics and potentially refine the failure pattern
    logger.info(`Updating existing failure knowledge for ${result.tool}`);
    // TODO: Implement knowledge updating logic
  }

  // Utility methods
  private parseErrorSymptoms(output: string): string[] {
    // Simple error parsing - in reality, this would be more sophisticated
    const lines = output.split('\n');
    return lines.filter(line =>
      line.toLowerCase().includes('error') ||
      line.toLowerCase().includes('failed') ||
      line.toLowerCase().includes('exception')
    );
  }

  private hashContext(context: Record<string, any>): string {
    // Simple hash for context fingerprinting
    return require('crypto').createHash('md5').update(JSON.stringify(context)).digest('hex');
  }

  private extractErrorPatterns(output: string): string[] {
    // Extract common error patterns
    const patterns: string[] = [];
    if (output.includes('segmentation fault')) patterns.push('memory-corruption');
    if (output.includes('permission denied')) patterns.push('permission-issue');
    if (output.includes('command not found')) patterns.push('missing-dependency');
    return patterns;
  }

  private calculateAverageDuration(executions: ToolExecutionResult[]): number {
    const total = executions.reduce((sum, r) => sum + r.duration, 0);
    return Math.round(total / executions.length);
  }

  private generateUsageRecommendations(candidate: PatternCandidate): string {
    // Generate context-aware usage recommendations
    const recommendations: string[] = [];

    if (candidate.pattern.includes('cppcheck')) {
      recommendations.push('- Analyzing C/C++ codebases');
      recommendations.push('- Before compilation to catch common errors');
    }

    if (candidate.pattern.includes('test')) {
      recommendations.push('- After code changes to verify functionality');
      recommendations.push('- In CI/CD pipelines for automated testing');
    }

    return recommendations.map(r => `- ${r}`).join('\n');
  }
}