#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { WorkflowOrchestrationService } from '../services/workflow-orchestration.service.js';
import { KnowledgeCaptureService } from '../services/knowledge-capture.service.js';
import { SessionManagerService } from '../services/session-manager.service.js';
import { CodeIntelligenceService } from '../domains/code-intel/code-intelligence.service.js';
import { TestExecutionService } from '../domains/execution/test-execution.service.js';
import { DebugSessionService } from '../domains/execution/debug-session.service.js';
import { GitAnalysisService } from '../domains/vcs/git-analysis.service.js';
import { DockerExecutionService } from '../domains/environment/docker-execution.service.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

class DevToolsServer {
  private server: Server;
  private workflowService: WorkflowOrchestrationService;
  private knowledgeService: KnowledgeCaptureService;
  private sessionService: SessionManagerService;

  // Domain services
  private codeIntelService: CodeIntelligenceService;
  private testService: TestExecutionService;
  private debugService: DebugSessionService;
  private gitService: GitAnalysisService;
  private dockerService: DockerExecutionService;

  constructor() {
    this.workflowService = new WorkflowOrchestrationService();
    this.knowledgeService = new KnowledgeCaptureService();
    this.sessionService = new SessionManagerService();

    // Initialize domain services
    this.codeIntelService = new CodeIntelligenceService();
    this.testService = new TestExecutionService();
    this.debugService = new DebugSessionService();
    this.gitService = new GitAnalysisService();
    this.dockerService = new DockerExecutionService();

    this.server = new Server(
      {
        name: 'mcp-devtools-unified',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupRequestHandlers();
  }

  private setupToolHandlers() {
    // Register all devtools tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Code Analysis Tools
          {
            name: 'analyze_code',
            description: 'Perform unified static code analysis on source files',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of file paths to analyze',
                  required: true
                },
                language: {
                  type: 'string',
                  description: 'Programming language (cpp, c, python, etc.)',
                  required: false
                },
                config: {
                  type: 'object',
                  description: 'Tool-specific configuration options',
                  required: false
                }
              }
            }
          },
          {
            name: 'analyze_changed_code',
            description: 'Analyze code changes using git diff + static analysis',
            inputSchema: {
              type: 'object',
              properties: {
                since_commit: {
                  type: 'string',
                  description: 'Git commit to compare against (default: HEAD~1)',
                  required: false
                },
                tools: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Analysis tools to use (cppcheck, clang-tidy, etc.)',
                  required: false
                }
              }
            }
          },

          // Testing Tools
          {
            name: 'run_tests',
            description: 'Execute tests with automatic framework detection',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Directory containing tests (default: .)',
                  required: false
                },
                framework: {
                  type: 'string',
                  description: 'Test framework override (auto-detect if not specified)',
                  required: false
                },
                pattern: {
                  type: 'string',
                  description: 'Test file pattern (e.g., "test_*.py", "*Test.java")',
                  required: false
                }
              }
            }
          },

          // Debugging Tools
          {
            name: 'debug_session_start',
            description: 'Start a debugging session with GDB/LLDB',
            inputSchema: {
              type: 'object',
              properties: {
                executable: {
                  type: 'string',
                  description: 'Path to executable to debug',
                  required: true
                },
                debugger: {
                  type: 'string',
                  description: 'Debugger to use (gdb, lldb, default: auto-detect)',
                  required: false
                },
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Command line arguments for the executable',
                  required: false
                },
                breakpoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Initial breakpoints to set',
                  required: false
                }
              }
            }
          },

          // Version Control Tools
          {
            name: 'git_analyze_history',
            description: 'Analyze git commit history for debugging insights',
            inputSchema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  description: 'File path to analyze history for',
                  required: false
                },
                author: {
                  type: 'string',
                  description: 'Filter by author email',
                  required: false
                },
                since: {
                  type: 'string',
                  description: 'Since date (ISO format or relative)',
                  required: false
                },
                until: {
                  type: 'string',
                  description: 'Until date (ISO format or relative)',
                  required: false
                }
              }
            }
          },

          // Container Tools
          {
            name: 'docker_exec_analysis',
            description: 'Execute analysis tools in Docker containers',
            inputSchema: {
              type: 'object',
              properties: {
                image: {
                  type: 'string',
                  description: 'Docker image to use',
                  required: true
                },
                command: {
                  type: 'string',
                  description: 'Analysis command to run',
                  required: true
                },
                volumes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Volume mounts (host:container format)',
                  required: false
                },
                working_dir: {
                  type: 'string',
                  description: 'Working directory inside container',
                  required: false
                }
              }
            }
          },

          // Workflow Orchestration
          {
            name: 'workflow_execute',
            description: 'Execute a multi-tool orchestrated workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_name: {
                  type: 'string',
                  description: 'Name of the workflow to execute',
                  required: true
                },
                context: {
                  type: 'object',
                  description: 'Workflow execution context and parameters',
                  required: false
                }
              }
            }
          }
        ]
      };
    });
  }

  private setupRequestHandlers() {
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_code':
            return await this.handleAnalyzeCode(args);
          case 'analyze_changed_code':
            return await this.handleAnalyzeChangedCode(args);
          case 'run_tests':
            return await this.handleRunTests(args);
          case 'debug_session_start':
            return await this.handleDebugSessionStart(args);
          case 'git_analyze_history':
            return await this.handleGitAnalyzeHistory(args);
          case 'docker_exec_analysis':
            return await this.handleDockerExecAnalysis(args);
          case 'workflow_execute':
            return await this.handleWorkflowExecute(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async handleAnalyzeCode(args: any) {
    logger.info('Executing analyze_code', args);

    try {
      const results = await this.codeIntelService.analyzeCode(args);

      // Record execution for knowledge capture
      for (const result of results) {
        await this.knowledgeService.recordExecution({
          tool: 'analyze_code',
          args,
          success: result.success,
          output: result.output,
          duration: result.duration,
          context: { language: args.language || 'unknown' }
        });
      }

      const summary = results.map(r =>
        `${r.tool}: ${r.success ? '✓' : '✗'} (${r.filesAnalyzed} files, ${r.errors.length} errors, ${r.warnings.length} warnings)`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Code analysis completed:\n${summary}`
          }
        ]
      };
    } catch (error) {
      logger.error('Code analysis failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Code analysis failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleAnalyzeChangedCode(args: any) {
    logger.info('Executing analyze_changed_code', args);

    try {
      const results = await this.codeIntelService.analyzeChangedCode(args);

      const summary = results.map(r =>
        `${r.tool}: ${r.success ? '✓' : '✗'} (${r.filesAnalyzed} files, ${r.errors.length} errors, ${r.warnings.length} warnings)`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Changed code analysis completed:\n${summary}`
          }
        ]
      };
    } catch (error) {
      logger.error('Changed code analysis failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Changed code analysis failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleRunTests(args: any) {
    logger.info('Executing run_tests', args);

    try {
      const result = await this.testService.runTests(args);

      // Record execution for knowledge capture
      await this.knowledgeService.recordExecution({
        tool: 'run_tests',
        args,
        success: result.success,
        output: result.output,
        duration: result.duration,
        context: { framework: result.framework }
      });

      const status = result.success ? '✓ PASSED' : '✗ FAILED';
      return {
        content: [
          {
            type: 'text',
            text: `Test execution completed using ${result.framework}:\n${status}\nPassed: ${result.passed}, Failed: ${result.failed}, Skipped: ${result.skipped}`
          }
        ]
      };
    } catch (error) {
      logger.error('Test execution failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Test execution failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleDebugSessionStart(args: any) {
    logger.info('Executing debug_session_start', args);

    try {
      const sessionId = this.sessionService.createDebugSession(args.executable, args.args || [], args.breakpoints || []);

      return {
        content: [
          {
            type: 'text',
            text: `Debug session started for ${args.executable} (Session ID: ${sessionId})`
          }
        ]
      };
    } catch (error) {
      logger.error('Debug session start failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Debug session start failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGitAnalyzeHistory(args: any) {
    logger.info('Executing git_analyze_history', args);

    try {
      const result = await this.gitService.analyzeHistory(args);

      const summary = `Git history analysis completed:
- ${result.commits.length} commits analyzed
- Time range: ${result.timeRange.start.toISOString()} to ${result.timeRange.end.toISOString()}
- Top contributors: ${Object.entries(result.authorStats).slice(0, 3).map(([author, count]) => `${author} (${count})`).join(', ')}
- Most changed files: ${Object.entries(result.fileChanges).sort(([,a], [,b]) => b - a).slice(0, 3).map(([file, changes]) => `${file} (${changes} changes)`).join(', ')}`;

      return {
        content: [
          {
            type: 'text',
            text: summary
          }
        ]
      };
    } catch (error) {
      logger.error('Git history analysis failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Git history analysis failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleDockerExecAnalysis(args: any) {
    logger.info('Executing docker_exec_analysis', args);

    try {
      const result = await this.dockerService.executeInContainer(args);

      const status = result.success ? '✓ SUCCESS' : '✗ FAILED';
      return {
        content: [
          {
            type: 'text',
            text: `Docker execution completed:\n${status} (Exit code: ${result.exitCode}, Duration: ${result.duration}ms)\nOutput: ${result.output.substring(0, 500)}${result.output.length > 500 ? '...' : ''}`
          }
        ]
      };
    } catch (error) {
      logger.error('Docker execution failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Docker execution failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleWorkflowExecute(args: any) {
    logger.info('Executing workflow_execute', args);

    try {
      const result = await this.workflowService.executeWorkflow(args.workflow_name, args.context || {});

      const summary = `Workflow execution completed:
- Status: ${result.completed_steps === result.total_steps ? '✓ SUCCESS' : '⚠ PARTIAL'}
- Completed: ${result.completed_steps}/${result.total_steps} steps
- Failed: ${result.failed_steps} steps
- Duration: ${result.duration || 'unknown'}ms`;

      return {
        content: [
          {
            type: 'text',
            text: summary
          }
        ]
      };
    } catch (error) {
      logger.error('Workflow execution failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Workflow execution failed: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async start() {
    logger.info('Starting MCP DevTools Unified server...');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('MCP DevTools Unified server started successfully');
  }
}

// Start the server
async function main() {
  const server = new DevToolsServer();
  await server.start();
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down MCP DevTools Unified server...');
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}