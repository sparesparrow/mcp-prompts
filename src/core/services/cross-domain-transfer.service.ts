import pino from 'pino';
// import disabled for build
// import disabled for build
import { Domain, PromptLayer, SimpleMcpPromptsClient } from '../../types.js';
import { PatternSynthesisService, EpisodePattern } from './pattern-synthesis.service.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface TransferablePrinciple {
  id: string;
  name: string;
  abstractDescription: string;
  underlyingMechanism: string;
  sourceDomains: Domain[];
  targetDomains: Domain[];
  examples: TransferExample[];
  confidence: number;
  abstractionLevel: number;
  discoveredAt: Date;
  lastApplied?: Date;
  applicationCount: number;
}

export interface TransferExample {
  sourceDomain: Domain;
  targetDomain: Domain;
  sourceProblem: string;
  targetProblem: string;
  transferMechanism: string;
  successRate: number;
  notes: string;
}

export interface DomainMapping {
  sourceDomain: Domain;
  targetDomain: Domain;
  conceptMappings: Map<string, string>;
  principleMappings: Map<string, string>;
  toolAnalogies: Map<string, string>;
  confidence: number;
}

export interface TransferOpportunity {
  sourcePattern: EpisodePattern;
  targetDomain: Domain;
  transferMechanism: string;
  expectedEffectiveness: number;
  rationale: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export class CrossDomainTransferService {
  private mcpClient: SimpleMcpPromptsClient;
  private patternService: PatternSynthesisService;
  private transferablePrinciples: Map<string, TransferablePrinciple> = new Map();
  private domainMappings: Map<string, DomainMapping> = new Map();

  // Pre-defined domain relationships and analogies
  private domainAnalogies: Record<string, Record<string, any>> = {
    'embedded-software': {
      'application-software': {
        concepts: {
          'memory_constraints': 'resource_limits',
          'interrupt_handling': 'asynchronous_processing',
          'power_management': 'performance_optimization',
          'hardware_abstraction': 'api_design'
        },
        principles: {
          'resource_awareness': 'efficiency_focus',
          'failure_resilience': 'error_handling',
          'minimalism': 'lean_design'
        }
      }
    }
  };

  constructor(
    mcpClient?: SimpleMcpPromptsClient,
    patternService?: PatternSynthesisService
  ) {
    this.mcpClient = mcpClient || new SimpleMcpPromptsClient();
    this.patternService = patternService || new PatternSynthesisService();
    this.initializeDomainMappings();
  }

  /**
   * Discover transferable principles from existing knowledge
   */
  async discoverTransferablePrinciples(): Promise<TransferablePrinciple[]> {
    logger.info('Discovering transferable principles across domains');

    const principles: TransferablePrinciple[] = [];
    const patterns = this.patternService.getPatterns();

    // Group patterns by abstract concepts
    const conceptGroups = this.groupPatternsByConcepts(patterns);

    for (const [conceptKey, relatedPatterns] of conceptGroups) {
      if (relatedPatterns.length >= 2) { // Need at least 2 domains for transfer
        const principle = await this.synthesizeTransferablePrinciple(conceptKey, relatedPatterns);
        if (principle) {
          principles.push(principle);
          this.transferablePrinciples.set(principle.id, principle);
        }
      }
    }

    logger.info(`Discovered ${principles.length} transferable principles`);
    return principles;
  }

  /**
   * Find transfer opportunities for a given context
   */
  async findTransferOpportunities(
    currentContext: {
      domain: string;
      problem: string;
      symptoms: string[];
      availableTools: string[];
    }
  ): Promise<TransferOpportunity[]> {
    const opportunities: TransferOpportunity[] = [];
    const currentDomain = this.mapStringToDomain(currentContext.domain);

    // Find patterns in other domains that might be applicable
    const patterns = this.patternService.getPatterns();

    for (const pattern of patterns) {
      // Skip patterns from the same domain
      if (pattern.applicableDomains.includes(currentDomain)) continue;

      // Check if pattern symptoms match current problem
      const symptomMatch = this.calculateSymptomMatch(pattern.commonSymptoms, currentContext.symptoms);

      if (symptomMatch >= 0.6) { // Good symptom match
        // Find transfer mechanism
        const transferMechanism = this.findTransferMechanism(pattern, currentDomain);

        if (transferMechanism) {
          const opportunity: TransferOpportunity = {
            sourcePattern: pattern,
            targetDomain: currentDomain,
            transferMechanism: transferMechanism.description,
            expectedEffectiveness: symptomMatch * transferMechanism.confidence,
            rationale: `Pattern "${pattern.name}" from ${pattern.applicableDomains.map(d => Domain[d]).join('/')} domains matches ${symptomMatch.toFixed(2)} of current symptoms`,
            riskLevel: transferMechanism.confidence > 0.8 ? 'low' : transferMechanism.confidence > 0.6 ? 'medium' : 'high'
          };

          opportunities.push(opportunity);
        }
      }
    }

    // Sort by expected effectiveness
    return opportunities.sort((a, b) => b.expectedEffectiveness - a.expectedEffectiveness);
  }

  /**
   * Apply a transfer opportunity to generate a new prompt
   */
  async applyTransferOpportunity(opportunity: TransferOpportunity): Promise<string | null> {
    try {
      // Generate transferred prompt content
      const transferredContent = await this.generateTransferredPrompt(opportunity);

      if (transferredContent) {
        // Create the new prompt
        const promptName = `transferred-${opportunity.sourcePattern.name.toLowerCase().replace(/\s+/g, '-')}-to-${Domain[opportunity.targetDomain].toLowerCase()}`;

        await this.mcpClient.createPrompt({
          name: promptName,
          content: transferredContent,
          layer: PromptLayer.Transfer,
          domain: opportunity.targetDomain,
          tags: ['transferred', 'cross-domain', opportunity.sourcePattern.name.toLowerCase().replace(/\s+/g, '-')],
          abstractionLevel: Math.max(opportunity.sourcePattern.abstractionLevel, 7) // High abstraction for transfers
        });

        // Update transfer statistics
        this.updateTransferStatistics(opportunity);

        logger.info(`Successfully applied transfer: ${opportunity.sourcePattern.name} → ${Domain[opportunity.targetDomain]}`);
        return promptName;
      }

    } catch (error) {
      logger.error('Failed to apply transfer opportunity:', error);
    }

    return null;
  }

  /**
   * Evaluate transfer effectiveness
   */
  async evaluateTransferEffectiveness(
    transferredPromptId: string,
    usageOutcomes: Array<{ success: boolean; effectiveness: number }>
  ): Promise<void> {
    if (usageOutcomes.length === 0) return;

    const averageEffectiveness = usageOutcomes.reduce((sum, o) => sum + o.effectiveness, 0) / usageOutcomes.length;
    const successRate = usageOutcomes.filter(o => o.success).length / usageOutcomes.length;

    // Update confidence in transfer mechanisms
    // This would refine future transfer recommendations

    logger.info(`Transfer effectiveness for ${transferredPromptId}: ${successRate.toFixed(2)} success rate, ${averageEffectiveness.toFixed(2)} avg effectiveness`);
  }

  /**
   * Get transfer statistics and insights
   */
  getTransferInsights(): {
    totalTransfers: number;
    successfulTransfers: number;
    domainTransferMatrix: Record<string, Record<string, number>>;
    mostTransferredPrinciples: Array<{ principle: string; transfers: number }>;
  } {
    const transfers = Array.from(this.transferablePrinciples.values());
    const totalTransfers = transfers.reduce((sum, p) => sum + p.applicationCount, 0);

    // Build domain transfer matrix
    const domainTransferMatrix: Record<string, Record<string, number>> = {};

    for (const principle of transfers) {
      for (const sourceDomain of principle.sourceDomains) {
        for (const targetDomain of principle.targetDomains) {
          const sourceKey = Domain[sourceDomain];
          const targetKey = Domain[targetDomain];

          if (!domainTransferMatrix[sourceKey]) {
            domainTransferMatrix[sourceKey] = {};
          }
          if (!domainTransferMatrix[sourceKey][targetKey]) {
            domainTransferMatrix[sourceKey][targetKey] = 0;
          }
          domainTransferMatrix[sourceKey][targetKey] += principle.applicationCount;
        }
      }
    }

    // Find most transferred principles
    const principleTransfers = transfers
      .map(p => ({ principle: p.name, transfers: p.applicationCount }))
      .sort((a, b) => b.transfers - a.transfers)
      .slice(0, 10);

    return {
      totalTransfers,
      successfulTransfers: totalTransfers, // Simplified - would track actual success
      domainTransferMatrix,
      mostTransferredPrinciples: principleTransfers
    };
  }

  private initializeDomainMappings(): void {
    // Initialize common domain mappings
    const mappings: Array<{ source: Domain; target: Domain; mappings: any }> = [
      {
        source: Domain.SoftwareDevelopment,
        target: Domain.Security,
        mappings: {
          concepts: {
            'error_handling': 'threat_mitigation',
            'input_validation': 'security_validation',
            'access_control': 'authorization'
          },
          tools: {
            'debugging_tools': 'security_scanners',
            'testing_frameworks': 'vulnerability_assessment'
          }
        }
      },
      {
        source: Domain.SoftwareDevelopment,
        target: Domain.DataScience,
        mappings: {
          concepts: {
            'algorithm_optimization': 'model_optimization',
            'performance_monitoring': 'model_evaluation',
            'data_validation': 'feature_validation'
          }
        }
      }
    ];

    for (const mapping of mappings) {
      const key = `${Domain[mapping.source]}-${Domain[mapping.target]}`;
      this.domainMappings.set(key, {
        sourceDomain: mapping.source,
        targetDomain: mapping.target,
        conceptMappings: new Map(Object.entries(mapping.mappings.concepts || {})),
        principleMappings: new Map(Object.entries(mapping.mappings.principles || {})),
        toolAnalogies: new Map(Object.entries(mapping.mappings.tools || {})),
        confidence: 0.7 // Base confidence, updated with usage
      });
    }
  }

  private groupPatternsByConcepts(patterns: EpisodePattern[]): Map<string, EpisodePattern[]> {
    const conceptGroups = new Map<string, EpisodePattern[]>();

    for (const pattern of patterns) {
      // Extract abstract concepts from pattern symptoms and solutions
      const concepts = this.extractAbstractConcepts(pattern);

      for (const concept of concepts) {
        if (!conceptGroups.has(concept)) {
          conceptGroups.set(concept, []);
        }
        conceptGroups.get(concept)!.push(pattern);
      }
    }

    return conceptGroups;
  }

  private extractAbstractConcepts(pattern: EpisodePattern): string[] {
    const concepts: string[] = [];

    // Analyze symptoms for abstract concepts
    for (const symptom of pattern.commonSymptoms) {
      if (symptom.includes('memory') || symptom.includes('resource')) {
        concepts.push('resource_constraint');
      }
      if (symptom.includes('error') || symptom.includes('failure')) {
        concepts.push('error_handling');
      }
      if (symptom.includes('performance') || symptom.includes('slow')) {
        concepts.push('performance_optimization');
      }
      if (symptom.includes('communication') || symptom.includes('interface')) {
        concepts.push('inter_component_communication');
      }
    }

    // Analyze solutions for abstract concepts
    for (const solution of pattern.commonSolutions) {
      if (solution.description.includes('isolate') || solution.description.includes('separate')) {
        concepts.push('component_isolation');
      }
      if (solution.description.includes('monitor') || solution.description.includes('check')) {
        concepts.push('monitoring_and_observation');
      }
      if (solution.description.includes('retry') || solution.description.includes('fallback')) {
        concepts.push('resilience_patterns');
      }
    }

    return [...new Set(concepts)]; // Remove duplicates
  }

  private async synthesizeTransferablePrinciple(
    conceptKey: string,
    patterns: EpisodePattern[]
  ): Promise<TransferablePrinciple | null> {
    // Extract domains from patterns
    const domains = new Set<Domain>();
    for (const pattern of patterns) {
      pattern.applicableDomains.forEach(domain => domains.add(domain));
    }

    if (domains.size < 2) return null; // Need at least 2 domains for transfer

    const domainList = Array.from(domains);
    const examples = await this.generateTransferExamples(conceptKey, patterns);

    const principle: TransferablePrinciple = {
      id: `principle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${conceptKey.replace('_', ' ')} principle`,
      abstractDescription: `The principle of ${conceptKey.replace('_', ' ')} applies across multiple domains`,
      underlyingMechanism: this.describeUnderlyingMechanism(conceptKey),
      sourceDomains: domainList,
      targetDomains: domainList, // Can be applied bidirectionally
      examples,
      confidence: Math.min(0.9, patterns.length * 0.1), // Higher confidence with more patterns
      abstractionLevel: 8, // High abstraction for transferable principles
      discoveredAt: new Date(),
      applicationCount: 0
    };

    return principle;
  }

  private async generateTransferExamples(
    conceptKey: string,
    patterns: EpisodePattern[]
  ): Promise<TransferExample[]> {
    const examples: TransferExample[] = [];

    // Generate examples by pairing patterns from different domains
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const pattern1 = patterns[i];
        const pattern2 = patterns[j];

        // Find common symptoms or solutions
        const commonSymptoms = pattern1.commonSymptoms.filter(s =>
          pattern2.commonSymptoms.some(s2 => this.calculateSimilarity(s, s2) > 0.7)
        );

        if (commonSymptoms.length > 0) {
          examples.push({
            sourceDomain: pattern1.applicableDomains[0],
            targetDomain: pattern2.applicableDomains[0],
            sourceProblem: pattern1.commonSymptoms[0],
            targetProblem: pattern2.commonSymptoms[0],
            transferMechanism: `Apply ${pattern1.commonSolutions[0]?.description || 'solution approach'} from ${Domain[pattern1.applicableDomains[0]]} to ${Domain[pattern2.applicableDomains[0]]}`,
            successRate: Math.min(pattern1.confidence, pattern2.confidence),
            notes: `Transferred based on ${commonSymptoms.length} common symptoms`
          });
        }
      }
    }

