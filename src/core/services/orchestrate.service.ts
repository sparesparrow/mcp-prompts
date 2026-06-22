/**
 * Orchestrate Service Types
 * 
 * Types for orchestration and analysis reports
 */

export interface PhaseResult {
  phaseName: string;
  subagent: string;
  summary: string;
  confidence: number;
  findings: Record<string, any>;
}

export interface Recommendation {
  category: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionItems: string[];
}

export interface AnalysisReport {
  executionId: string;
  projectPath: string;
  projectType: string;
  mode: string;
  status: 'success' | 'error' | 'partial';
  startTime: Date;
  endTime?: Date;
  phaseResults: PhaseResult[];
  synthesis?: {
    summary: string;
    recommendations: Recommendation[];
    metrics: Record<string, any>;
  };
  error?: string;
}

