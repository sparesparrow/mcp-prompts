import { spawn } from 'child_process';
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

export interface DockerExecutionResult {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
}

export interface DockerExecutionOptions {
  image: string;
  command: string;
  volumes?: string[];
  workingDir?: string;
  environment?: Record<string, string>;
  timeout?: number;
}

export class DockerExecutionService {
  private defaultTimeout = 300000; // 5 minutes

  async executeInContainer(options: DockerExecutionOptions): Promise<DockerExecutionResult> {
    const startTime = Date.now();

    logger.info('Executing command in Docker container', {
      image: options.image,
      command: options.command
    });

    return new Promise((resolve) => {
      const args = ['run', '--rm'];

      // Add environment variables
      if (options.environment) {
        for (const [key, value] of Object.entries(options.environment)) {
          args.push('-e', `${key}=${value}`);
        }
      }

      // Add volume mounts
      if (options.volumes) {
        for (const volume of options.volumes) {
          args.push('-v', volume);
        }
      }

      // Add working directory
      if (options.workingDir) {
        args.push('-w', options.workingDir);
      }

      // Add image and command
      args.push(options.image);
      args.push(...options.command.split(' '));

      const docker = spawn('docker', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      docker.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      docker.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      docker.on('close', (code) => {
        const duration = Date.now() - startTime;
        const success = code === 0;
        const output = stdout + stderr;

        logger.info(`Docker execution completed`, {
          success,
          exitCode: code,
          duration
        });

        resolve({
          success,
          output,
          exitCode: code || 0,
          duration
        });
      });

      docker.on('error', (error) => {
        const duration = Date.now() - startTime;

        logger.error('Docker execution failed:', error);

        resolve({
          success: false,
          output: `Docker execution failed: ${error.message}`,
          exitCode: 1,
          duration
        });
      });

      // Timeout
      setTimeout(() => {
        docker.kill();
        const duration = Date.now() - startTime;

        logger.warn('Docker execution timed out');

        resolve({
          success: false,
          output: 'Docker execution timed out',
          exitCode: 1,
          duration
        });
      }, options.timeout || this.defaultTimeout);
    });
  }

  async checkDockerAvailability(): Promise<boolean> {
    try {
      const result = await this.executeInContainer({
        image: 'hello-world',
        command: 'echo "Docker is available"',
        timeout: 10000
      });
      return result.success;
    } catch {
      return false;
    }
  }

  async pullImage(image: string): Promise<boolean> {
    return new Promise((resolve) => {
      const docker = spawn('docker', ['pull', image], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      docker.on('close', (code) => {
        resolve(code === 0);
      });

      docker.on('error', () => {
        resolve(false);
      });
    });
  }
}