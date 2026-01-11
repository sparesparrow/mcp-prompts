export interface PromptEvent {
  type: 'prompt_created' | 'prompt_updated' | 'prompt_deleted' | 'prompt_accessed' | 'subagents_listed' | 'subagent_accessed' | 'subagent_executed' | 'main_agents_listed' | 'main_agent_accessed' | 'project_detected' | 'orchestration_started' | 'orchestration_completed' | 'orchestration_failed' | 'phase_executed' | 'synthesis_complete' | 'project_scaffolded' | 'report_generated';
  promptId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IEventBus {
  publish(event: PromptEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: PromptEvent) => Promise<void>): void;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;
}