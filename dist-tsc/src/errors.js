/**
 * Standardized error codes for HTTP responses.
 */
export var HttpErrorCode;
(function (HttpErrorCode) {
    HttpErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    HttpErrorCode["NOT_FOUND"] = "NOT_FOUND";
    HttpErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    HttpErrorCode["FORBIDDEN"] = "FORBIDDEN";
    HttpErrorCode["DUPLICATE"] = "DUPLICATE";
    HttpErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    HttpErrorCode["RATE_LIMIT"] = "RATE_LIMIT";
    HttpErrorCode["CONFLICT"] = "CONFLICT";
    HttpErrorCode["LOCKED"] = "LOCKED";
})(HttpErrorCode || (HttpErrorCode = {}));
/**
 * Base class for all custom application errors.
 */
export class AppError extends Error {
    statusCode;
    code;
    constructor(message, statusCode, code) {
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
    details;
    constructor(message, details) {
        super(message, 400, HttpErrorCode.VALIDATION_ERROR);
        this.details = details;
    }
}
/**
 * Represents a "not found" error (HTTP 404).
 */
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, HttpErrorCode.NOT_FOUND);
    }
}
/**
 * Represents an authentication error (HTTP 401).
 */
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, HttpErrorCode.UNAUTHORIZED);
    }
}
/**
 * Represents a permission/authorization error (HTTP 403).
 */
export class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(message, 403, HttpErrorCode.FORBIDDEN);
    }
}
/**
 * Represents a duplicate resource error (HTTP 409).
 */
export class DuplicateError extends AppError {
    constructor(message) {
        super(message, 409, HttpErrorCode.CONFLICT);
    }
}
/**
 * Represents a file lock error (HTTP 423).
 */
export class LockError extends AppError {
    details;
    constructor(message, file) {
        super(message, 423, HttpErrorCode.LOCKED);
        this.details = { file };
    }
}
