export interface ICatalogRepository {
  syncFromGitHub(repoUrl: string): Promise<void>;
  getPromptTemplate(category: string, name: string): Promise<string>;
  getCatalogIndex(): Promise<any>;
  uploadPrompt(category: string, name: string, content: any): Promise<void>;
  deletePrompt(category: string, name: string): Promise<void>;
  listPrompts(category?: string): Promise<string[]>;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;
}
