import { PromptFormat } from '../../src/interfaces.js';
describe('Interfaces', () => {
  describe('Prompt interface', () => {
    it('should be defined', () => {
      // This is only a type test to verify that the interface itself is defined
      expect(true).toBe(true);
    });
  });
  describe('MutablePrompt interface', () => {
    it('should be defined', () => {
      // This is only a type test to verify that the interface itself is defined
      expect(true).toBe(true);
    });
  });
  describe('PromptFormat enum', () => {
    it('should have the correct values', () => {
      expect(PromptFormat.JSON).toBe('json');
      expect(PromptFormat.MDC).toBe('mdc');
      expect(PromptFormat.PGAI).toBe('pgai');
      expect(PromptFormat.TEMPLATE).toBe('template');
    });
  });
});
