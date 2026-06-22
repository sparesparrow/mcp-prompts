/**
 * Pattern Synthesis Service
 * 
 * Synthesizes patterns from episodes and problem-solving experiences
 */

export interface EpisodePattern {
  id: string;
  patternId?: string;
  name: string;
  description: string;
  commonSymptoms: string[];
  commonSolutions: Array<{
    description: string;
    successRate: number;
    averageTime: number;
    steps: string[];
  }>;
  applicableDomains: number[];
  occurrences: Array<{
    context: {
      complexity: string;
    };
  }>;
  confidence?: number;
  abstractionLevel?: number;
}

export class PatternSynthesisService {
  private patterns: EpisodePattern[] = [];

  /**
   * Get all synthesized patterns
   */
  getPatterns(): EpisodePattern[] {
    return this.patterns;
  }

  /**
   * Add a new pattern
   */
  addPattern(pattern: EpisodePattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Find patterns matching criteria
   */
  findPatterns(criteria: {
    domain?: number;
    symptoms?: string[];
  }): EpisodePattern[] {
    return this.patterns.filter(pattern => {
      if (criteria.domain && !pattern.applicableDomains.includes(criteria.domain)) {
        return false;
      }
      if (criteria.symptoms) {
        return criteria.symptoms.some(symptom => 
          pattern.commonSymptoms.some(s => s.toLowerCase().includes(symptom.toLowerCase()))
        );
      }
      return true;
    });
  }
}

