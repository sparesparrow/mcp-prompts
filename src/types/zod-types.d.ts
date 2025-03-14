import { z } from 'zod';

declare module 'zod' {
  interface ZodType<Output, Def, Input> {
    default<T>(value: T): ZodDefault<this>;
  }

  interface ZodObject<T extends z.ZodRawShape, UnknownKeys extends z.UnknownKeysParam = z.UnknownKeysParam, Catchall extends z.ZodTypeAny = z.ZodTypeAny, Output = z.objectOutputType<T, Catchall, UnknownKeys>, Input = z.objectInputType<T, Catchall, UnknownKeys>> extends z.ZodTypeAny {
    // Define index signature
    [key: string]: any;
  }
} 