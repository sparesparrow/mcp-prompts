import { Prompt, ListPromptsOptions } from '../entities';
import { IPromptRepository } from '../ports/IPromptRepository';

/**
 * Use-case: searchPrompts
 * Search prompts by text query with filtering options
 */
export async function searchPrompts(
  repo: IPromptRepository, 
  query: string, 
  options?: ListPromptsOptions
): Promise<Prompt[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  // Get all prompts first (in a real implementation, this would use a search index)
  const allPrompts = await repo.listPrompts(options || {}, true);
  
  // Simple text search implementation
  // In production, this should use a proper search engine like Elasticsearch
  const searchResults = allPrompts.filter(prompt => {
    const searchableText = [
      prompt.name,
      prompt.description,
      prompt.content,
      prompt.category,
      ...(prompt.tags || [])
    ].join(' ').toLowerCase();
    
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    return searchTerms.every(term => searchableText.includes(term));
  });

  // Sort by relevance (simple implementation)
  searchResults.sort((a, b) => {
    const aScore = calculateRelevanceScore(a, query);
    const bScore = calculateRelevanceScore(b, query);
    return bScore - aScore;
  });

  return searchResults;
}

/**
 * Calculate relevance score for a prompt based on search query
 */
function calculateRelevanceScore(prompt: Prompt, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  
  // Exact matches get highest score
  if (prompt.name.toLowerCase() === queryLower) score += 100;
  if (prompt.description?.toLowerCase().includes(queryLower)) score += 50;
  if (prompt.content.toLowerCase().includes(queryLower)) score += 30;
  if (prompt.category?.toLowerCase().includes(queryLower)) score += 40;
  
  // Tag matches
  if (prompt.tags) {
    for (const tag of prompt.tags) {
      if (tag.toLowerCase().includes(queryLower)) score += 20;
    }
  }
  
  // Partial matches
  const queryWords = queryLower.split(/\s+/);
  for (const word of queryWords) {
    if (prompt.name.toLowerCase().includes(word)) score += 10;
    if (prompt.description?.toLowerCase().includes(word)) score += 5;
    if (prompt.content.toLowerCase().includes(word)) score += 3;
  }
  
  return score;
}
