// Secondary port: ITemplatingEngine
export interface ITemplatingEngine {
  render(template: string, variables: Record<string, string>): string;
}
