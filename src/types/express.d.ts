/**
 * Type declarations to improve Express compatibility
 * This file extends Express types to work better with our codebase.
 */

import * as express from 'express';

declare global {
  namespace Express {
    // You can extend interfaces here if needed
  }
}

// Re-export Express types for convenience
export type Request = express.Request;
export type Response = express.Response;
export type NextFunction = express.NextFunction;
export type RequestHandler = express.RequestHandler;
export type ErrorRequestHandler = express.ErrorRequestHandler; 