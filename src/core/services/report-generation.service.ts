#!/usr/bin/env node
/**
 * Report Generation Service
 *
 * Generates analysis reports in multiple formats:
 * - JSON
 * - Markdown
 * - HTML
 */

import { IEventBus } from '../ports/event-bus.interface';
import { PromptEvent } from '../events/prompt.event';
import { AnalysisReport, Recommendation, PhaseResult } from './orchestrate.service';

/**
 * Generated report in multiple formats
 */
export interface GeneratedReport {
  json: AnalysisReport;
  markdown: string;
  html: string;
}

/**
 * Report Generation Service
 */
export class ReportGenerationService {
  constructor(private eventBus: IEventBus) {}

  /**
   * Generate complete analysis report in multiple formats
   */
  async generateAnalysisReport(report: AnalysisReport): Promise<GeneratedReport> {
    try {
      const markdown = this.generateMarkdownReport(report);
      const html = this.generateHtmlReport(report);

      await this.eventBus.publish(new PromptEvent('report_generated', report.executionId, new Date(), {
        formats: ['json', 'markdown', 'html'],
        projectType: report.projectType,
        mode: report.mode
      }));

      return {
        json: report,
        markdown,
        html
      };
    } catch (error) {
      throw new Error(`Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(report: AnalysisReport): string {
    const duration = report.endTime
      ? Math.round((report.endTime.getTime() - report.startTime.getTime()) / 1000)
      : 0;

    let markdown = '';

    // Header
    markdown += `# Analysis Report\n\n`;
    markdown += `**Project**: ${report.projectPath}\n`;
    markdown += `**Type**: ${report.projectType}\n`;
    markdown += `**Mode**: ${report.mode}\n`;
    markdown += `**Status**: ${report.status}\n`;
    markdown += `**Duration**: ${duration}s\n\n`;

    // Summary
    if (report.synthesis?.summary) {
      markdown += `## Summary\n\n`;
      markdown += `${report.synthesis.summary}\n\n`;
    }

    // Phase Results
    if (report.phaseResults.length > 0) {
      markdown += `## Analysis Phases\n\n`;

      for (const phase of report.phaseResults) {
        markdown += `### ${this.capitalizePhase(phase.phaseName)}: ${this.capitalizeSubagent(phase.subagent)}\n\n`;
        markdown += `**Summary**: ${phase.summary}\n`;
        markdown += `**Confidence**: ${(phase.confidence * 100).toFixed(0)}%\n\n`;

        if (Object.keys(phase.findings).length > 0) {
          markdown += `**Findings**:\n`;
          for (const [key, value] of Object.entries(phase.findings)) {
            if (key !== 'timestamp' && key !== 'mode' && key !== 'projectPath') {
              markdown += `- ${this.humanize(key)}: ${this.formatValue(value)}\n`;
            }
          }
          markdown += `\n`;
        }
      }
    }

    // Recommendations
    if (report.synthesis?.recommendations && report.synthesis.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;

      // Group by priority
      const byPriority: Record<string, Recommendation[]> = {
        high: [],
        medium: [],
        low: []
      };

      for (const rec of report.synthesis.recommendations) {
        byPriority[rec.priority].push(rec);
      }

      for (const priority of ['high', 'medium', 'low'] as const) {
        if (byPriority[priority].length > 0) {
          markdown += `### ${priority.toUpperCase()} Priority\n\n`;

          for (const rec of byPriority[priority]) {
            markdown += `#### ${rec.category}: ${rec.description}\n\n`;
            markdown += `**Action Items**:\n`;
            for (const item of rec.actionItems) {
              markdown += `- ${item}\n`;
            }
            markdown += `\n`;
          }
        }
      }
    }

    // Metrics
    if (report.synthesis?.metrics) {
      markdown += `## Metrics\n\n`;
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;

      for (const [key, value] of Object.entries(report.synthesis.metrics)) {
        markdown += `| ${this.humanize(key)} | ${this.formatValue(value)} |\n`;
      }
      markdown += `\n`;
    }

    // Error info
    if (report.error) {
      markdown += `## Error\n\n`;
      markdown += `\`\`\`\n${report.error}\n\`\`\`\n\n`;
    }

    // Metadata
    markdown += `---\n\n`;
    markdown += `**Execution ID**: \`${report.executionId}\`\n`;
    markdown += `**Started**: ${report.startTime.toISOString()}\n`;
    if (report.endTime) {
      markdown += `**Ended**: ${report.endTime.toISOString()}\n`;
    }

    return markdown;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: AnalysisReport): string {
    const duration = report.endTime
      ? Math.round((report.endTime.getTime() - report.startTime.getTime()) / 1000)
      : 0;

    let html = '';

    html += `<!DOCTYPE html>\n<html>\n<head>\n`;
    html += `  <meta charset="UTF-8">\n`;
    html += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
    html += `  <title>Analysis Report - ${report.projectPath}</title>\n`;
    html += `  <style>\n`;
    html += `    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; line-height: 1.6; }\n`;
    html += `    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }\n`;
    html += `    .metadata { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }\n`;
    html += `    .metadata-item { background: #f5f5f5; padding: 15px; border-radius: 5px; }\n`;
    html += `    .metadata-label { font-weight: bold; color: #666; }\n`;
    html += `    h2 { border-left: 4px solid #0066cc; padding-left: 15px; margin-top: 40px; }\n`;
    html += `    h3 { color: #333; }\n`;
    html += `    .phase-result { background: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 15px; }\n`;
    html += `    .recommendation { background: #fff; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px; }\n`;
    html += `    .high { border-left-color: #dc3545; }\n`;
    html += `    .medium { border-left-color: #ffc107; }\n`;
    html += `    .low { border-left-color: #28a745; }\n`;
    html += `    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }\n`;
    html += `    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }\n`;
    html += `    th { background-color: #f5f5f5; font-weight: bold; }\n`;
    html += `    .confidence { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 3px; font-size: 0.9em; }\n`;
    html += `    .error { background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px; border-left: 4px solid #c62828; }\n`;
    html += `    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }\n`;
    html += `  </style>\n`;
    html += `</head>\n<body>\n`;

    // Header
    html += `<div class="header">\n`;
    html += `  <h1>Analysis Report</h1>\n`;
    html += `  <p>Comprehensive analysis results for ${report.projectPath}</p>\n`;
    html += `</div>\n`;

    // Metadata
    html += `<div class="metadata">\n`;
    html += `  <div class="metadata-item"><span class="metadata-label">Project Path</span><br>${this.escapeHtml(report.projectPath)}</div>\n`;
    html += `  <div class="metadata-item"><span class="metadata-label">Project Type</span><br>${report.projectType}</div>\n`;
    html += `  <div class="metadata-item"><span class="metadata-label">Mode</span><br>${report.mode}</div>\n`;
    html += `  <div class="metadata-item"><span class="metadata-label">Status</span><br><strong>${report.status}</strong></div>\n`;
    html += `</div>\n`;

    // Summary
    if (report.synthesis?.summary) {
      html += `<h2>Summary</h2>\n`;
      html += `<p>${this.escapeHtml(report.synthesis.summary)}</p>\n`;
    }

    // Phase Results
    if (report.phaseResults.length > 0) {
      html += `<h2>Analysis Phases</h2>\n`;

      for (const phase of report.phaseResults) {
        html += `<div class="phase-result">\n`;
        html += `  <h3>${this.capitalizePhase(phase.phaseName)}: ${this.capitalizeSubagent(phase.subagent)}</h3>\n`;
        html += `  <p>${this.escapeHtml(phase.summary)}</p>\n`;
        html += `  <p><span class="confidence">${(phase.confidence * 100).toFixed(0)}% Confidence</span></p>\n`;

        if (Object.keys(phase.findings).length > 0) {
          html += `  <h4>Findings</h4>\n`;
          html += `  <ul>\n`;
          for (const [key, value] of Object.entries(phase.findings)) {
            if (key !== 'timestamp' && key !== 'mode' && key !== 'projectPath') {
              html += `    <li><strong>${this.humanize(key)}</strong>: ${this.escapeHtml(this.formatValue(value))}</li>\n`;
            }
          }
          html += `  </ul>\n`;
        }
        html += `</div>\n`;
      }
    }

    // Recommendations
    if (report.synthesis?.recommendations && report.synthesis.recommendations.length > 0) {
      html += `<h2>Recommendations</h2>\n`;

      for (const rec of report.synthesis.recommendations) {
        html += `<div class="recommendation ${rec.priority}">\n`;
        html += `  <h3>${rec.category}</h3>\n`;
        html += `  <p>${this.escapeHtml(rec.description)}</p>\n`;
        html += `  <h4>Action Items</h4>\n`;
        html += `  <ul>\n`;
        for (const item of rec.actionItems) {
          html += `    <li>${this.escapeHtml(item)}</li>\n`;
        }
        html += `  </ul>\n`;
        html += `</div>\n`;
      }
    }

    // Metrics
    if (report.synthesis?.metrics) {
      html += `<h2>Metrics</h2>\n`;
      html += `<table>\n`;
      html += `  <tr><th>Metric</th><th>Value</th></tr>\n`;

      for (const [key, value] of Object.entries(report.synthesis.metrics)) {
        html += `  <tr><td>${this.humanize(key)}</td><td>${this.escapeHtml(this.formatValue(value))}</td></tr>\n`;
      }
      html += `</table>\n`;
    }

    // Error
    if (report.error) {
      html += `<h2>Error</h2>\n`;
      html += `<div class="error">\n`;
      html += `  <p>${this.escapeHtml(report.error)}</p>\n`;
      html += `</div>\n`;
    }

    // Footer
    html += `<footer>\n`;
    html += `  <p><strong>Execution ID</strong>: <code>${report.executionId}</code></p>\n`;
    html += `  <p><strong>Duration</strong>: ${duration}s</p>\n`;
    html += `  <p><strong>Started</strong>: ${report.startTime.toISOString()}</p>\n`;
    if (report.endTime) {
      html += `  <p><strong>Ended</strong>: ${report.endTime.toISOString()}</p>\n`;
    }
    html += `</footer>\n`;

    html += `</body>\n</html>\n`;

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
  }

  /**
   * Capitalize phase name
   */
  private capitalizePhase(phase: string): string {
    return phase.charAt(0).toUpperCase() + phase.slice(1);
  }

  /**
   * Capitalize subagent name
   */
  private capitalizeSubagent(subagent: string): string {
    return subagent
      .replace(/_/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Humanize key names (convert camelCase to Title Case)
   */
  private humanize(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ');
  }

  /**
   * Format value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
