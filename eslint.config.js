import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sortKeysFix from 'eslint-plugin-sort-keys-fix';
import typescript from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import jsdocConfig from 'eslint-plugin-jsdoc/configs/recommended.js';
import typescriptConfig from '@typescript-eslint/eslint-plugin/dist/configs/recommended.js';
import eslintRecommended from 'eslint/conf/eslint-recommended.js';
import prettierConfig from 'eslint-config-prettier';

export default [
  eslintRecommended,
  typescriptConfig,
  jsdocConfig,
  prettierConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,
      'simple-import-sort': simpleImportSort,
      'sort-keys-fix': sortKeysFix,
      jsdoc,
    },
    rules: {
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'sort-keys-fix/sort-keys-fix': 'warn',
      'import/prefer-default-export': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase'] },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit' }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'object-curly-newline': 'off',
    },
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
    },
  },
]; 