// Improved Lambda function with structured JSON logging
const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({ region: process.env.AWS_REGION || 'eu-north-1' });

// Structured logging utility
class StructuredLogger {
    constructor(serviceName = 'mcp-prompts') {
        this.serviceName = serviceName;
        this.logLevel = process.env.LOG_LEVEL || 'INFO';
    }

    _shouldLog(level) {
        const levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
        return levels[level] <= levels[this.logLevel];
    }

    _formatLog(level, message, extra = {}) {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            service: this.serviceName,
            message,
            requestId: extra.requestId || 'unknown',
            ...extra
        });
    }

    error(message, extra = {}) {
        if (this._shouldLog('ERROR')) {
            console.error(this._formatLog('ERROR', message, extra));
        }
    }

    warn(message, extra = {}) {
        if (this._shouldLog('WARN')) {
            console.warn(this._formatLog('WARN', message, extra));
        }
    }

    info(message, extra = {}) {
        if (this._shouldLog('INFO')) {
            console.log(this._formatLog('INFO', message, extra));
        }
    }

    debug(message, extra = {}) {
        if (this._shouldLog('DEBUG')) {
            console.debug(this._formatLog('DEBUG', message, extra));
        }
    }
}

const logger = new StructuredLogger();

exports.handler = async (event, context) => {
    const requestId = context.awsRequestId;
    const startTime = Date.now();
    
    logger.info('Request started', {
        requestId,
        method: event.httpMethod,
        path: event.path,
        userAgent: event.headers?.['User-Agent'],
        sourceIp: event.requestContext?.identity?.sourceIp
    });

    try {
        // Authentication check
        if (!isAuthenticated(event)) {
            logger.warn('Authentication failed', {
                requestId,
                sourceIp: event.requestContext?.identity?.sourceIp,
                userAgent: event.headers?.['User-Agent']
            });
            
            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Unauthorized',
                    code: 'AUTH_FAILED',
                    requestId
                })
            };
        }

        // Route handling
        const result = await handleRequest(event, context);
        
        const duration = Date.now() - startTime;
        logger.info('Request completed successfully', {
            requestId,
            statusCode: 200,
            duration,
            path: event.path
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Request-ID': requestId
            },
            body: JSON.stringify(result)
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error('Request failed', {
            requestId,
            error: error.message,
            stack: error.stack,
            duration,
            path: event.path,
            statusCode: 500
        });

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Request-ID': requestId
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                code: 'INTERNAL_ERROR',
                requestId,
                timestamp: new Date().toISOString()
            })
        };
    }
};

function isAuthenticated(event) {
    // Implement authentication logic
    return true; // Placeholder
}

async function handleRequest(event, context) {
    // Implement request handling logic
    return { message: 'Success', timestamp: new Date().toISOString() };
}
