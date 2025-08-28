import { IPromptRepository } from '../ports/IPromptRepository';

/**
 * Use-case: getPromptStats
 * Get comprehensive statistics about prompts in the system
 */
export async function getPromptStats(repo: IPromptRepository): Promise<{
  total: number;
  templates: number;
  categories: Record<string, number>;
  tags: Record<string, number>;
  versions: number;
  recentActivity: {
    lastCreated: string | null;
    lastUpdated: string | null;
  };
}> {
  try {
    // Get all prompts with versions
    const allPrompts = await repo.listPrompts({}, true);
    
    // Calculate basic counts
    const total = allPrompts.length;
    const templates = allPrompts.filter(p => p.isTemplate).length;
    
    // Calculate category distribution
    const categories: Record<string, number> = {};
    allPrompts.forEach(prompt => {
      if (prompt.category) {
        categories[prompt.category] = (categories[prompt.category] || 0) + 1;
      }
    });
    
    // Calculate tag distribution
    const tags: Record<string, number> = {};
    allPrompts.forEach(prompt => {
      if (prompt.tags) {
        prompt.tags.forEach(tag => {
          tags[tag] = (tags[tag] || 0) + 1;
        });
      }
    });
    
    // Calculate total versions
    const versions = allPrompts.reduce((sum, prompt) => sum + prompt.version, 0);
    
    // Find recent activity
    const sortedByCreated = [...allPrompts].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const sortedByUpdated = [...allPrompts].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    const lastCreated = sortedByCreated.length > 0 ? sortedByCreated[0].createdAt : null;
    const lastUpdated = sortedByUpdated.length > 0 ? sortedByUpdated[0].updatedAt : null;
    
    return {
      total,
      templates,
      categories,
      tags,
      versions,
      recentActivity: {
        lastCreated,
        lastUpdated
      }
    };
  } catch (error) {
    console.error('Failed to get prompt stats:', error);
    throw new Error('Failed to retrieve prompt statistics');
  }
}

/**
 * Get detailed statistics for a specific category
 */
export async function getCategoryStats(
  repo: IPromptRepository, 
  category: string
): Promise<{
  category: string;
  count: number;
  templates: number;
  averageVersions: number;
  mostUsedTags: Array<{ tag: string; count: number }>;
}> {
  try {
    const categoryPrompts = await repo.listPrompts({ category }, true);
    
    if (categoryPrompts.length === 0) {
      return {
        category,
        count: 0,
        templates: 0,
        averageVersions: 0,
        mostUsedTags: []
      };
    }
    
    const count = categoryPrompts.length;
    const templates = categoryPrompts.filter(p => p.isTemplate).length;
    const averageVersions = categoryPrompts.reduce((sum, p) => sum + p.version, 0) / count;
    
    // Calculate tag usage
    const tagCounts: Record<string, number> = {};
    categoryPrompts.forEach(prompt => {
      if (prompt.tags) {
        prompt.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    const mostUsedTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      category,
      count,
      templates,
      averageVersions: Math.round(averageVersions * 100) / 100,
      mostUsedTags
    };
  } catch (error) {
    console.error(`Failed to get stats for category ${category}:`, error);
    throw new Error(`Failed to retrieve statistics for category: ${category}`);
  }
}
