/**
 * Standardized error codes for HTTP responses.
 */
export declare enum HttpErrorCode {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    NOT_FOUND = "NOT_FOUND",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    DUPLICATE = "DUPLICATE",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    RATE_LIMIT = "RATE_LIMIT",
    CONFLICT = "CONFLICT",
    LOCKED = "LOCKED"
}
/**
 * Base class for all custom application errors.
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: HttpErrorCode;
    constructor(message: string, statusCode: number, code: HttpErrorCode);
}
/**
 * Represents a validation error (HTTP 400).
 */
export declare class ValidationError extends AppError {
    readonly details?: any[];
    constructor(message: string, details?: any[]);
}
/**
 * Represents a "not found" error (HTTP 404).
 */
export declare class NotFoundError extends AppError {
    constructor(message?: string);
}
/**
 * Represents an authentication error (HTTP 401).
 */
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
/**
 * Represents a permission/authorization error (HTTP 403).
 */
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
/**
 * Represents a duplicate resource error (HTTP 409).
 */
export declare class DuplicateError extends AppError {
    constructor(message: string);
}
/**
 * Represents a file lock error (HTTP 423).
 */
export declare class LockError extends AppError {
    readonly details: {
        file: string;
    };
    constructor(message: string, file: string);
}
