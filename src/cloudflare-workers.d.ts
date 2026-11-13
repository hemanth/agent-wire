declare module 'cloudflare:workers' {
  export class DurableObject<Env = unknown> {
    protected ctx: {
      id: { toString(): string };
      storage: {
        get<T = unknown>(key: string): Promise<T | undefined>;
        put(key: string, value: unknown): Promise<void>;
        delete(key: string): Promise<boolean>;
        deleteAll(): Promise<void>;
        blockConcurrencyWhile?<T>(fn: () => Promise<T>): Promise<T>;
      };
      blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
    };
    protected env: Env;
    constructor(ctx: unknown, env: Env);
    fetch?(request: Request): Promise<Response> | Response;
  }
}