    return examples;
  }

  private describeUnderlyingMechanism(conceptKey: string): string {
    const mechanisms: Record<string, string> = {
      'resource_constraint': 'Limited availability of computational resources requires efficient allocation and monitoring',
      'error_handling': 'Systematic identification and mitigation of potential failure modes',
      'performance_optimization': 'Trade-off analysis between speed, efficiency, and resource usage',
      'component_isolation': 'Separating concerns to prevent cascading failures',
      'monitoring_and_observation': 'Continuous assessment of system state and behavior',
      'resilience_patterns': 'Designing systems to withstand and recover from failures'
    };

    return mechanisms[conceptKey] || `Abstract principle of ${conceptKey} applicable across domains`;
  }

  private calculateSymptomMatch(patternSymptoms: string[], currentSymptoms: string[]): number {
    if (patternSymptoms.length === 0 || currentSymptoms.length === 0) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (const patternSymptom of patternSymptoms) {
      for (const currentSymptom of currentSymptoms) {
        const similarity = this.calculateSimilarity(patternSymptom, currentSymptom);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private findTransferMechanism(pattern: EpisodePattern, targetDomain: Domain): any | null {
    // Find domain mapping
    for (const mapping of this.domainMappings.values()) {
      if (mapping.sourceDomain === pattern.applicableDomains[0] &&
          mapping.targetDomain === targetDomain) {
        return {
          description: `Map concepts from ${Domain[mapping.sourceDomain]} to ${Domain[mapping.targetDomain]}`,
          confidence: mapping.confidence
        };
      }
    }

    // Fallback: generic transfer mechanism
    return {
      description: `Apply ${pattern.name} pattern directly with domain-appropriate adaptations`,
      confidence: 0.5
    };
  }

  private async generateTransferredPrompt(opportunity: TransferOpportunity): Promise<string> {
    const sourcePattern = opportunity.sourcePattern;

    // Get domain mapping for concept translation
    const mapping = this.findDomainMapping(sourcePattern.applicableDomains[0], opportunity.targetDomain);

    let transferredContent = `# ${sourcePattern.name} (Transferred to ${Domain[opportunity.targetDomain]})\n\n`;

    transferredContent += `## Original Context\n`;
    transferredContent += `**Source Domain**: ${sourcePattern.applicableDomains.map(d => Domain[d]).join(', ')}\n`;
    transferredContent += `**Target Domain**: ${Domain[opportunity.targetDomain]}\n`;
    transferredContent += `**Transfer Confidence**: ${(opportunity.expectedEffectiveness * 100).toFixed(1)}%\n\n`;

    transferredContent += `## Adapted Symptoms\n`;
    for (const symptom of sourcePattern.commonSymptoms) {
      const translatedSymptom = mapping ? this.translateConcept(symptom, mapping) : symptom;
      transferredContent += `- ${translatedSymptom}\n`;
    }
    transferredContent += '\n';

    transferredContent += `## Adapted Solutions\n`;
    for (const solution of sourcePattern.commonSolutions.slice(0, 3)) {
      transferredContent += `### ${solution.description}\n`;
      transferredContent += `**Expected Success Rate**: ${(solution.successRate * 100).toFixed(1)}%\n\n`;

      // Adapt steps for target domain
      transferredContent += `Adapted steps for ${Domain[opportunity.targetDomain]}:\n`;
      for (let i = 0; i < solution.steps.length; i++) {
        const adaptedStep = mapping ? this.adaptStepForDomain(solution.steps[i], mapping) : solution.steps[i];
        transferredContent += `${i + 1}. ${adaptedStep}\n`;
      }
      transferredContent += '\n';
    }

    transferredContent += `## Transfer Rationale\n`;
    transferredContent += `${opportunity.rationale}\n\n`;
    transferredContent += `## Risk Assessment\n`;
    transferredContent += `**Risk Level**: ${opportunity.riskLevel}\n`;
    transferredContent += `**Recommendation**: ${opportunity.riskLevel === 'low' ? 'Proceed with confidence' : opportunity.riskLevel === 'medium' ? 'Test thoroughly before applying' : 'Use with caution and close monitoring'}\n\n`;

    transferredContent += `## Validation\n`;
    transferredContent += `Monitor effectiveness and provide feedback to improve future transfers.\n\n`;
    transferredContent += `*This prompt was automatically generated through cross-domain knowledge transfer.*`;

    return transferredContent;
  }

  private findDomainMapping(sourceDomain: Domain, targetDomain: Domain): DomainMapping | null {
    const key1 = `${Domain[sourceDomain]}-${Domain[targetDomain]}`;
    const key2 = `${Domain[targetDomain]}-${Domain[sourceDomain]}`;

    return this.domainMappings.get(key1) || this.domainMappings.get(key2) || null;
  }

  private translateConcept(concept: string, mapping: DomainMapping): string {
    // Try concept mappings first
    for (const [source, target] of mapping.conceptMappings) {
      if (concept.toLowerCase().includes(source.toLowerCase())) {
        return concept.replace(new RegExp(source, 'gi'), target);
      }
    }

    // Return original if no mapping found
    return concept;
  }

  private adaptStepForDomain(step: string, mapping: DomainMapping): string {
    let adaptedStep = step;

    // Apply concept mappings
    for (const [source, target] of mapping.conceptMappings) {
      adaptedStep = adaptedStep.replace(new RegExp(source, 'gi'), target);
    }

    // Apply tool analogies
    for (const [source, target] of mapping.toolAnalogies) {
      adaptedStep = adaptedStep.replace(new RegExp(source, 'gi'), target);
    }

    return adaptedStep;
  }

  private updateTransferStatistics(opportunity: TransferOpportunity): void {
    // Update applicable principles
    for (const principle of this.transferablePrinciples.values()) {
      if (principle.sourceDomains.includes(opportunity.sourcePattern.applicableDomains[0]) &&
          principle.targetDomains.includes(opportunity.targetDomain)) {
        principle.applicationCount++;
        principle.lastApplied = new Date();
      }
    }
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