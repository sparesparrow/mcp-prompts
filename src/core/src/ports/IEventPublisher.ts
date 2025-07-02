// Secondary port: IEventPublisher
export interface IEventPublisher {
  publish(event: string, payload: unknown): void;
}
