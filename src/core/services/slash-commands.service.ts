import { IPromptRepository } from '../ports/prompt-repository.interface';

interface SlashCommand {
  command: string;
  promptId: string;
  description: string;
  category: string;
  accessLevel: 'public' | 'premium' | 'private';
}

interface UserContext {
  userId?: string;
  subscriptionTier?: 'free' | 'premium';
  email?: string;
}

export class SlashCommandsService {
  private commands: Map<string, SlashCommand> = new Map();

  constructor(private promptRepository: IPromptRepository) {
    this.initializeDefaultCommands();
  }

  private async initializeDefaultCommands() {
    // Load default slash commands from repository
    try {
      const prompts = await this.promptRepository.findLatestVersions(100);

      for (const prompt of prompts) {
        const promptData = prompt as any;
        if (promptData.tags && promptData.tags.length > 0) {
          // Create slash commands from prompt tags
          for (const tag of promptData.tags) {
            const command = `/${tag.replace(/\s+/g, '-').toLowerCase()}`;
            if (!this.commands.has(command)) {
              this.commands.set(command, {
                command,
                promptId: prompt.id,
                description: prompt.name,
                category: promptData.category || 'general',
                accessLevel: promptData.access_level || 'public'
              });
            }
          }

          // Also create command from prompt name
          const nameCommand = `/${prompt.name.replace(/\s+/g, '-').toLowerCase()}`;
          if (!this.commands.has(nameCommand)) {
            this.commands.set(nameCommand, {
              command: nameCommand,
              promptId: prompt.id,
              description: prompt.name,
              category: promptData.category || 'general',
              accessLevel: promptData.access_level || 'public'
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize slash commands:', error);
    }
  }

  async getAvailableCommands(userContext?: UserContext): Promise<SlashCommand[]> {
    const commands = Array.from(this.commands.values());

    // Filter based on user access
    return commands.filter(cmd => this.hasAccessToCommand(cmd, userContext));
  }

  private hasAccessToCommand(command: SlashCommand, userContext?: UserContext): boolean {
    if (!userContext) {
      return command.accessLevel === 'public';
    }

    switch (command.accessLevel) {
      case 'public':
        return true;
      case 'premium':
        return userContext.subscriptionTier === 'premium';
      case 'private':
        return false; // Private commands are not accessible via slash commands
      default:
        return false;
    }
  }

  async executeCommand(command: string, variables: Record<string, any> = {}, userContext?: UserContext): Promise<any> {
    const cmd = this.commands.get(command);
    if (!cmd) {
      throw new Error(`Unknown slash command: ${command}`);
    }

    // Check access
    if (!this.hasAccessToCommand(cmd, userContext)) {
      throw new Error(`Access denied to command: ${command}`);
    }

    // Get the prompt
    const prompt = await this.promptRepository.findById(cmd.promptId);
    if (!prompt) {
      throw new Error(`Prompt not found for command: ${command}`);
    }

    // Apply variables to the prompt template
    let template = (prompt as any).template || prompt.description;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      template = template.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return {
      command: cmd.command,
      promptId: cmd.promptId,
      result: template,
      appliedVariables: variables,
      category: cmd.category
    };
  }

  async getCommandSuggestions(query: string, userContext?: UserContext): Promise<SlashCommand[]> {
    const availableCommands = await this.getAvailableCommands(userContext);

    if (!query || query.length < 2) {
      return availableCommands.slice(0, 10); // Return top 10 commands
    }

    const lowerQuery = query.toLowerCase();
    const matches = availableCommands.filter(cmd =>
      cmd.command.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    );

    return matches.slice(0, 10);
  }

  async registerCustomCommand(command: string, promptId: string, userId: string): Promise<void> {
    // Allow premium users to register custom slash commands
    const prompt = await this.promptRepository.findById(promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const promptData = prompt as any;
    if (promptData.author_id !== userId) {
      throw new Error('Only the prompt author can register custom commands');
    }

    this.commands.set(command, {
      command,
      promptId,
      description: prompt.name,
      category: promptData.category || 'custom',
      accessLevel: promptData.access_level || 'private'
    });
  }

  async getCommandsByCategory(category: string, userContext?: UserContext): Promise<SlashCommand[]> {
    const availableCommands = await this.getAvailableCommands(userContext);
    return availableCommands.filter(cmd => cmd.category === category);
  }

  async getPopularCommands(userContext?: UserContext, limit: number = 10): Promise<SlashCommand[]> {
    // In a real implementation, this would track usage statistics
    // For now, return the first N available commands
    const availableCommands = await this.getAvailableCommands(userContext);
    return availableCommands.slice(0, limit);
  }
}