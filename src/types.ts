// Local type definitions for workspace dependencies
// These should be replaced with proper imports when workspace resolution is fixed

export enum PromptLayer {
  Unknown = 0,
  Perceptual = 1,
  Episodic = 2,
  Semantic = 3,
  Procedural = 4,
  MetaCognitive = 5,
  Transfer = 6,
  Evaluative = 7
}

export enum Domain {
  General = 0,
  SoftwareDevelopment = 1,
  MedicalAnalysis = 2,
  FinancialModeling = 3,
  CreativeProduction = 4,
  Infrastructure = 5,
  DataScience = 6,
  Security = 7
}

export interface McpPromptsClient {
  searchPrompts(query: any): Promise<any>;
  getPrompt(name: string, args?: any): Promise<any>;
  createPrompt(prompt: any): Promise<any>;
}

export class SimpleMcpPromptsClient implements McpPromptsClient {
  async searchPrompts(query: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async createPrompt(prompt: any): Promise<any> {
    throw new Error('Not implemented');
  }
}