import { spawn } from 'child_process';
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

export interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: string[];
}

export interface GitAnalysisResult {
  commits: GitCommit[];
  fileChanges: Record<string, number>;
  authorStats: Record<string, number>;
  timeRange: { start: Date; end: Date };
}

export class GitAnalysisService {
  async analyzeHistory(options: {
    file?: string;
    author?: string;
    since?: string;
    until?: string;
    limit?: number;
  } = {}): Promise<GitAnalysisResult> {
    logger.info('Analyzing git history', options);

    const commits = await this.getCommits(options);
    const fileChanges = await this.getFileChangeStats(options);
    const authorStats = this.calculateAuthorStats(commits);

    const timeRange = {
      start: commits.length > 0 ? commits[commits.length - 1].date : new Date(),
      end: commits.length > 0 ? commits[0].date : new Date()
    };

    return {
      commits,
      fileChanges,
      authorStats,
      timeRange
    };
  }

  private async getCommits(options: any): Promise<GitCommit[]> {
    return new Promise((resolve, reject) => {
      const args = ['log', '--pretty=format:%H|%an|%ad|%s', '--date=iso'];

      if (options.since) args.push(`--since=${options.since}`);
      if (options.until) args.push(`--until=${options.until}`);
      if (options.author) args.push(`--author=${options.author}`);
      if (options.limit) args.push(`-n${options.limit}`);
      if (options.file) args.push('--', options.file);

      const git = spawn('git', args, {
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
          const commits = this.parseGitLogOutput(stdout);
          resolve(commits);
        } else {
          reject(new Error(`Git log failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async getFileChangeStats(options: any): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      const args = ['log', '--pretty=format:', '--numstat'];

      if (options.since) args.push(`--since=${options.since}`);
      if (options.until) args.push(`--until=${options.until}`);
      if (options.author) args.push(`--author=${options.author}`);
      if (options.file) args.push('--', options.file);

      const git = spawn('git', args, {
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
          const stats = this.parseNumstatOutput(stdout);
          resolve(stats);
        } else {
          reject(new Error(`Git numstat failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseGitLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;

      const [hash, author, dateStr, ...messageParts] = line.split('|');
      const message = messageParts.join('|');

      commits.push({
        hash,
        author,
        date: new Date(dateStr),
        message,
        files: [] // Would need separate git show command to get files
      });
    }

    return commits;
  }

  private parseNumstatOutput(output: string): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;

      const parts = line.split('\t');
      if (parts.length >= 3) {
        const [added, deleted, file] = parts;
        const changes = (parseInt(added) || 0) + (parseInt(deleted) || 0);
        stats[file] = (stats[file] || 0) + changes;
      }
    }

    return stats;
  }

  private calculateAuthorStats(commits: GitCommit[]): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const commit of commits) {
      stats[commit.author] = (stats[commit.author] || 0) + 1;
    }

    return stats;
  }
}