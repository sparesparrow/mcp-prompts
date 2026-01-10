import { Router, Request, Response } from 'express';
import { OrchestrateService, OrchestrationMode } from '../../core/services/orchestrate.service';
import { ProjectScaffoldService } from '../../core/services/project-scaffold.service';
import { ReportGenerationService } from '../../core/services/report-generation.service';
import { ValidationError, NotFoundError } from '../../core/errors/custom-errors';

export function createOrchestrateRouter(
  orchestrateService: OrchestrateService,
  projectScaffoldService: ProjectScaffoldService,
  reportGenerationService: ReportGenerationService
): Router {
  const router = Router();

  /**
   * POST /v1/orchestrate/detect-project-type
   * Detect the project type from a file path
   */
  router.post('/detect-project-type', async (req: Request, res: Response) => {
    try {
      const { projectPath } = req.body;

      if (!projectPath || typeof projectPath !== 'string') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'projectPath is required and must be a non-empty string'
        });
      }

      const detection = await orchestrateService.detectProjectType(projectPath);

      res.json({
        projectType: detection.type,
        confidence: detection.confidence,
        evidence: detection.evidence,
        languages: detection.languages,
        frameworks: detection.frameworks
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to detect project type',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /v1/orchestrate
   * Start orchestration for a project
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { projectPath, mode = 'analyze', customContext } = req.body;

      if (!projectPath || typeof projectPath !== 'string') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'projectPath is required and must be a non-empty string'
        });
      }

      const validModes: OrchestrationMode[] = ['analyze', 'review', 'refactor', 'test', 'document'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          error: 'Validation error',
          message: `mode must be one of: ${validModes.join(', ')}`
        });
      }

      const report = await orchestrateService.orchestrate(projectPath, mode, {
        customContext
      });

      res.json({
        executionId: report.executionId,
        projectPath: report.projectPath,
        projectType: report.projectType,
        mode: report.mode,
        status: report.status,
        startTime: report.startTime,
        phaseCount: report.phaseResults.length
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to start orchestration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/orchestrate/:executionId
   * Get orchestration execution status and report
   */
  router.get('/:executionId', async (req: Request, res: Response) => {
    try {
      const { executionId } = req.params;

      const execution = orchestrateService.getExecution(executionId);
      if (!execution) {
        return res.status(404).json({
          error: 'Not found',
          message: `Execution ${executionId} not found`
        });
      }

      res.json({
        executionId: execution.executionId,
        projectPath: execution.projectPath,
        projectType: execution.projectType,
        mode: execution.mode,
        status: execution.status,
        startTime: execution.startTime,
        endTime: execution.endTime,
        phaseCount: execution.phaseResults.length,
        recommendations: execution.synthesis?.recommendations?.length || 0
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get execution',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/orchestrate/:executionId/report
   * Get full orchestration report with optional format
   */
  router.get('/:executionId/report', async (req: Request, res: Response) => {
    try {
      const { executionId } = req.params;
      const { format = 'json' } = req.query;

      const execution = orchestrateService.getExecution(executionId);
      if (!execution) {
        return res.status(404).json({
          error: 'Not found',
          message: `Execution ${executionId} not found`
        });
      }

      const generatedReport = await reportGenerationService.generateAnalysisReport(execution);

      if (format === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown');
        res.send(generatedReport.markdown);
      } else if (format === 'html') {
        res.setHeader('Content-Type', 'text/html');
        res.send(generatedReport.html);
      } else {
        // JSON format (default)
        res.json(generatedReport.json);
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/orchestrate
   * List all orchestrations
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { limit = '50' } = req.query;

      const executions = orchestrateService.listExecutions(parseInt(limit as string));

      res.json({
        executions: executions.map(e => ({
          executionId: e.executionId,
          projectPath: e.projectPath,
          projectType: e.projectType,
          mode: e.mode,
          status: e.status,
          startTime: e.startTime,
          endTime: e.endTime
        })),
        total: executions.length
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to list orchestrations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /v1/orchestrate/scaffold
   * Create a new project from a template
   */
  router.post('/scaffold', async (req: Request, res: Response) => {
    try {
      const { templateId, variables, outputPath } = req.body;

      if (!templateId || typeof templateId !== 'string') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'templateId is required and must be a string'
        });
      }

      if (!variables || typeof variables !== 'object') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'variables is required and must be an object'
        });
      }

      if (!outputPath || typeof outputPath !== 'string') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'outputPath is required and must be a string'
        });
      }

      const result = await projectScaffoldService.scaffoldProject(
        templateId,
        variables,
        outputPath
      );

      res.json({
        projectId: result.projectId,
        projectPath: result.projectPath,
        fileCount: result.createdFiles.length,
        directoryCount: result.createdDirectories.length,
        timestamp: result.timestamp
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to scaffold project',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /v1/orchestrate/validate-template
   * Validate template variables
   */
  router.post('/validate-template', async (req: Request, res: Response) => {
    try {
      const { templateId, variables } = req.body;

      if (!templateId || typeof templateId !== 'string') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'templateId is required and must be a string'
        });
      }

      if (!variables || typeof variables !== 'object') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'variables is required and must be an object'
        });
      }

      const validation = await projectScaffoldService.validateVariables(
        templateId,
        variables
      );

      res.json(validation);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to validate template',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
