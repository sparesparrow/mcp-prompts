#!/usr/bin/env node
/**
 * Orchestrate Service
 *
 * Core business logic for project orchestration:
 * - Project type detection
 * - Subagent orchestration in phases
 * - Report generation and synthesis
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IPromptRepository } from '../ports/prompt-repository.interface';
import { IEventBus } from '../ports/event-bus.interface';
import { Prompt } from '../entities/prompt.entity';
import { PromptEvent } from '../events/prompt.event';
import { SubagentService } from './subagent.service';
import { MainAgentService } from './main-agent.service';
import { ValidationError, NotFoundError } from '../errors/custom-errors';

/**
 * Result of project type detection
 */
export interface ProjectDetectionResult {
  type: string;
  confidence: number;
  evidence: string[];
  languages: string[];
  frameworks: string[];
}

/**
 * Orchestration mode options
 */
export type OrchestrationMode = 'analyze' | 'review' | 'refactor' | 'test' | 'document';

/**
 * Phase results
 */
export interface PhaseResult {
  phaseName: string;
  subagent: string;
  summary: string;
  findings: Record<string, any>;
  confidence: number;
}

/**
 * Analysis report
 */
export interface AnalysisReport {
  executionId: string;
  projectPath: string;
  projectType: string;
  mode: OrchestrationMode;
  startTime: Date;
  endTime?: Date;
  status: 'queued' | 'executing' | 'completed' | 'failed';
  phaseResults: PhaseResult[];
  synthesis?: {
    summary: string;
    recommendations: Recommendation[];
    metrics: Record<string, any>;
  };
  error?: string;
}

/**
 * Recommendation from orchestration
 */
export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  actionItems: string[];
}

/**
 * Orchestrate Service
 */
export class OrchestrateService {
  private executions: Map<string, AnalysisReport> = new Map();

  constructor(
    private promptRepository: IPromptRepository,
    private subagentService: SubagentService,
    private mainAgentService: MainAgentService,
    private eventBus: IEventBus
  ) {}

