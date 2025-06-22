/**
 * Standardized error codes for HTTP responses.
 */
export enum HttpErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DUPLICATE = 'DUPLICATE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  CONFLICT = 'CONFLICT',
  LOCKED = 'LOCKED',
}

/**
 * Base class for all custom application errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: HttpErrorCode;

  public constructor(message: string, statusCode: number, code: HttpErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
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
    super(message, 400, HttpErrorCode.VALIDATION_ERROR);
    this.details = details;
  }
}

/**
 * Represents a "not found" error (HTTP 404).
 */
export class NotFoundError extends AppError {
  public constructor(message = 'Resource not found') {
    super(message, 404, HttpErrorCode.NOT_FOUND);
  }
}

/**
 * Represents an authentication error (HTTP 401).
 */
export class UnauthorizedError extends AppError {
  public constructor(message = 'Authentication required') {
    super(message, 401, HttpErrorCode.UNAUTHORIZED);
  }
}

/**
 * Represents a permission/authorization error (HTTP 403).
 */
export class ForbiddenError extends AppError {
  public constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, HttpErrorCode.FORBIDDEN);
  }
}

/**
 * Represents a duplicate resource error (HTTP 409).
 */
export class DuplicateError extends AppError {
  public constructor(message: string) {
    super(message, 409, HttpErrorCode.CONFLICT);
  }
}

/**
 * Represents a file lock error (HTTP 423).
 */
export class LockError extends AppError {
  public readonly details: { file: string };

  public constructor(message: string, file: string) {
    super(message, 423, HttpErrorCode.LOCKED);
    this.details = { file };
  }
}
