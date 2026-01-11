import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBAdapter } from '../adapters/aws/dynamodb-adapter';
import { S3CatalogAdapter } from '../adapters/aws/s3-adapter';
import { SQSAdapter } from '../adapters/aws/sqs-adapter';
import { PromptService } from '../core/services/prompt.service';
import { McpServer } from '../mcp/mcp-server';
import { MetricsCollector } from '../monitoring/cloudwatch-metrics';
import { ValidationError, NotFoundError, ConflictError, InternalServerError } from '../core/errors/custom-errors';

// Initialize adapters
const promptRepository = new DynamoDBAdapter(process.env.PROMPTS_TABLE!);
const catalogRepository = new S3CatalogAdapter(process.env.PROMPTS_BUCKET!);
const eventBus = new SQSAdapter(process.env.PROCESSING_QUEUE!);
const metricsCollector = new MetricsCollector();

// Initialize services
const promptService = new PromptService(promptRepository, catalogRepository, eventBus);
const mcpServer = new McpServer(promptService);

// Helper function to create error responses
function createErrorResponse(error: any): { statusCode: number; body: string } {
  let statusCode = 500;
  let message = 'Internal server error';

  if (error instanceof ValidationError) {
    statusCode = 400;
    message = error.message;
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    message = error.message;
  } else if (error instanceof ConflictError) {
    statusCode = 409;
    message = error.message;
  } else if (error instanceof InternalServerError) {
    statusCode = 500;
    message = error.message;
  } else if (error.message) {
    message = error.message;
  }

  return {
    statusCode,
    body: JSON.stringify({
      error: message,
      type: error.name || 'UnknownError'
    })
  };
}

export const handler: APIGatewayProxyHandler = async (event, context): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const { httpMethod, path, pathParameters, queryStringParameters, body } = event;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };

    // Handle OPTIONS requests
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    let response: any;

    // Route requests
    if (path === '/health') {
      response = await handleHealthCheck();
    } else if (path.startsWith('/v1/prompts')) {
      response = await handlePromptsApi(httpMethod, path, pathParameters, queryStringParameters, body);
    } else if (path.startsWith('/mcp')) {
      response = await handleMcpApi(httpMethod, path, pathParameters, queryStringParameters, body);
    } else {
      response = {
        statusCode: 404,
        body: JSON.stringify({ error: 'Not found' })
      };
    }

    // Record metrics
    const latency = Date.now() - startTime;
    await metricsCollector.recordLatency(path, latency);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      await metricsCollector.recordApiSuccess(path);
    } else {
      await metricsCollector.recordApiError(path, response.statusCode);
    }

    return {
      ...response,
      headers: {
        ...corsHeaders,
        ...response.headers,
        'Content-Type': 'application/json'
      }
    };

  } catch (error) {
    console.error('Lambda error:', error);

    const errorResponse = createErrorResponse(error);
    const latency = Date.now() - startTime;
    await metricsCollector.recordLatency(event.path, latency);
    await metricsCollector.recordApiError(event.path, errorResponse.statusCode);

    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json'
      },
      body: errorResponse.body
    };
  }
};

async function handleHealthCheck(): Promise<any> {
  const health = await Promise.all([
    promptRepository.healthCheck(),
    catalogRepository.healthCheck(),
    eventBus.healthCheck()
  ]);

  const allHealthy = health.every(h => h.status === 'healthy');

  return {
    statusCode: allHealthy ? 200 : 503,
    body: JSON.stringify({
      status: allHealthy ? 'healthy' : 'unhealthy',
      services: {
        dynamodb: health[0],
        s3: health[1],
        sqs: health[2]
      },
      timestamp: new Date().toISOString()
    })
  };
}

async function handlePromptsApi(method: string, path: string, pathParams: any, queryParams: any, body: string | null): Promise<any> {
  const parsedBody = body ? JSON.parse(body) : null;

  if (method === 'GET' && path === '/v1/prompts') {
    // List prompts
    const category = queryParams?.category;
    const limit = parseInt(queryParams?.limit || '50');

    const prompts = category
      ? await promptService.getPromptsByCategory(category, limit)
      : await promptService.getLatestPrompts(limit);

    return {
      statusCode: 200,
      body: JSON.stringify({
        prompts: prompts.map(p => p.toJSON()),
        total: prompts.length
      })
    };
  }

  if (method === 'POST' && path === '/v1/prompts') {
    // Create prompt
    const prompt = await promptService.createPrompt(parsedBody);

    return {
      statusCode: 201,
      body: JSON.stringify({
        prompt: prompt.toJSON(),
        message: 'Prompt created successfully'
      })
    };
  }

  if (method === 'GET' && pathParams?.id) {
    // Get specific prompt
    const prompt = await promptService.getPrompt(pathParams.id);

    if (!prompt) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Prompt not found' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ prompt: prompt.toJSON() })
    };
  }

  if (method === 'PUT' && pathParams?.id) {
    // Update prompt
    const prompt = await promptService.updatePrompt(pathParams.id, parsedBody);

    return {
      statusCode: 200,
      body: JSON.stringify({
        prompt: prompt.toJSON(),
        message: 'Prompt updated successfully'
      })
    };
  }

  if (method === 'DELETE' && pathParams?.id) {
    // Delete prompt
    await promptService.deletePrompt(pathParams.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Prompt deleted successfully' })
    };
  }

  if (method === 'POST' && path.includes('/apply')) {
    // Apply template variables
    const promptId = pathParams?.id;
    const variables = parsedBody?.variables || {};

    const result = await promptService.applyTemplate(promptId, variables);

    return {
      statusCode: 200,
      body: JSON.stringify({
        result,
        appliedVariables: variables
      })
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
}

async function handleMcpApi(method: string, path: string, pathParams: any, queryParams: any, body: string | null): Promise<any> {
  if (method === 'GET' && path === '/mcp') {
    // MCP capabilities
    return {
      statusCode: 200,
      body: JSON.stringify(mcpServer.getCapabilities())
    };
  }

  if (method === 'GET' && path === '/mcp/tools') {
    // List MCP tools
    return {
      statusCode: 200,
      body: JSON.stringify(mcpServer.getTools())
    };
  }

  if (method === 'POST' && path === '/mcp/tools') {
    // Execute MCP tool
    const parsedBody = body ? JSON.parse(body) : null;
    const result = await mcpServer.executeTool(parsedBody.tool, parsedBody.arguments);

    return {
      statusCode: 200,
      body: JSON.stringify({ result })
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
}