  /**
   * Detect project type from file system
   */
  async detectProjectType(projectPath: string): Promise<ProjectDetectionResult> {
    try {
      const evidence: string[] = [];
      const languages: string[] = [];
      const frameworks: string[] = [];
      let confidence = 0;

      // Check if path exists
      try {
        await fs.access(projectPath);
      } catch (err) {
        throw new ValidationError(`Project path does not exist: ${projectPath}`);
      }

      // Read directory structure
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      const fileNames = entries.map(e => e.name);

      // Detect by build/config files
      if (fileNames.includes('CMakeLists.txt') || fileNames.includes('Makefile')) {
        languages.push('C++');
        frameworks.push('CMake');
        evidence.push('Found CMakeLists.txt or Makefile');
        confidence += 0.3;
      }

      if (fileNames.includes('package.json')) {
        languages.push('JavaScript');
        confidence += 0.2;
        evidence.push('Found package.json');

        // Check for framework hints in package.json
        const packageJson = JSON.parse(
          await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')
        );
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.react || deps['@react/core']) {
          frameworks.push('React');
          confidence += 0.15;
        }
        if (deps.vue) {
          frameworks.push('Vue');
          confidence += 0.15;
        }
        if (deps.express || deps.fastify) {
          languages.push('Backend');
          confidence += 0.1;
        }
        if (deps.typescript) {
          languages.push('TypeScript');
          confidence += 0.1;
        }
      }

      if (fileNames.includes('pyproject.toml') || fileNames.includes('requirements.txt')) {
        languages.push('Python');
        confidence += 0.3;
        evidence.push('Found Python project files');

        if (fileNames.includes('setup.py')) {
          evidence.push('Found setup.py - Python package');
        }
      }

      if (fileNames.includes('build.gradle') || fileNames.includes('pom.xml')) {
        languages.push('Java');
        confidence += 0.3;
        frameworks.push('Gradle');
        evidence.push('Found build system files');
      }

      if (fileNames.includes('go.mod')) {
        languages.push('Go');
        confidence += 0.3;
        evidence.push('Found go.mod');
      }

      if (fileNames.includes('Cargo.toml')) {
        languages.push('Rust');
        confidence += 0.3;
        evidence.push('Found Cargo.toml');
      }

      if (fileNames.includes('pubspec.yaml')) {
        languages.push('Dart');
        frameworks.push('Flutter');
        confidence += 0.3;
        evidence.push('Found Flutter project');
      }

      if (fileNames.includes('platformio.ini')) {
        languages.push('C++');
        frameworks.push('PlatformIO');
        evidence.push('Found PlatformIO - Embedded project');
        confidence += 0.4;
      }

      if (fileNames.includes('AndroidManifest.xml') || fileNames.includes('build.gradle.kts')) {
        languages.push('Kotlin');
        frameworks.push('Android');
        confidence += 0.35;
        evidence.push('Found Android project files');
      }

      // Detect by directory structure
      if (entries.some(e => e.isDirectory() && e.name === 'src')) {
        evidence.push('Found src/ directory - typical project structure');
        confidence += 0.05;
      }

      if (entries.some(e => e.isDirectory() && (e.name === 'test' || e.name === 'tests' || e.name === '__tests__'))) {
        evidence.push('Found test directory');
        confidence += 0.05;
      }

      // Determine overall project type
      let projectType = 'unknown';
      if (languages.includes('Python')) {
        projectType = 'python_backend';
      } else if (languages.includes('C++')) {
        if (frameworks.includes('PlatformIO')) {
          projectType = 'embedded_iot';
        } else {
          projectType = 'cpp_backend';
        }
      } else if (languages.includes('JavaScript') || languages.includes('TypeScript')) {
        if (frameworks.includes('React')) {
          projectType = 'web_frontend';
        } else if (languages.includes('Backend')) {
          projectType = 'web_backend';
        } else {
          projectType = 'web_frontend';
        }
      } else if (languages.includes('Kotlin') && frameworks.includes('Android')) {
        projectType = 'android_app';
      } else if (languages.includes('Go') || languages.includes('Rust')) {
        projectType = 'backend';
      } else if (fileNames.includes('Dockerfile') || fileNames.includes('docker-compose.yml')) {
        projectType = 'devops_infrastructure';
        confidence += 0.2;
      }

      // Clamp confidence between 0 and 1
      confidence = Math.min(1, Math.max(0, confidence));

      await this.eventBus.publish(new PromptEvent('project_detected', projectType, new Date(), {
        confidence,
        evidence,
        languages,
        frameworks
      }));

      return {
        type: projectType,
        confidence,
        evidence,
        languages,
        frameworks
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to detect project type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Orchestrate project analysis with specified mode
   */
  async orchestrate(
    projectPath: string,
    mode: OrchestrationMode,
    options?: {
      parallelSubagents?: boolean;
      timeoutSeconds?: number;
      customContext?: string;
    }
  ): Promise<AnalysisReport> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const report: AnalysisReport = {
      executionId,
      projectPath,
      projectType: 'unknown',
      mode,
      startTime: new Date(),
      status: 'queued',
      phaseResults: []
    };

    this.executions.set(executionId, report);

    try {
      report.status = 'executing';
      await this.eventBus.publish(new PromptEvent('orchestration_started', executionId, new Date(), {
        projectPath,
        mode
      }));

      // Phase 1: Detect project type
      const detection = await this.detectProjectType(projectPath);
      report.projectType = detection.type;

      // Phase 2: Get main agent for project type
      const mainAgent = await this.mainAgentService.getMainAgentForProjectType(detection.type);
      if (!mainAgent) {
        throw new NotFoundError(`No main agent found for project type: ${detection.type}`);
      }

      // Phase 3: Execute discovery phase
      const discoveryResults = await this.executeDiscoveryPhase(projectPath, mainAgent);
      report.phaseResults.push(...discoveryResults);

      // Phase 4: Execute analysis phase based on mode
      const analysisResults = await this.executeAnalysisPhase(
        projectPath,
        mainAgent,
        mode,
        options?.parallelSubagents ?? false
      );
      report.phaseResults.push(...analysisResults);

      // Phase 5: Synthesize results
      const synthesis = await this.synthesizeResults(mainAgent, report.phaseResults, options?.customContext);
      report.synthesis = synthesis;

      report.status = 'completed';
      report.endTime = new Date();

      await this.eventBus.publish(new PromptEvent('orchestration_completed', executionId, new Date(), {
        phaseCount: report.phaseResults.length,
        mode,
        success: true
      }));

      return report;
    } catch (error) {
      report.status = 'failed';
      report.endTime = new Date();
      report.error = error instanceof Error ? error.message : 'Unknown error';

      await this.eventBus.publish(new PromptEvent('orchestration_failed', executionId, new Date(), {
        error: report.error,
        mode
      }));

      throw error;
    }
  }

  /**
   * Execute discovery phase (explorer, git analyzer, config analyzer)
   */
  private async executeDiscoveryPhase(projectPath: string, mainAgent: Prompt): Promise<PhaseResult[]> {
    const results: PhaseResult[] = [];

    // Get discovery subagents
    const discoverySubagents = ['explorer', 'git_analyzer', 'config_analyzer'];

    for (const subagentId of discoverySubagents) {
      try {
        const subagent = await this.subagentService.getSubagent(subagentId);
        if (!subagent) {
          continue;
        }

        // Simulate subagent execution
        const phaseResult: PhaseResult = {
          phaseName: 'discovery',
          subagent: subagentId,
          summary: `Executed ${subagentId} on project at ${projectPath}`,
          findings: {
            timestamp: new Date(),
            projectPath
          },
          confidence: 0.8
        };

        results.push(phaseResult);

        await this.eventBus.publish(new PromptEvent('subagent_executed', subagentId, new Date(), {
          phase: 'discovery',
          projectPath
        }));
      } catch (error) {
        console.warn(`Failed to execute discovery subagent ${subagentId}:`, error);
      }
    }

    return results;
  }

  /**
   * Execute analysis phase based on mode
   */
  private async executeAnalysisPhase(
    projectPath: string,
    mainAgent: Prompt,
    mode: OrchestrationMode,
    parallel: boolean
  ): Promise<PhaseResult[]> {
    const results: PhaseResult[] = [];

    // Map modes to subagents
    const modeSubagentMap: Record<OrchestrationMode, string[]> = {
      analyze: ['analyzer', 'solid_analyzer', 'dependency_analyzer'],
      review: ['reviewer', 'solid_analyzer'],
      refactor: ['refactorer', 'analyzer'],
      test: ['tester'],
      document: ['documenter']
    };

    const subagents = modeSubagentMap[mode] || [];

    for (const subagentId of subagents) {
      try {
        const subagent = await this.subagentService.getSubagent(subagentId);
        if (!subagent) {
          continue;
        }

        // Simulate subagent execution
        const phaseResult: PhaseResult = {
          phaseName: mode,
          subagent: subagentId,
          summary: `Executed ${subagentId} for ${mode} on project`,
          findings: {
            timestamp: new Date(),
            mode,
            projectPath
          },
          confidence: 0.75
        };

        results.push(phaseResult);

        await this.eventBus.publish(new PromptEvent('subagent_executed', subagentId, new Date(), {
          phase: mode,
          projectPath
        }));
      } catch (error) {
        console.warn(`Failed to execute analysis subagent ${subagentId}:`, error);
      }
    }

    return results;
  }

  /**
   * Synthesize results from all phases
   */
  private async synthesizeResults(
    mainAgent: Prompt,
    phaseResults: PhaseResult[],
    customContext?: string
  ): Promise<{ summary: string; recommendations: Recommendation[]; metrics: Record<string, any> }> {
    // Generate summary from phase results
    const summary = `Analysis complete with ${phaseResults.length} subagent phases executed. ` +
      `Phases: ${phaseResults.map(p => p.subagent).join(', ')}`;

    // Generate recommendations based on phase results
    const recommendations: Recommendation[] = [];

    if (phaseResults.some(p => p.phaseName === 'review')) {
      recommendations.push({
        priority: 'high',
        category: 'Code Quality',
        description: 'Improve code quality with SOLID principles',
        actionItems: [
          'Review architecture compliance',
          'Refactor large functions',
          'Add comprehensive error handling'
        ]
      });
    }

    if (phaseResults.some(p => p.phaseName === 'test')) {
      recommendations.push({
        priority: 'high',
        category: 'Testing',
        description: 'Enhance test coverage',
        actionItems: [
          'Add unit tests for critical paths',
          'Implement integration tests',
          'Set up CI/CD pipelines'
        ]
      });
    }

    if (phaseResults.some(p => p.phaseName === 'document')) {
      recommendations.push({
        priority: 'medium',
        category: 'Documentation',
        description: 'Improve project documentation',
        actionItems: [
          'Add API documentation',
          'Create architecture diagrams',
          'Document design decisions'
        ]
      });
    }

    // Calculate metrics
    const metrics = {
      totalPhases: phaseResults.length,
      averageConfidence: phaseResults.reduce((sum, p) => sum + p.confidence, 0) / phaseResults.length,
      executionTime: new Date(),
      subagentsInvolved: Array.from(new Set(phaseResults.map(p => p.subagent)))
    };

    await this.eventBus.publish(new PromptEvent('synthesis_complete', 'orchestration', new Date(), {
      recommendationCount: recommendations.length,
      metrics
    }));

    return {
      summary,
      recommendations,
      metrics
    };
  }

  /**
   * Get execution history
   */
  getExecution(executionId: string): AnalysisReport | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List all executions
   */
  listExecutions(limit: number = 50): AnalysisReport[] {
    const execs = Array.from(this.executions.values());
    return execs.sort((a, b) => b.startTime.getTime() - a.startTime.getTime()).slice(0, limit);
  }
}
