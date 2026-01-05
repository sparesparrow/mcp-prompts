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

export interface Session {
  id: string;
  type: 'debug' | 'analysis' | 'workflow';
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed';
  context: Record<string, any>;
  steps: SessionStep[];
  metadata: Record<string, any>;
}

export interface SessionStep {
  id: string;
  timestamp: Date;
  action: string;
  tool?: string;
  args?: Record<string, any>;
  result?: any;
  success?: boolean;
  duration?: number;
}

export class SessionManagerService {
  private sessions: Map<string, Session> = new Map();
  private activeSessions: Set<string> = new Set();
  private maxSessions = 100;
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Create a new session
   */
  createSession(type: Session['type'], context: Record<string, any> = {}): string {
    const sessionId = this.generateSessionId();

    const session: Session = {
      id: sessionId,
      type,
      startTime: new Date(),
      status: 'active',
      context,
      steps: [],
      metadata: {}
    };

    this.sessions.set(sessionId, session);
    this.activeSessions.add(sessionId);

    // Clean up old sessions periodically
    this.cleanupOldSessions();

    logger.info(`Created ${type} session: ${sessionId}`);
    return sessionId;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Add a step to a session
   */
  addStep(sessionId: string, step: Omit<SessionStep, 'id' | 'timestamp'>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to add step to non-existent session: ${sessionId}`);
      return;
    }

    const fullStep: SessionStep = {
      id: this.generateStepId(),
      timestamp: new Date(),
      ...step
    };

    session.steps.push(fullStep);
    logger.debug(`Added step to session ${sessionId}: ${step.action}`);
  }

  /**
   * Update session metadata
   */
  updateSessionMetadata(sessionId: string, metadata: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to update metadata for non-existent session: ${sessionId}`);
      return;
    }

    session.metadata = { ...session.metadata, ...metadata };
  }

  /**
   * End a session
   */
  endSession(sessionId: string, status: 'completed' | 'failed' = 'completed'): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to end non-existent session: ${sessionId}`);
      return;
    }

    session.endTime = new Date();
    session.status = status;
    this.activeSessions.delete(sessionId);

    const duration = session.endTime.getTime() - session.startTime.getTime();
    logger.info(`Ended ${status} session ${sessionId} (duration: ${duration}ms, steps: ${session.steps.length})`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.activeSessions)
      .map(id => this.sessions.get(id))
      .filter(Boolean) as Session[];
  }

  /**
   * Get sessions by type
   */
  getSessionsByType(type: Session['type']): Session[] {
    return Array.from(this.sessions.values())
      .filter(session => session.type === type);
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  } {
    const allSessions = Array.from(this.sessions.values());
    const byType: Record<string, number> = {};

    for (const session of allSessions) {
      byType[session.type] = (byType[session.type] || 0) + 1;
    }

    return {
      total: allSessions.length,
      active: this.activeSessions.size,
      completed: allSessions.filter(s => s.status === 'completed').length,
      failed: allSessions.filter(s => s.status === 'failed').length,
      byType
    };
  }

  /**
   * Find similar sessions based on context
   */
  findSimilarSessions(context: Record<string, any>, limit: number = 5): Session[] {
    const allSessions = Array.from(this.sessions.values());

    // Simple similarity scoring based on context keys
    const scoredSessions = allSessions.map(session => {
      let score = 0;
      const contextKeys = Object.keys(context);

      for (const key of contextKeys) {
        if (session.context[key] !== undefined) {
          if (session.context[key] === context[key]) {
            score += 2; // Exact match
          } else if (typeof session.context[key] === 'string' &&
                     typeof context[key] === 'string' &&
                     session.context[key].toLowerCase().includes(context[key].toLowerCase())) {
            score += 1; // Partial string match
          }
        }
      }

      return { session, score };
    });

    // Sort by score and return top matches
    return scoredSessions
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.session);
  }

  /**
   * Export session data for analysis
   */
  exportSessionData(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      ...session,
      duration: session.endTime
        ? session.endTime.getTime() - session.startTime.getTime()
        : Date.now() - session.startTime.getTime(),
      stepCount: session.steps.length,
      successfulSteps: session.steps.filter(s => s.success === true).length,
      failedSteps: session.steps.filter(s => s.success === false).length
    };
  }

  /**
   * Clean up old completed sessions
   */
  private cleanupOldSessions(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, session] of this.sessions) {
      if (session.status !== 'active' &&
          session.endTime &&
          (now - session.endTime.getTime()) > this.sessionTimeout) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.sessions.delete(id);
    }

    if (toDelete.length > 0) {
      logger.info(`Cleaned up ${toDelete.length} old sessions`);
    }

    // Also limit total sessions
    if (this.sessions.size > this.maxSessions) {
      const sessionsToDelete = Array.from(this.sessions.keys()).slice(0, this.sessions.size - this.maxSessions);
      for (const id of sessionsToDelete) {
        this.sessions.delete(id);
      }
      logger.info(`Cleaned up ${sessionsToDelete.length} sessions (size limit)`);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique step ID
   */
  private generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a debug session with initial breakpoints
   */
  createDebugSession(executable: string, args: string[] = [], breakpoints: string[] = []): string {
    const sessionId = this.createSession('debug', {
      executable,
      args,
      breakpoints
    });

    // Add initial step
    this.addStep(sessionId, {
      action: 'debug_session_started',
      tool: 'gdb',
      args: { executable, args, breakpoints }
    });

    return sessionId;
  }

  /**
   * Create an analysis session
   */
  createAnalysisSession(files: string[], tools: string[] = []): string {
    const sessionId = this.createSession('analysis', {
      files,
      tools
    });

    this.addStep(sessionId, {
      action: 'analysis_session_started',
      args: { files, tools }
    });

    return sessionId;
  }

  /**
   * Create a workflow session
   */
  createWorkflowSession(workflowName: string, parameters: Record<string, any> = {}): string {
    const sessionId = this.createSession('workflow', {
      workflowName,
      parameters
    });

    this.addStep(sessionId, {
      action: 'workflow_session_started',
      args: { workflowName, parameters }
    });

    return sessionId;
  }
}