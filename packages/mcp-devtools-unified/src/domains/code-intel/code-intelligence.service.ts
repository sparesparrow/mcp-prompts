import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface AnalysisResult {
  tool: string;
  success: boolean;
  output: string;
  errors: string[];
  warnings: string[];
  duration: number;
  filesAnalyzed: number;
}

export interface AnalysisOptions {
  files: string[];
  language?: string;
  config?: Record<string, any>;
  workingDirectory?: string;
  timeout?: number;
}

export class CodeIntelligenceService {
  private defaultTimeout = 30000; // 30 seconds

  /**
   * Analyze code using multiple static analysis tools
   */
  async analyzeCode(options: AnalysisOptions): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const startTime = Date.now();

    logger.info('Starting code analysis', {
      files: options.files.length,
      language: options.language
    });

    try {
      // Detect language if not specified
      const language = options.language || this.detectLanguage(options.files);

      // Run appropriate analyzers based on language
      switch (language.toLowerCase()) {
        case 'cpp':
        case 'c':
          results.push(await this.runCppCheck(options));
          results.push(await this.runClangTidy(options));
          break;
        case 'python':
          results.push(await this.runPythonAnalysis(options));
          break;
        case 'javascript':
        case 'typescript':
          results.push(await this.runJavaScriptAnalysis(options));
          break;
        default:
          results.push(await this.runGenericAnalysis(options));
      }

      const totalDuration = Date.now() - startTime;
      logger.info(`Code analysis completed in ${totalDuration}ms`, {
        tools: results.length,
        totalIssues: results.reduce((sum, r) => sum + r.errors.length + r.warnings.length, 0)
      });

    } catch (error) {
      logger.error('Code analysis failed:', error);
      results.push({
        tool: 'analysis-coordinator',
        success: false,
        output: `Analysis failed: ${error.message}`,
        errors: [`Analysis failed: ${error.message}`],
        warnings: [],
        duration: Date.now() - startTime,
        filesAnalyzed: 0
      });
    }

