import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class McpPromptsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for catalog and assets
    const promptsBucket = new s3.Bucket(this, 'PromptsBucket', {
      bucketName: `mcp-prompts-catalog-${this.account}-${this.region}`,
      versioned: true,
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      },
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag']
      }],
      lifecycleRules: [{
        id: 'DeleteOldVersions',
        noncurrentVersionExpiration: cdk.Duration.days(30)
      }]
    });

    // DynamoDB Table for prompts metadata
    const promptsTable = new dynamodb.Table(this, 'PromptsTable', {
      tableName: 'mcp-prompts',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      globalSecondaryIndexes: [
        {
          indexName: 'category-index',
          partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING }
        },
        {
          indexName: 'latest-version-index',
          partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'is_latest', type: dynamodb.AttributeType.STRING }
        }
      ],
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // DynamoDB Table for sessions and caching
    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'mcp-sessions',
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires_at'
    });

    // SQS Queue for async processing
    const processingDLQ = new sqs.Queue(this, 'ProcessingDLQ', {
      queueName: 'mcp-prompts-processing-dlq',
      retentionPeriod: cdk.Duration.days(14)
    });

    const processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: 'mcp-prompts-processing',
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        queue: processingDLQ,
        maxReceiveCount: 3
      }
    });

    // SQS Queue for catalog sync
    const catalogSyncQueue = new sqs.Queue(this, 'CatalogSyncQueue', {
      queueName: 'mcp-catalog-sync',
      visibilityTimeout: cdk.Duration.minutes(10)
    });

    // Lambda Layer for common dependencies
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset('../layers/common'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Common dependencies for MCP Prompts'
    });

    // Main MCP Server Lambda
    const mcpServerLambda = new lambda.Function(this, 'McpServerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../dist'),
      handler: 'lambda/mcp-server.handler',
      layers: [commonLayer],
      environment: {
        PROMPTS_TABLE: promptsTable.tableName,
        SESSIONS_TABLE: sessionsTable.tableName,
        PROMPTS_BUCKET: promptsBucket.bucketName,
        PROCESSING_QUEUE: processingQueue.queueUrl,
        CATALOG_SYNC_QUEUE: catalogSyncQueue.queueUrl,
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // Processing Lambda for async tasks
    const processingLambda = new lambda.Function(this, 'ProcessingFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../dist'),
      handler: 'lambda/processor.handler',
      layers: [commonLayer],
      environment: {
        PROMPTS_TABLE: promptsTable.tableName,
        SESSIONS_TABLE: sessionsTable.tableName,
        PROMPTS_BUCKET: promptsBucket.bucketName
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // Catalog Sync Lambda
    const catalogSyncLambda = new lambda.Function(this, 'CatalogSyncFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../dist'),
      handler: 'lambda/catalog-sync.handler',
      layers: [commonLayer],
      environment: {
        PROMPTS_TABLE: promptsTable.tableName,
        PROMPTS_BUCKET: promptsBucket.bucketName,
        GITHUB_REPO_URL: 'https://github.com/sparesparrow/mcp-prompts-catalog'
      },
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'McpPromptsApi', {
      restApiName: 'MCP Prompts Service',
      description: 'API for MCP Prompts with AWS backend',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token']
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL]
      }
    });

    // API Gateway integration
    const mcpIntegration = new apigateway.LambdaIntegration(mcpServerLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    });

    // API routes
    const v1 = api.root.addResource('v1');
    const prompts = v1.addResource('prompts');

    prompts.addMethod('GET', mcpIntegration); // List prompts
    prompts.addMethod('POST', mcpIntegration); // Create prompt

    const promptById = prompts.addResource('{id}');
    promptById.addMethod('GET', mcpIntegration); // Get prompt
    promptById.addMethod('PUT', mcpIntegration); // Update prompt
    promptById.addMethod('DELETE', mcpIntegration); // Delete prompt

    const promptApply = promptById.addResource('apply');
    promptApply.addMethod('POST', mcpIntegration); // Apply template variables

    // Health endpoint
    const health = api.root.addResource('health');
    health.addMethod('GET', mcpIntegration);

    // MCP capabilities endpoint
    const mcp = api.root.addResource('mcp');
    mcp.addMethod('GET', mcpIntegration); // MCP capabilities
    const tools = mcp.addResource('tools');
    tools.addMethod('GET', mcpIntegration); // List tools
    tools.addMethod('POST', mcpIntegration); // Execute tool

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'McpPromptsDistribution', {
      defaultBehavior: {
        origin: new origins.RestApiOrigin(api),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
      },
      additionalBehaviors: {
        '/static/*': {
          origin: new origins.S3Origin(promptsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
        }
      }
    });

    // Event source mappings
    processingLambda.addEventSource(new lambda.SqsEventSource(processingQueue, {
      batchSize: 10
    }));

    catalogSyncLambda.addEventSource(new lambda.SqsEventSource(catalogSyncQueue, {
      batchSize: 1
    }));

    // Permissions
    promptsTable.grantReadWriteData(mcpServerLambda);
    promptsTable.grantReadWriteData(processingLambda);
    promptsTable.grantReadWriteData(catalogSyncLambda);

    sessionsTable.grantReadWriteData(mcpServerLambda);

    promptsBucket.grantReadWrite(mcpServerLambda);
    promptsBucket.grantReadWrite(processingLambda);
    promptsBucket.grantReadWrite(catalogSyncLambda);

    processingQueue.grantSendMessages(mcpServerLambda);
    catalogSyncQueue.grantSendMessages(mcpServerLambda);

    processingQueue.grantConsumeMessages(processingLambda);
    catalogSyncQueue.grantConsumeMessages(catalogSyncLambda);

    // CloudWatch permissions
    const cloudwatchPolicy = new iam.PolicyStatement({
      actions: [
        'cloudwatch:PutMetricData',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: ['*']
    });

    mcpServerLambda.addToRolePolicy(cloudwatchPolicy);
    processingLambda.addToRolePolicy(cloudwatchPolicy);
    catalogSyncLambda.addToRolePolicy(cloudwatchPolicy);

    // Outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL'
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: promptsBucket.bucketName,
      description: 'S3 Bucket for prompts catalog'
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: promptsTable.tableName,
      description: 'DynamoDB table for prompts'
    });
  }
}
