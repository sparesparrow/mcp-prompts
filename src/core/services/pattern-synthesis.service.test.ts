import { describe, it, expect, beforeEach } from 'vitest';
import { PatternSynthesisService, type EpisodePattern } from './pattern-synthesis.service';

/**
 * Tests for src/core/services/pattern-synthesis.service.ts
 *
 * Backlog H4 target #3: covers the in-memory store and the case-insensitive,
 * substring-matching `findPatterns` filter.
 */

function makePattern(overrides: Partial<EpisodePattern> = {}): EpisodePattern {
  return {
    id: 'p_default',
    name: 'default pattern',
    description: 'default',
    commonSymptoms: ['slow response', 'High latency'],
    commonSolutions: [
      { description: 'cache it', successRate: 0.8, averageTime: 120, steps: ['add lru'] },
    ],
    applicableDomains: [1, 2],
    occurrences: [{ context: { complexity: 'medium' } }],
    ...overrides,
  };
}

describe('PatternSynthesisService', () => {
  let svc: PatternSynthesisService;

  beforeEach(() => {
    svc = new PatternSynthesisService();
  });

  it('starts with an empty pattern list', () => {
    expect(svc.getPatterns()).toEqual([]);
  });

  it('addPattern appends, preserving insertion order', () => {
    svc.addPattern(makePattern({ id: 'p1' }));
    svc.addPattern(makePattern({ id: 'p2' }));
    svc.addPattern(makePattern({ id: 'p3' }));
    expect(svc.getPatterns().map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('getPatterns returns the live internal array reference (current behaviour)', () => {
    // Pin existing behaviour so any future move to defensive-copy is a deliberate change.
    const a = svc.getPatterns();
    svc.addPattern(makePattern({ id: 'p1' }));
    const b = svc.getPatterns();
    expect(a).toBe(b);
    expect(b.length).toBe(1);
  });

  describe('findPatterns', () => {
    beforeEach(() => {
      svc.addPattern(
        makePattern({ id: 'p_db', applicableDomains: [10], commonSymptoms: ['Connection refused'] }),
      );
      svc.addPattern(
        makePattern({ id: 'p_cache', applicableDomains: [20], commonSymptoms: ['Slow response'] }),
      );
      svc.addPattern(
        makePattern({ id: 'p_both', applicableDomains: [10, 20], commonSymptoms: ['Timeout'] }),
      );
    });

    it('with no criteria returns every pattern', () => {
      expect(svc.findPatterns({}).map((p) => p.id).sort()).toEqual(['p_both', 'p_cache', 'p_db']);
    });

    it('domain filter narrows to patterns whose applicableDomains include it', () => {
      const hits = svc.findPatterns({ domain: 10 }).map((p) => p.id).sort();
      expect(hits).toEqual(['p_both', 'p_db']);
    });

    it('domain filter that no one matches returns an empty list', () => {
      expect(svc.findPatterns({ domain: 999 })).toEqual([]);
    });

    it('symptoms filter is case-insensitive substring match against commonSymptoms', () => {
      // "slow" substring -> matches "Slow response"
      const hits = svc.findPatterns({ symptoms: ['slow'] }).map((p) => p.id);
      expect(hits).toEqual(['p_cache']);
    });

    it('symptoms filter uses OR semantics across the array', () => {
      const hits = svc.findPatterns({ symptoms: ['refused', 'timeout'] }).map((p) => p.id).sort();
      expect(hits).toEqual(['p_both', 'p_db']);
    });

    it('symptoms filter returning no match yields []', () => {
      expect(svc.findPatterns({ symptoms: ['nothing-matches-this'] })).toEqual([]);
    });

    it('domain + symptoms: current implementation falls through after domain filter and OR-matches symptoms; pinning behaviour', () => {
      // Behaviour pin: when both are set the current code applies domain first
      // and then OR-evaluates symptoms across whatever survives. A pattern that
      // passes domain but whose symptoms do not match a "no-hit" symptom list
      // is filtered out by the symptoms branch.
      const hits = svc.findPatterns({ domain: 10, symptoms: ['refused'] }).map((p) => p.id);
      expect(hits).toEqual(['p_db']);
    });
  });
});
