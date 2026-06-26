import { describe, it, expect } from 'vitest';
import type {
  PhaseResult,
  Recommendation,
  AnalysisReport,
} from './orchestrate.service';

/**
 * Tests for src/core/services/orchestrate.service.ts
 *
 * Backlog H4 target #2: the current module is type-only. The tests here pin
 * the shape of PhaseResult, Recommendation, and AnalysisReport so any
 * accidental rename or required-field demotion fails the suite.
 *
 * If/when behaviour lands (e.g. an Orchestrator class), extend this file
 * rather than starting over.
 */

describe('orchestrate.service types', () => {
  it('PhaseResult accepts all 5 documented fields with their declared shapes', () => {
    const pr: PhaseResult = {
      phaseName: 'discovery',
      subagent: 'sonnet-discovery',
      summary: 'Found 12 candidate files.',
      confidence: 0.82,
      findings: { files: 12, ignored: 3 },
    };
    expect(pr.phaseName).toBe('discovery');
    expect(pr.subagent).toBe('sonnet-discovery');
    expect(typeof pr.confidence).toBe('number');
    expect(pr.findings.files).toBe(12);
  });

  it('Recommendation.priority is restricted to high|medium|low at compile time', () => {
    const high: Recommendation = {
      category: 'security',
      description: 'Add CSRF protection',
      priority: 'high',
      actionItems: ['Audit forms', 'Add middleware'],
    };
    const low: Recommendation = {
      category: 'docs',
      description: 'Add example to README',
      priority: 'low',
      actionItems: [],
    };
    expect(high.priority).toBe('high');
    expect(low.actionItems).toEqual([]);
  });

  it('AnalysisReport.status is restricted to success|error|partial', () => {
    const okReport: AnalysisReport = {
      executionId: 'exec_1',
      projectPath: '/tmp/proj',
      projectType: 'node',
      mode: 'standard',
      status: 'success',
      startTime: new Date('2026-06-26T07:00:00Z'),
      phaseResults: [],
    };
    expect(okReport.status).toBe('success');

    const errReport: AnalysisReport = {
      ...okReport,
      executionId: 'exec_2',
      status: 'error',
      error: 'oom',
    };
    expect(errReport.status).toBe('error');
    expect(errReport.error).toBe('oom');

    const partial: AnalysisReport = {
      ...okReport,
      executionId: 'exec_3',
      status: 'partial',
    };
    expect(partial.status).toBe('partial');
  });

  it('AnalysisReport.synthesis is optional and carries summary + recommendations + metrics', () => {
    const report: AnalysisReport = {
      executionId: 'exec_4',
      projectPath: '/tmp/proj',
      projectType: 'python',
      mode: 'deep',
      status: 'success',
      startTime: new Date(),
      endTime: new Date(),
      phaseResults: [
        {
          phaseName: 'analyze',
          subagent: 'haiku-analyze',
          summary: 'ok',
          confidence: 0.9,
          findings: {},
        },
      ],
      synthesis: {
        summary: 'all green',
        recommendations: [
          { category: 'perf', description: 'cache it', priority: 'medium', actionItems: ['add lru'] },
        ],
        metrics: { duration_ms: 1234 },
      },
    };
    expect(report.synthesis?.recommendations.length).toBe(1);
    expect(report.synthesis?.metrics.duration_ms).toBe(1234);
    expect(report.phaseResults.length).toBe(1);
  });

  it('AnalysisReport with no synthesis or endTime is still a valid object', () => {
    const report: AnalysisReport = {
      executionId: 'exec_5',
      projectPath: '/tmp/proj',
      projectType: 'rust',
      mode: 'quick',
      status: 'partial',
      startTime: new Date(),
      phaseResults: [],
    };
    expect(report.endTime).toBeUndefined();
    expect(report.synthesis).toBeUndefined();
  });
});
