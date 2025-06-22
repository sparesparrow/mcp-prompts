import { z } from 'zod';

// Define some example prompts
export const defaultPrompts = {
  'bug-report': {
    category: 'development',
    content:
      'Issue Type: Bug\n\nDescription:\n{{description}}\n\nSteps to Reproduce:\n{{steps}}\n\nExpected Behavior:\n{{expected}}\n\nActual Behavior:\n{{actual}}\n\nEnvironment:\n{{environment}}',
    description: 'Generate a detailed bug report',
    isTemplate: true,
    name: 'bug-report',
    tags: ['development', 'issues'],
    variables: ['description', 'steps', 'expected', 'actual', 'environment'],
  },
  'code-review': {
    category: 'development',
    content:
      'Please review the following code changes:\n\n{{code}}\n\nProvide feedback on:\n1. Code quality\n2. Potential bugs\n3. Performance considerations\n4. Security implications\n5. Suggested improvements',
    description: 'Review code changes and provide feedback',
    isTemplate: true,
    name: 'code-review',
    tags: ['development', 'review'],
    variables: ['code'],
  },
};
