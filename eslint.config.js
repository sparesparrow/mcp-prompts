import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
      },
      globals: { ...globals.node }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      // TypeScript checks undefined names itself, and the TS-aware no-unused-vars below
      // replaces the core rule, which misreads type-only declarations.
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/naming-convention": [
        "warn",
        { "selector": "default", "format": ["camelCase"] },
        { "selector": "variable", "format": ["camelCase", "UPPER_CASE", "PascalCase"] },
        { "selector": "parameter", "format": ["camelCase"], "leadingUnderscore": "allow" },
        { "selector": "memberLike", "modifiers": ["private"], "format": ["camelCase"], "leadingUnderscore": "allow" },
        { "selector": "typeLike", "format": ["PascalCase"] },
        { "selector": "enum", "format": ["PascalCase"] },
        { "selector": "enumMember", "format": ["PascalCase"] }
      ],
      // Most classes predate this rule; keep it visible without failing CI.
      "@typescript-eslint/explicit-member-accessibility": ["warn", { "accessibility": "explicit" }],
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
]; 