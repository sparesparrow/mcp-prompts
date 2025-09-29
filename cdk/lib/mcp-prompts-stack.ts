#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
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

    // S3 Bucket for user-uploaded prompts
    const userPromptsBucket = new s3.Bucket(this, 'UserPromptsBucket', {
      bucketName: `mcp-user-prompts-${this.account}-${this.region}`,
      versioned: true,
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag']
      }],
      lifecycleRules: [{
        id: 'DeleteOldVersions',
        noncurrentVersionExpiration: cdk.Duration.days(30)
      }]
    });

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, 'McpPromptsUserPool', {
      userPoolName: 'mcp-prompts-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false
      },
      emailSettings: {
        from: 'noreply@mcp-prompts.com'
      }
    });

    // User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'McpPromptsUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true
      },
      generateSecret: false
    });

    // DynamoDB Table for prompts metadata
    const promptsTable = new dynamodb.Table(this, 'PromptsTable', {
      tableName: 'mcp-prompts',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // Add Global Secondary Indexes
    promptsTable.addGlobalSecondaryIndex({
      indexName: 'category-index',
      partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING }
    });

    promptsTable.addGlobalSecondaryIndex({
      indexName: 'latest-version-index',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'is_latest', type: dynamodb.AttributeType.STRING }
    });

    promptsTable.addGlobalSecondaryIndex({
      indexName: 'access-level-index',
      partitionKey: { name: 'access_level', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING }
    });

    promptsTable.addGlobalSecondaryIndex({
      indexName: 'author-index',
      partitionKey: { name: 'author_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING }
    });

    // DynamoDB Table for sessions and caching
    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'mcp-sessions',
      partitionKey: { name: 'session_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expires_at'
    });

    // DynamoDB Table for users and subscriptions
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'mcp-users',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true
    });

    usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING }
    });

    usersTable.addGlobalSecondaryIndex({
      indexName: 'subscription-index',
      partitionKey: { name: 'subscription_tier', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'subscription_expires_at', type: dynamodb.AttributeType.STRING }
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

    // Auth Lambda for user authentication
    const authLambda = new lambda.Function(this, 'AuthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../dist'),
      handler: 'lambda/auth.handler',
      layers: [commonLayer],
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USERS_TABLE: usersTable.tableName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // User Management Lambda
    const userLambda = new lambda.Function(this, 'UserFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../dist'),
      handler: 'lambda/user.handler',
      layers: [commonLayer],
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USERS_TABLE: usersTable.tableName,
        USER_PROMPTS_BUCKET: userPromptsBucket.bucketName
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // Stripe Webhook Lambda
    const stripeWebhookLambda = new lambda.Function(this, 'StripeWebhookFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../dist'),
      handler: 'lambda/stripe-webhook.handler',
      layers: [commonLayer],
      environment: {
        USERS_TABLE: usersTable.tableName,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || ''
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_WEEK
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool]
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

    // API Key for rate limiting
    const apiKey = new apigateway.ApiKey(this, 'McpPromptsApiKey', {
      apiKeyName: 'mcp-prompts-api-key',
      description: 'API Key for MCP Prompts'
    });

    // Usage plan for rate limiting
    const usagePlan = new apigateway.UsagePlan(this, 'McpPromptsUsagePlan', {
      name: 'MCP Prompts Usage Plan',
      description: 'Usage plan for MCP Prompts API',
      apiStages: [{
        api,
        stage: api.deploymentStage
      }],
      throttle: {
        rateLimit: 100, // requests per second
        burstLimit: 200
      },
      quota: {
        limit: 10000, // requests per month for free tier
        period: apigateway.Period.MONTH
      }
    });

    usagePlan.addApiKey(apiKey);

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

    // Auth endpoints
    const auth = api.root.addResource('auth');
    const authIntegration = new apigateway.LambdaIntegration(authLambda);

    auth.addMethod('POST', authIntegration); // Login/Register

    const authRefresh = auth.addResource('refresh');
    authRefresh.addMethod('POST', authIntegration); // Refresh token

    // User endpoints (protected)
    const users = api.root.addResource('users');
    const userIntegration = new apigateway.LambdaIntegration(userLambda);

    const userById = users.addResource('{userId}');
    userById.addMethod('GET', userIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    }); // Get user profile

    userById.addMethod('PUT', userIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    }); // Update user profile

    // User prompts endpoints (protected)
    const userPrompts = userById.addResource('prompts');
    userPrompts.addMethod('GET', userIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    }); // List user's prompts

    userPrompts.addMethod('POST', userIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    }); // Upload prompt

    const userPromptById = userPrompts.addResource('{promptId}');
    userPromptById.addMethod('GET', userIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    }); // Get user's prompt

    userPromptById.addMethod('PUT', userIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    }); // Update user's prompt

    userPromptById.addMethod('DELETE', userIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    }); // Delete user's prompt

    // Stripe webhook endpoint (no auth required)
    const webhook = api.root.addResource('webhook');
    const stripeWebhook = webhook.addResource('stripe');
    const webhookIntegration = new apigateway.LambdaIntegration(stripeWebhookLambda);

    stripeWebhook.addMethod('POST', webhookIntegration); // Stripe webhook

    // MCP capabilities endpoint
    const mcp = api.root.addResource('mcp');
    mcp.addMethod('GET', mcpIntegration); // MCP capabilities
    const tools = mcp.addResource('tools');
    tools.addMethod('GET', mcpIntegration); // List tools
    tools.addMethod('POST', mcpIntegration); // Execute tool

    // S3 Bucket for web assets
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `mcp-prompts-web-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      },
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET],
        allowedHeaders: ['*']
      }]
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'McpPromptsDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      },
      additionalBehaviors: {
        '/v1/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
        },
        '/auth': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
        },
        '/users/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
        },
        '/mcp/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
        },
        '/health': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD
        },
        '/webhook/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
        },
        '/static/*': {
          origin: new origins.S3Origin(promptsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
        }
      }
    });

    // Event source mappings
    processingLambda.addEventSource(new SqsEventSource(processingQueue, {
      batchSize: 10
    }));

    catalogSyncLambda.addEventSource(new SqsEventSource(catalogSyncQueue, {
      batchSize: 1
    }));

    // Permissions
    promptsTable.grantReadWriteData(mcpServerLambda);
    promptsTable.grantReadWriteData(processingLambda);
    promptsTable.grantReadWriteData(catalogSyncLambda);
    promptsTable.grantReadWriteData(authLambda);
    promptsTable.grantReadWriteData(userLambda);

    sessionsTable.grantReadWriteData(mcpServerLambda);

    usersTable.grantReadWriteData(authLambda);
    usersTable.grantReadWriteData(userLambda);
    usersTable.grantReadWriteData(stripeWebhookLambda);

    promptsBucket.grantReadWrite(mcpServerLambda);
    promptsBucket.grantReadWrite(processingLambda);
    promptsBucket.grantReadWrite(catalogSyncLambda);

    userPromptsBucket.grantReadWrite(authLambda);
    userPromptsBucket.grantReadWrite(userLambda);

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
    authLambda.addToRolePolicy(cloudwatchPolicy);
    userLambda.addToRolePolicy(cloudwatchPolicy);

    // Cognito permissions for auth lambda
    const cognitoPolicy = new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminInitiateAuth',
        'cognito-idp:AdminRespondToAuthChallenge',
        'cognito-idp:AdminGetUser',
        'cognito-idp:ListUsers',
        'cognito-idp:AdminUpdateUserAttributes'
      ],
      resources: [userPool.userPoolArn]
    });

    authLambda.addToRolePolicy(cognitoPolicy);
    userLambda.addToRolePolicy(cognitoPolicy);

    // Outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL (Web App)'
    });

    new cdk.CfnOutput(this, 'WebBucketName', {
      value: webBucket.bucketName,
      description: 'S3 Bucket for web assets'
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: promptsBucket.bucketName,
      description: 'S3 Bucket for prompts catalog'
    });

    new cdk.CfnOutput(this, 'UserPromptsBucketName', {
      value: userPromptsBucket.bucketName,
      description: 'S3 Bucket for user-uploaded prompts'
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: promptsTable.tableName,
      description: 'DynamoDB table for prompts'
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB table for users'
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID'
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    });

    new cdk.CfnOutput(this, 'ApiKey', {
      value: apiKey.keyId,
      description: 'API Gateway Key ID'
    });
  }
}
