import type { Prompt } from '../entities/Prompt';
import type { User } from '../entities/User';

export interface ISecurityValidator {
  canEditPrompt(user: User, prompt: Prompt): Promise<boolean>;
  canDeletePrompt(user: User, prompt: Prompt): Promise<boolean>;
  canViewPrompt(user: User, prompt: Prompt): Promise<boolean>;
}
