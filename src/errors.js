"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockError = exports.DuplicateError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.AppError = exports.HttpErrorCode = void 0;
/**
 * Standardized error codes for HTTP responses.
 */
var HttpErrorCode;
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
})(HttpErrorCode || (exports.HttpErrorCode = HttpErrorCode = {}));
/**
 * Base class for all custom application errors.
 */
class AppError extends Error {
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
exports.AppError = AppError;
/**
 * Represents a validation error (HTTP 400).
 */
class ValidationError extends AppError {
    details;
    constructor(message, details) {
        super(message, 400, HttpErrorCode.VALIDATION_ERROR);
        this.details = details;
    }
}
exports.ValidationError = ValidationError;
/**
 * Represents a "not found" error (HTTP 404).
 */
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, HttpErrorCode.NOT_FOUND);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Represents an authentication error (HTTP 401).
 */
class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, HttpErrorCode.UNAUTHORIZED);
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * Represents a permission/authorization error (HTTP 403).
 */
class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(message, 403, HttpErrorCode.FORBIDDEN);
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * Represents a duplicate resource error (HTTP 409).
 */
class DuplicateError extends AppError {
    constructor(message) {
        super(message, 409, HttpErrorCode.CONFLICT);
    }
}
exports.DuplicateError = DuplicateError;
/**
 * Represents a file lock error (HTTP 423).
 */
class LockError extends AppError {
    details;
    constructor(message, file) {
        super(message, 423, HttpErrorCode.LOCKED);
        this.details = { file };
    }
}
exports.LockError = LockError;
