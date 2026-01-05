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

export interface TestResult {
  framework: string;
  success: boolean;
  output: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errorDetails?: string[];
}

export interface TestOptions {
  directory?: string;
  framework?: string;
  pattern?: string;
  timeout?: number;
}

export class TestExecutionService {
  private defaultTimeout = 300000; // 5 minutes for tests

  /**
   * Run tests with automatic framework detection
   */
  async runTests(options: TestOptions = {}): Promise<TestResult> {
    const startTime = Date.now();
    const directory = options.directory || process.cwd();

    logger.info('Starting test execution', { directory, framework: options.framework });

    try {
      // Detect test framework if not specified
      const framework = options.framework || await this.detectTestFramework(directory);

      let result: TestResult;

      switch (framework.toLowerCase()) {
        case 'jest':
          result = await this.runJestTests(directory, options);
          break;
        case 'vitest':
          result = await this.runVitestTests(directory, options);
          break;
        case 'pytest':
          result = await this.runPytestTests(directory, options);
          break;
        case 'googletest':
        case 'gtest':
          result = await this.runGoogleTestTests(directory, options);
          break;
        case 'catch2':
          result = await this.runCatch2Tests(directory, options);
          break;
        default:
          result = await this.runGenericTests(directory, options);
      }

      const totalDuration = Date.now() - startTime;
      result.duration = totalDuration;

      logger.info(`Test execution completed`, {
        framework,
        success: result.success,
        passed: result.passed,
        failed: result.failed,
        duration: totalDuration
      });

      return result;

    } catch (error) {
      logger.error('Test execution failed:', error);
      return {
        framework: 'unknown',
        success: false,
        output: `Test execution failed: ${error.message}`,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: Date.now() - startTime,
        errorDetails: [error.message]
      };
    }
  }

  /**
   * Detect test framework based on project structure
   */
  private async detectTestFramework(directory: string): Promise<string> {
    // Check for package.json
    const packageJsonPath = path.join(directory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.jest) return 'jest';
        if (deps.vitest) return 'vitest';
      } catch (error) {
        // Ignore JSON parse errors
      }
    }

    // Check for Python test files
    if (fs.existsSync(path.join(directory, 'pytest.ini')) ||
        fs.existsSync(path.join(directory, 'tox.ini')) ||
        fs.existsSync(path.join(directory, 'setup.cfg'))) {
      return 'pytest';
    }

    // Check for C++ test files
    const files = fs.readdirSync(directory);
    if (files.some(f => f.includes('test') && (f.endsWith('.cpp') || f.endsWith('.cc')))) {
      // Look for test framework includes
      for (const file of files) {
        if (file.endsWith('.cpp') || file.endsWith('.cc') || file.endsWith('.h')) {
          const content = fs.readFileSync(path.join(directory, file), 'utf8');
          if (content.includes('gtest/gtest.h')) return 'gtest';
          if (content.includes('catch.hpp')) return 'catch2';
        }
      }
    }

    return 'unknown';
  }

  /**
   * Run Jest tests
   */
  private async runJestTests(directory: string, options: TestOptions): Promise<TestResult> {
    return new Promise((resolve) => {
      const args = ['--passWithNoTests'];
      if (options.pattern) {
        args.push('--testPathPattern', options.pattern);
      }

      const jest = spawn('npx', ['jest', ...args], {
        cwd: directory,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        const output = stdout + stderr;
        const result = this.parseJestOutput(output, code);
        resolve(result);
      });

      jest.on('error', (error) => {
        resolve({
          framework: 'jest',
          success: false,
          output: `Jest execution failed: ${error.message}`,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errorDetails: [error.message]
        });
      });
    });
  }

  /**
   * Run Vitest tests
   */
  private async runVitestTests(directory: string, options: TestOptions): Promise<TestResult> {
    return new Promise((resolve) => {
      const args = ['vitest', 'run'];
      if (options.pattern) {
        args.push('--reporter', 'verbose');
      }

      const vitest = spawn('npx', args, {
        cwd: directory,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      vitest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      vitest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      vitest.on('close', (code) => {
        const output = stdout + stderr;
        const result = this.parseVitestOutput(output, code);
        resolve(result);
      });

      vitest.on('error', (error) => {
        resolve({
          framework: 'vitest',
          success: false,
          output: `Vitest execution failed: ${error.message}`,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errorDetails: [error.message]
        });
      });
    });
  }

  /**
   * Run pytest tests
   */
  private async runPytestTests(directory: string, options: TestOptions): Promise<TestResult> {
    return new Promise((resolve) => {
      const args = ['-v'];
      if (options.pattern) {
        args.push('-k', options.pattern);
      }

      const pytest = spawn('python', ['-m', 'pytest', ...args], {
        cwd: directory,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pytest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pytest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pytest.on('close', (code) => {
        const output = stdout + stderr;
        const result = this.parsePytestOutput(output, code);
        resolve(result);
      });

      pytest.on('error', (error) => {
        resolve({
          framework: 'pytest',
          success: false,
          output: `Pytest execution failed: ${error.message}`,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errorDetails: [error.message]
        });
      });
    });
  }

  /**
   * Run Google Test tests
   */
  private async runGoogleTestTests(directory: string, options: TestOptions): Promise<TestResult> {
    // TODO: Implement Google Test execution
    return {
      framework: 'gtest',
      success: true,
      output: 'Google Test execution not yet implemented',
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
  }

  /**
   * Run Catch2 tests
   */
  private async runCatch2Tests(directory: string, options: TestOptions): Promise<TestResult> {
    // TODO: Implement Catch2 execution
    return {
      framework: 'catch2',
      success: true,
      output: 'Catch2 execution not yet implemented',
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
  }

  /**
   * Run generic tests
   */
  private async runGenericTests(directory: string, options: TestOptions): Promise<TestResult> {
    return {
      framework: 'generic',
      success: true,
      output: 'No specific test framework detected. Manual test execution required.',
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
  }

  // Output parsing methods (simplified implementations)
  private parseJestOutput(output: string, code: number | null): TestResult {
    // Simple parsing - in a real implementation, you'd parse JSON output
    const passed = (output.match(/✓/g) || []).length;
    const failed = (output.match(/✕/g) || []).length;

    return {
      framework: 'jest',
      success: code === 0,
      output,
      passed,
      failed,
      skipped: 0,
      duration: 0
    };
  }

  private parseVitestOutput(output: string, code: number | null): TestResult {
    // Similar to Jest parsing
    const passed = (output.match(/✓/g) || []).length;
    const failed = (output.match(/✕/g) || []).length;

    return {
      framework: 'vitest',
      success: code === 0,
      output,
      passed,
      failed,
      skipped: 0,
      duration: 0
    };
  }

  private parsePytestOutput(output: string, code: number | null): TestResult {
    // Parse pytest output
    const passed = (output.match(/PASSED/g) || []).length;
    const failed = (output.match(/FAILED/g) || []).length;
    const skipped = (output.match(/SKIPPED/g) || []).length;

    return {
      framework: 'pytest',
      success: code === 0,
      output,
      passed,
      failed,
      skipped,
      duration: 0
    };
  }
}