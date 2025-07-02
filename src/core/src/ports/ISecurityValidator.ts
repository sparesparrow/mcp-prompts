// Secondary port: ISecurityValidator
export interface ISecurityValidator {
  validate(input: unknown): boolean;
}
