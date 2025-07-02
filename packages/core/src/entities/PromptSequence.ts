export interface PromptSequence {
  id: string;
  name: string;
  description?: string;
  promptIds: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}
