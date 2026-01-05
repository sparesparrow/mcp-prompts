// Placeholder for protocol.fbs bindings

export interface Prompt {
  name: string;
  description?: string;
  content: any;
  arguments?: any[];
  messages?: any[];
  metadata?: any[];
}