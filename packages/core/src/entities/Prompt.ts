export interface Prompt {
  id: string; // UUID v7
  name: string;
  template: Template;
  category: Category;
  tags: string[];
  createdBy: User;
  createdAt: Date;
  updatedAt: Date;
}

import type { Template } from './Template';
import type { Category } from './Category';
import type { User } from './User';