    return results;
  }

  /**
   * Analyze changed code using git diff
   */
  async analyzeChangedCode(options: {
    sinceCommit?: string;
    tools?: string[];
    workingDirectory?: string;
  }): Promise<AnalysisResult[]> {
    const workingDir = options.workingDirectory || process.cwd();

    // Get changed files
    const changedFiles = await this.getChangedFiles(options.sinceCommit || 'HEAD~1', workingDir);

    if (changedFiles.length === 0) {
      return [{
        tool: 'git-diff',
        success: true,
        output: 'No changed files to analyze',
        errors: [],
        warnings: [],
        duration: 0,
        filesAnalyzed: 0
      }];
    }

    // Filter to source files only
    const sourceFiles = changedFiles.filter(file =>
      this.isSourceFile(file) && fs.existsSync(path.join(workingDir, file))
    );

    if (sourceFiles.length === 0) {
      return [{
        tool: 'git-diff',
        success: true,
        output: `Found ${changedFiles.length} changed files, but no source files to analyze`,
        errors: [],
        warnings: [],
        duration: 0,
        filesAnalyzed: 0
      }];
    }

    // Analyze the changed files
    const analysisOptions: AnalysisOptions = {
      files: sourceFiles.map(f => path.join(workingDir, f)),
      workingDirectory: workingDir
    };

    return await this.analyzeCode(analysisOptions);
  }

  /**
   * Get files changed since a specific commit
   */
  private async getChangedFiles(sinceCommit: string, workingDir: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', ['diff', '--name-only', sinceCommit], {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          const files = stdout.trim().split('\n').filter(Boolean);
          resolve(files);
        } else {
          reject(new Error(`Git diff failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Run CppCheck analysis
   */
  private async runCppCheck(options: AnalysisOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const args = [
        '--enable=all',
        '--std=c++17',
        '--language=c++',
        '--xml',
        '--xml-version=2',
        ...options.files
      ];

      if (options.workingDirectory) {
        args.push('--suppress=missingIncludeSystem');
      }

      const cppcheck = spawn('cppcheck', args, {
        cwd: options.workingDirectory,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      cppcheck.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      cppcheck.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      cppcheck.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = code === 0;

        // Parse cppcheck XML output
        const { errors, warnings } = this.parseCppCheckOutput(stdout, stderr);

        resolve({
          tool: 'cppcheck',
          success,
          output: stdout || stderr,
          errors,
          warnings,
          duration,
          filesAnalyzed: options.files.length
        });
      });

      cppcheck.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve({
          tool: 'cppcheck',
          success: false,
          output: `CppCheck execution failed: ${error.message}`,
          errors: [`CppCheck execution failed: ${error.message}`],
          warnings: [],
          duration,
          filesAnalyzed: 0
        });
      });

      // Timeout
      setTimeout(() => {
        cppcheck.kill();
        const duration = Date.now() - startTime;
        resolve({
          tool: 'cppcheck',
          success: false,
          output: 'CppCheck analysis timed out',
          errors: ['CppCheck analysis timed out'],
          warnings: [],
          duration,
          filesAnalyzed: 0
        });
      }, options.timeout || this.defaultTimeout);
    });
  }

  /**
   * Run Clang-Tidy analysis
   */
  private async runClangTidy(options: AnalysisOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      // First check if compile_commands.json exists
      const compileCommandsPath = path.join(options.workingDirectory || '.', 'compile_commands.json');
      const hasCompileCommands = fs.existsSync(compileCommandsPath);

      if (!hasCompileCommands) {
        resolve({
          tool: 'clang-tidy',
          success: false,
          output: 'compile_commands.json not found. Run cmake with -DCMAKE_EXPORT_COMPILE_COMMANDS=ON first.',
          errors: ['compile_commands.json not found'],
          warnings: [],
          duration: Date.now() - startTime,
          filesAnalyzed: 0
        });
        return;
      }

      const args = [
        '-p', options.workingDirectory || '.',
        '--checks=*',
        ...options.files
      ];

      const clangTidy = spawn('clang-tidy', args, {
        cwd: options.workingDirectory,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      clangTidy.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      clangTidy.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      clangTidy.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = code === 0;

        // Parse clang-tidy output
        const { errors, warnings } = this.parseClangTidyOutput(stdout, stderr);

        resolve({
          tool: 'clang-tidy',
          success,
          output: stdout || stderr,
          errors,
          warnings,
          duration,
          filesAnalyzed: options.files.length
        });
      });

      clangTidy.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve({
          tool: 'clang-tidy',
          success: false,
          output: `Clang-Tidy execution failed: ${error.message}`,
          errors: [`Clang-Tidy execution failed: ${error.message}`],
          warnings: [],
          duration,
          filesAnalyzed: 0
        });
      });

      // Timeout
      setTimeout(() => {
        clangTidy.kill();
        const duration = Date.now() - startTime;
        resolve({
          tool: 'clang-tidy',
          success: false,
          output: 'Clang-Tidy analysis timed out',
          errors: ['Clang-Tidy analysis timed out'],
          warnings: [],
          duration,
          filesAnalyzed: 0
        });
      }, options.timeout || this.defaultTimeout);
    });
  }

  /**
   * Run Python analysis (placeholder)
   */
  private async runPythonAnalysis(options: AnalysisOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    // TODO: Implement Python analysis (pylint, flake8, mypy, etc.)
    return {
      tool: 'python-analysis',
      success: true,
      output: 'Python analysis not yet implemented',
      errors: [],
      warnings: ['Python analysis not yet implemented'],
      duration: Date.now() - startTime,
      filesAnalyzed: options.files.length
    };
  }

  /**
   * Run JavaScript/TypeScript analysis (placeholder)
   */
  private async runJavaScriptAnalysis(options: AnalysisOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    // TODO: Implement JS/TS analysis (eslint, typescript, etc.)
    return {
      tool: 'javascript-analysis',
      success: true,
      output: 'JavaScript/TypeScript analysis not yet implemented',
      errors: [],
      warnings: ['JavaScript/TypeScript analysis not yet implemented'],
      duration: Date.now() - startTime,
      filesAnalyzed: options.files.length
    };
  }

  /**
   * Run generic analysis (placeholder)
   */
  private async runGenericAnalysis(options: AnalysisOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    return {
      tool: 'generic-analysis',
      success: true,
      output: 'Generic analysis completed (no specific tools available for this language)',
      errors: [],
      warnings: [],
      duration: Date.now() - startTime,
      filesAnalyzed: options.files.length
    };
  }

  /**
   * Detect programming language from files
   */
  private detectLanguage(files: string[]): string {
    if (files.length === 0) return 'unknown';

    const extensions = files.map(f => path.extname(f).toLowerCase());
    const uniqueExtensions = [...new Set(extensions)];

    // Language detection based on file extensions
    if (uniqueExtensions.includes('.cpp') || uniqueExtensions.includes('.cc') || uniqueExtensions.includes('.cxx')) {
      return 'cpp';
    }
    if (uniqueExtensions.includes('.c')) {
      return 'c';
    }
    if (uniqueExtensions.includes('.py')) {
      return 'python';
    }
    if (uniqueExtensions.includes('.js')) {
      return 'javascript';
    }
    if (uniqueExtensions.includes('.ts')) {
      return 'typescript';
    }

    return 'unknown';
  }

  /**
   * Check if file is a source file
   */
  private isSourceFile(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    const sourceExtensions = ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.py', '.js', '.ts', '.java'];
    return sourceExtensions.includes(ext);
  }

  /**
   * Parse CppCheck XML output
   */
  private parseCppCheckOutput(stdout: string, stderr: string): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Simple parsing - in a real implementation, you'd parse the XML properly
    const lines = (stdout + stderr).split('\n');

    for (const line of lines) {
      if (line.includes('error')) {
        errors.push(line.trim());
      } else if (line.includes('warning') || line.includes('style') || line.includes('performance')) {
        warnings.push(line.trim());
      }
    }

    return { errors, warnings };
  }

  /**
   * Parse Clang-Tidy output
   */
  private parseClangTidyOutput(stdout: string, stderr: string): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const lines = (stdout + stderr).split('\n');

    for (const line of lines) {
      if (line.includes('error')) {
        errors.push(line.trim());
      } else if (line.includes('warning') || line.includes('suggestion')) {
        warnings.push(line.trim());
      }
    }

    return { errors, warnings };
  }
}