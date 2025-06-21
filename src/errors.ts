/**
 * Base class for all custom application errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Represents a validation error (HTTP 400).
 */
export class ValidationError extends AppError {
  public readonly details?: any[];

  public constructor(message: string, details?: any[]) {
    super(message, 400);
    this.details = details;
  }
}

/**
 * Represents a "not found" error (HTTP 404).
 */
export class NotFoundError extends AppError {
  public constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Represents an authentication error (HTTP 401).
 */
export class UnauthorizedError extends AppError {
  public constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

/**
 * Represents a permission/authorization error (HTTP 403).
 */
export class ForbiddenError extends AppError {
  public constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
  }
} 