#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpPromptsStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const sqs = require("aws-cdk-lib/aws-sqs");
const iam = require("aws-cdk-lib/aws-iam");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const logs = require("aws-cdk-lib/aws-logs");
const cognito = require("aws-cdk-lib/aws-cognito");
const aws_lambda_event_sources_1 = require("aws-cdk-lib/aws-lambda-event-sources");
class McpPromptsStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        processingLambda.addEventSource(new aws_lambda_event_sources_1.SqsEventSource(processingQueue, {
            batchSize: 10
        }));
        catalogSyncLambda.addEventSource(new aws_lambda_event_sources_1.SqsEventSource(catalogSyncQueue, {
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
exports.McpPromptsStack = McpPromptsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXByb21wdHMtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtY3AtcHJvbXB0cy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0FBRUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCx5REFBeUQ7QUFFekQscURBQXFEO0FBQ3JELHlDQUF5QztBQUN6QywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLHlEQUF5RDtBQUN6RCw4REFBOEQ7QUFDOUQsNkNBQTZDO0FBQzdDLG1EQUFtRDtBQUNuRCxtRkFBc0U7QUFHdEUsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsbUNBQW1DO1FBQ25DLE1BQU0sYUFBYSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3pELFVBQVUsRUFBRSx1QkFBdUIsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ2hFLFNBQVMsRUFBRSxJQUFJO1lBQ2YsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixpQkFBaUIsRUFBRTtnQkFDakIsZUFBZSxFQUFFLEtBQUs7Z0JBQ3RCLGlCQUFpQixFQUFFLEtBQUs7Z0JBQ3hCLGdCQUFnQixFQUFFLEtBQUs7Z0JBQ3ZCLHFCQUFxQixFQUFFLEtBQUs7YUFDN0I7WUFDRCxJQUFJLEVBQUUsQ0FBQztvQkFDTCxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7b0JBQ3JCLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO29CQUM3RSxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7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Z0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxTQUFTO1lBQzNCLFdBQVcsRUFBRSwwQkFBMEI7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsUUFBUSxDQUFDLFVBQVU7WUFDMUIsV0FBVyxFQUFFLHNCQUFzQjtTQUNwQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ2pELEtBQUssRUFBRSxjQUFjLENBQUMsZ0JBQWdCO1lBQ3RDLFdBQVcsRUFBRSw2QkFBNkI7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDaEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLO1lBQ25CLFdBQVcsRUFBRSxvQkFBb0I7U0FDbEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBMWtCRCwwQ0Ewa0JDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHNxcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3FzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgeyBTcXNFdmVudFNvdXJjZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIE1jcFByb21wdHNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgY2F0YWxvZyBhbmQgYXNzZXRzXG4gICAgY29uc3QgcHJvbXB0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Byb21wdHNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgbWNwLXByb21wdHMtY2F0YWxvZy0ke3RoaXMuYWNjb3VudH0tJHt0aGlzLnJlZ2lvbn1gLFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiB7XG4gICAgICAgIGJsb2NrUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIGJsb2NrUHVibGljUG9saWN5OiBmYWxzZSxcbiAgICAgICAgaWdub3JlUHVibGljQWNsczogZmFsc2UsXG4gICAgICAgIHJlc3RyaWN0UHVibGljQnVja2V0czogZmFsc2VcbiAgICAgIH0sXG4gICAgICBjb3JzOiBbe1xuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1RdLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGV4cG9zZWRIZWFkZXJzOiBbJ0VUYWcnXVxuICAgICAgfV0sXG4gICAgICBsaWZlY3ljbGVSdWxlczogW3tcbiAgICAgICAgaWQ6ICdEZWxldGVPbGRWZXJzaW9ucycsXG4gICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uRXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApXG4gICAgICB9XVxuICAgIH0pO1xuXG4gICAgLy8gUzMgQnVja2V0IGZvciB1c2VyLXVwbG9hZGVkIHByb21wdHNcbiAgICBjb25zdCB1c2VyUHJvbXB0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1VzZXJQcm9tcHRzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYG1jcC11c2VyLXByb21wdHMtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGNvcnM6IFt7XG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLlBVVCwgczMuSHR0cE1ldGhvZHMuUE9TVCwgczMuSHR0cE1ldGhvZHMuREVMRVRFXSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBleHBvc2VkSGVhZGVyczogWydFVGFnJ11cbiAgICAgIH1dLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFt7XG4gICAgICAgIGlkOiAnRGVsZXRlT2xkVmVyc2lvbnMnLFxuICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDMwKVxuICAgICAgfV1cbiAgICB9KTtcblxuICAgIC8vIENvZ25pdG8gVXNlciBQb29sIGZvciBhdXRoZW50aWNhdGlvblxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ01jcFByb21wdHNVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ21jcC1wcm9tcHRzLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgdXNlcm5hbWU6IGZhbHNlXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2VcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFVzZXIgUG9vbCBDbGllbnRcbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdNY3BQcm9tcHRzVXNlclBvb2xDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlXG4gICAgICB9LFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZSBmb3IgcHJvbXB0cyBtZXRhZGF0YVxuICAgIGNvbnN0IHByb21wdHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUHJvbXB0c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnbWNwLXByb21wdHMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd2ZXJzaW9uJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVNcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHbG9iYWwgU2Vjb25kYXJ5IEluZGV4ZXNcbiAgICBwcm9tcHRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnY2F0ZWdvcnktaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdjYXRlZ29yeScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkX2F0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfVxuICAgIH0pO1xuXG4gICAgcHJvbXB0c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2xhdGVzdC12ZXJzaW9uLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnaXNfbGF0ZXN0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfVxuICAgIH0pO1xuXG4gICAgcHJvbXB0c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2FjY2Vzcy1sZXZlbC1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2FjY2Vzc19sZXZlbCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkX2F0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfVxuICAgIH0pO1xuXG4gICAgcHJvbXB0c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2F1dGhvci1pbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2F1dGhvcl9pZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkX2F0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfVxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgZm9yIHNlc3Npb25zIGFuZCBjYWNoaW5nXG4gICAgY29uc3Qgc2Vzc2lvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU2Vzc2lvbnNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ21jcC1zZXNzaW9ucycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Nlc3Npb25faWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdleHBpcmVzX2F0J1xuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGUgZm9yIHVzZXJzIGFuZCBzdWJzY3JpcHRpb25zXG4gICAgY29uc3QgdXNlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVXNlcnNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ21jcC11c2VycycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJfaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWVcbiAgICB9KTtcblxuICAgIHVzZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZW1haWwtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdlbWFpbCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH1cbiAgICB9KTtcblxuICAgIHVzZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnc3Vic2NyaXB0aW9uLWluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc3Vic2NyaXB0aW9uX3RpZXInLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnc3Vic2NyaXB0aW9uX2V4cGlyZXNfYXQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9XG4gICAgfSk7XG5cbiAgICAvLyBTUVMgUXVldWUgZm9yIGFzeW5jIHByb2Nlc3NpbmdcbiAgICBjb25zdCBwcm9jZXNzaW5nRExRID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnUHJvY2Vzc2luZ0RMUScsIHtcbiAgICAgIHF1ZXVlTmFtZTogJ21jcC1wcm9tcHRzLXByb2Nlc3NpbmctZGxxJyxcbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpXG4gICAgfSk7XG5cbiAgICBjb25zdCBwcm9jZXNzaW5nUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdQcm9jZXNzaW5nUXVldWUnLCB7XG4gICAgICBxdWV1ZU5hbWU6ICdtY3AtcHJvbXB0cy1wcm9jZXNzaW5nJyxcbiAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogcHJvY2Vzc2luZ0RMUSxcbiAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBTUVMgUXVldWUgZm9yIGNhdGFsb2cgc3luY1xuICAgIGNvbnN0IGNhdGFsb2dTeW5jUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdDYXRhbG9nU3luY1F1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiAnbWNwLWNhdGFsb2ctc3luYycsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgTGF5ZXIgZm9yIGNvbW1vbiBkZXBlbmRlbmNpZXNcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vbGF5ZXJzL2NvbW1vbicpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxuICAgICAgZGVzY3JpcHRpb246ICdDb21tb24gZGVwZW5kZW5jaWVzIGZvciBNQ1AgUHJvbXB0cydcbiAgICB9KTtcblxuICAgIC8vIE1haW4gTUNQIFNlcnZlciBMYW1iZGFcbiAgICBjb25zdCBtY3BTZXJ2ZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNY3BTZXJ2ZXJGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9kaXN0JyksXG4gICAgICBoYW5kbGVyOiAnbGFtYmRhL21jcC1zZXJ2ZXIuaGFuZGxlcicsXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQUk9NUFRTX1RBQkxFOiBwcm9tcHRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTRVNTSU9OU19UQUJMRTogc2Vzc2lvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBST01QVFNfQlVDS0VUOiBwcm9tcHRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFBST0NFU1NJTkdfUVVFVUU6IHByb2Nlc3NpbmdRdWV1ZS5xdWV1ZVVybCxcbiAgICAgICAgQ0FUQUxPR19TWU5DX1FVRVVFOiBjYXRhbG9nU3luY1F1ZXVlLnF1ZXVlVXJsLFxuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgICBMT0dfTEVWRUw6ICdpbmZvJ1xuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLXG4gICAgfSk7XG5cbiAgICAvLyBQcm9jZXNzaW5nIExhbWJkYSBmb3IgYXN5bmMgdGFza3NcbiAgICBjb25zdCBwcm9jZXNzaW5nTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJvY2Vzc2luZ0Z1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2Rpc3QnKSxcbiAgICAgIGhhbmRsZXI6ICdsYW1iZGEvcHJvY2Vzc29yLmhhbmRsZXInLFxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJPTVBUU19UQUJMRTogcHJvbXB0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgU0VTU0lPTlNfVEFCTEU6IHNlc3Npb25zVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQUk9NUFRTX0JVQ0tFVDogcHJvbXB0c0J1Y2tldC5idWNrZXROYW1lXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUtcbiAgICB9KTtcblxuICAgIC8vIENhdGFsb2cgU3luYyBMYW1iZGFcbiAgICBjb25zdCBjYXRhbG9nU3luY0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NhdGFsb2dTeW5jRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vZGlzdCcpLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYS9jYXRhbG9nLXN5bmMuaGFuZGxlcicsXG4gICAgICBsYXllcnM6IFtjb21tb25MYXllcl0sXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBQUk9NUFRTX1RBQkxFOiBwcm9tcHRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQUk9NUFRTX0JVQ0tFVDogcHJvbXB0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBHSVRIVUJfUkVQT19VUkw6ICdodHRwczovL2dpdGh1Yi5jb20vc3BhcmVzcGFycm93L21jcC1wcm9tcHRzLWNhdGFsb2cnXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLXG4gICAgfSk7XG5cbiAgICAvLyBBdXRoIExhbWJkYSBmb3IgdXNlciBhdXRoZW50aWNhdGlvblxuICAgIGNvbnN0IGF1dGhMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBdXRoRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vZGlzdCcpLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYS9hdXRoLmhhbmRsZXInLFxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBVU0VSU19UQUJMRTogdXNlcnNUYWJsZS50YWJsZU5hbWVcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFS1xuICAgIH0pO1xuXG4gICAgLy8gVXNlciBNYW5hZ2VtZW50IExhbWJkYVxuICAgIGNvbnN0IHVzZXJMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVc2VyRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vZGlzdCcpLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYS91c2VyLmhhbmRsZXInLFxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBVU0VSX1BPT0xfQ0xJRU5UX0lEOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBVU0VSU19UQUJMRTogdXNlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFVTRVJfUFJPTVBUU19CVUNLRVQ6IHVzZXJQcm9tcHRzQnVja2V0LmJ1Y2tldE5hbWVcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFS1xuICAgIH0pO1xuXG4gICAgLy8gU3RyaXBlIFdlYmhvb2sgTGFtYmRhXG4gICAgY29uc3Qgc3RyaXBlV2ViaG9va0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0cmlwZVdlYmhvb2tGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9kaXN0JyksXG4gICAgICBoYW5kbGVyOiAnbGFtYmRhL3N0cmlwZS13ZWJob29rLmhhbmRsZXInLFxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVVNFUlNfVEFCTEU6IHVzZXJzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBTVFJJUEVfV0VCSE9PS19TRUNSRVQ6IHByb2Nlc3MuZW52LlNUUklQRV9XRUJIT09LX1NFQ1JFVCB8fCAnJ1xuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLXG4gICAgfSk7XG5cbiAgICAvLyBDb2duaXRvIEF1dGhvcml6ZXJcbiAgICBjb25zdCBjb2duaXRvQXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdDb2duaXRvQXV0aG9yaXplcicsIHtcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF1cbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnTWNwUHJvbXB0c0FwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnTUNQIFByb21wdHMgU2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3IgTUNQIFByb21wdHMgd2l0aCBBV1MgYmFja2VuZCcsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknLCAnWC1BbXotU2VjdXJpdHktVG9rZW4nXVxuICAgICAgfSxcbiAgICAgIGVuZHBvaW50Q29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlczogW2FwaWdhdGV3YXkuRW5kcG9pbnRUeXBlLlJFR0lPTkFMXVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEtleSBmb3IgcmF0ZSBsaW1pdGluZ1xuICAgIGNvbnN0IGFwaUtleSA9IG5ldyBhcGlnYXRld2F5LkFwaUtleSh0aGlzLCAnTWNwUHJvbXB0c0FwaUtleScsIHtcbiAgICAgIGFwaUtleU5hbWU6ICdtY3AtcHJvbXB0cy1hcGkta2V5JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEtleSBmb3IgTUNQIFByb21wdHMnXG4gICAgfSk7XG5cbiAgICAvLyBVc2FnZSBwbGFuIGZvciByYXRlIGxpbWl0aW5nXG4gICAgY29uc3QgdXNhZ2VQbGFuID0gbmV3IGFwaWdhdGV3YXkuVXNhZ2VQbGFuKHRoaXMsICdNY3BQcm9tcHRzVXNhZ2VQbGFuJywge1xuICAgICAgbmFtZTogJ01DUCBQcm9tcHRzIFVzYWdlIFBsYW4nLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2FnZSBwbGFuIGZvciBNQ1AgUHJvbXB0cyBBUEknLFxuICAgICAgYXBpU3RhZ2VzOiBbe1xuICAgICAgICBhcGksXG4gICAgICAgIHN0YWdlOiBhcGkuZGVwbG95bWVudFN0YWdlXG4gICAgICB9XSxcbiAgICAgIHRocm90dGxlOiB7XG4gICAgICAgIHJhdGVMaW1pdDogMTAwLCAvLyByZXF1ZXN0cyBwZXIgc2Vjb25kXG4gICAgICAgIGJ1cnN0TGltaXQ6IDIwMFxuICAgICAgfSxcbiAgICAgIHF1b3RhOiB7XG4gICAgICAgIGxpbWl0OiAxMDAwMCwgLy8gcmVxdWVzdHMgcGVyIG1vbnRoIGZvciBmcmVlIHRpZXJcbiAgICAgICAgcGVyaW9kOiBhcGlnYXRld2F5LlBlcmlvZC5NT05USFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdXNhZ2VQbGFuLmFkZEFwaUtleShhcGlLZXkpO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgaW50ZWdyYXRpb25cbiAgICBjb25zdCBtY3BJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG1jcFNlcnZlckxhbWJkYSwge1xuICAgICAgcmVxdWVzdFRlbXBsYXRlczogeyAnYXBwbGljYXRpb24vanNvbic6ICd7IFwic3RhdHVzQ29kZVwiOiBcIjIwMFwiIH0nIH1cbiAgICB9KTtcblxuICAgIC8vIEFQSSByb3V0ZXNcbiAgICBjb25zdCB2MSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd2MScpO1xuICAgIGNvbnN0IHByb21wdHMgPSB2MS5hZGRSZXNvdXJjZSgncHJvbXB0cycpO1xuXG4gICAgcHJvbXB0cy5hZGRNZXRob2QoJ0dFVCcsIG1jcEludGVncmF0aW9uKTsgLy8gTGlzdCBwcm9tcHRzXG4gICAgcHJvbXB0cy5hZGRNZXRob2QoJ1BPU1QnLCBtY3BJbnRlZ3JhdGlvbik7IC8vIENyZWF0ZSBwcm9tcHRcblxuICAgIGNvbnN0IHByb21wdEJ5SWQgPSBwcm9tcHRzLmFkZFJlc291cmNlKCd7aWR9Jyk7XG4gICAgcHJvbXB0QnlJZC5hZGRNZXRob2QoJ0dFVCcsIG1jcEludGVncmF0aW9uKTsgLy8gR2V0IHByb21wdFxuICAgIHByb21wdEJ5SWQuYWRkTWV0aG9kKCdQVVQnLCBtY3BJbnRlZ3JhdGlvbik7IC8vIFVwZGF0ZSBwcm9tcHRcbiAgICBwcm9tcHRCeUlkLmFkZE1ldGhvZCgnREVMRVRFJywgbWNwSW50ZWdyYXRpb24pOyAvLyBEZWxldGUgcHJvbXB0XG5cbiAgICBjb25zdCBwcm9tcHRBcHBseSA9IHByb21wdEJ5SWQuYWRkUmVzb3VyY2UoJ2FwcGx5Jyk7XG4gICAgcHJvbXB0QXBwbHkuYWRkTWV0aG9kKCdQT1NUJywgbWNwSW50ZWdyYXRpb24pOyAvLyBBcHBseSB0ZW1wbGF0ZSB2YXJpYWJsZXNcblxuICAgIC8vIEhlYWx0aCBlbmRwb2ludFxuICAgIGNvbnN0IGhlYWx0aCA9IGFwaS5yb290LmFkZFJlc291cmNlKCdoZWFsdGgnKTtcbiAgICBoZWFsdGguYWRkTWV0aG9kKCdHRVQnLCBtY3BJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyBBdXRoIGVuZHBvaW50c1xuICAgIGNvbnN0IGF1dGggPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYXV0aCcpO1xuICAgIGNvbnN0IGF1dGhJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGF1dGhMYW1iZGEpO1xuXG4gICAgYXV0aC5hZGRNZXRob2QoJ1BPU1QnLCBhdXRoSW50ZWdyYXRpb24pOyAvLyBMb2dpbi9SZWdpc3RlclxuXG4gICAgY29uc3QgYXV0aFJlZnJlc2ggPSBhdXRoLmFkZFJlc291cmNlKCdyZWZyZXNoJyk7XG4gICAgYXV0aFJlZnJlc2guYWRkTWV0aG9kKCdQT1NUJywgYXV0aEludGVncmF0aW9uKTsgLy8gUmVmcmVzaCB0b2tlblxuXG4gICAgLy8gVXNlciBlbmRwb2ludHMgKHByb3RlY3RlZClcbiAgICBjb25zdCB1c2VycyA9IGFwaS5yb290LmFkZFJlc291cmNlKCd1c2VycycpO1xuICAgIGNvbnN0IHVzZXJJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHVzZXJMYW1iZGEpO1xuXG4gICAgY29uc3QgdXNlckJ5SWQgPSB1c2Vycy5hZGRSZXNvdXJjZSgne3VzZXJJZH0nKTtcbiAgICB1c2VyQnlJZC5hZGRNZXRob2QoJ0dFVCcsIHVzZXJJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7IC8vIEdldCB1c2VyIHByb2ZpbGVcblxuICAgIHVzZXJCeUlkLmFkZE1ldGhvZCgnUFVUJywgdXNlckludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE9cbiAgICB9KTsgLy8gVXBkYXRlIHVzZXIgcHJvZmlsZVxuXG4gICAgLy8gVXNlciBwcm9tcHRzIGVuZHBvaW50cyAocHJvdGVjdGVkKVxuICAgIGNvbnN0IHVzZXJQcm9tcHRzID0gdXNlckJ5SWQuYWRkUmVzb3VyY2UoJ3Byb21wdHMnKTtcbiAgICB1c2VyUHJvbXB0cy5hZGRNZXRob2QoJ0dFVCcsIHVzZXJJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7IC8vIExpc3QgdXNlcidzIHByb21wdHNcblxuICAgIHVzZXJQcm9tcHRzLmFkZE1ldGhvZCgnUE9TVCcsIHVzZXJJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7IC8vIFVwbG9hZCBwcm9tcHRcblxuICAgIGNvbnN0IHVzZXJQcm9tcHRCeUlkID0gdXNlclByb21wdHMuYWRkUmVzb3VyY2UoJ3twcm9tcHRJZH0nKTtcbiAgICB1c2VyUHJvbXB0QnlJZC5hZGRNZXRob2QoJ0dFVCcsIHVzZXJJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7IC8vIEdldCB1c2VyJ3MgcHJvbXB0XG5cbiAgICB1c2VyUHJvbXB0QnlJZC5hZGRNZXRob2QoJ1BVVCcsIHVzZXJJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7IC8vIFVwZGF0ZSB1c2VyJ3MgcHJvbXB0XG5cbiAgICB1c2VyUHJvbXB0QnlJZC5hZGRNZXRob2QoJ0RFTEVURScsIHVzZXJJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7IC8vIERlbGV0ZSB1c2VyJ3MgcHJvbXB0XG5cbiAgICAvLyBTdHJpcGUgd2ViaG9vayBlbmRwb2ludCAobm8gYXV0aCByZXF1aXJlZClcbiAgICBjb25zdCB3ZWJob29rID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3dlYmhvb2snKTtcbiAgICBjb25zdCBzdHJpcGVXZWJob29rID0gd2ViaG9vay5hZGRSZXNvdXJjZSgnc3RyaXBlJyk7XG4gICAgY29uc3Qgd2ViaG9va0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oc3RyaXBlV2ViaG9va0xhbWJkYSk7XG5cbiAgICBzdHJpcGVXZWJob29rLmFkZE1ldGhvZCgnUE9TVCcsIHdlYmhvb2tJbnRlZ3JhdGlvbik7IC8vIFN0cmlwZSB3ZWJob29rXG5cbiAgICAvLyBNQ1AgY2FwYWJpbGl0aWVzIGVuZHBvaW50XG4gICAgY29uc3QgbWNwID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ21jcCcpO1xuICAgIG1jcC5hZGRNZXRob2QoJ0dFVCcsIG1jcEludGVncmF0aW9uKTsgLy8gTUNQIGNhcGFiaWxpdGllc1xuICAgIGNvbnN0IHRvb2xzID0gbWNwLmFkZFJlc291cmNlKCd0b29scycpO1xuICAgIHRvb2xzLmFkZE1ldGhvZCgnR0VUJywgbWNwSW50ZWdyYXRpb24pOyAvLyBMaXN0IHRvb2xzXG4gICAgdG9vbHMuYWRkTWV0aG9kKCdQT1NUJywgbWNwSW50ZWdyYXRpb24pOyAvLyBFeGVjdXRlIHRvb2xcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3Igd2ViIGFzc2V0c1xuICAgIGNvbnN0IHdlYkJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1dlYkJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBtY3AtcHJvbXB0cy13ZWItJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHtcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxuICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIGNvcnM6IFt7XG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVRdLFxuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ11cbiAgICAgIH1dXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnTWNwUHJvbXB0c0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHdlYkJ1Y2tldCksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRFxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHtcbiAgICAgICAgJy92MS8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMXG4gICAgICAgIH0sXG4gICAgICAgICcvYXV0aCc6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4oYXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTFxuICAgICAgICB9LFxuICAgICAgICAnL3VzZXJzLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKGFwaSksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTExcbiAgICAgICAgfSxcbiAgICAgICAgJy9tY3AvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4oYXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTFxuICAgICAgICB9LFxuICAgICAgICAnL2hlYWx0aCc6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4oYXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEXG4gICAgICAgIH0sXG4gICAgICAgICcvd2ViaG9vay8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbihhcGkpLFxuICAgICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMXG4gICAgICAgIH0sXG4gICAgICAgICcvc3RhdGljLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbihwcm9tcHRzQnVja2V0KSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBFdmVudCBzb3VyY2UgbWFwcGluZ3NcbiAgICBwcm9jZXNzaW5nTGFtYmRhLmFkZEV2ZW50U291cmNlKG5ldyBTcXNFdmVudFNvdXJjZShwcm9jZXNzaW5nUXVldWUsIHtcbiAgICAgIGJhdGNoU2l6ZTogMTBcbiAgICB9KSk7XG5cbiAgICBjYXRhbG9nU3luY0xhbWJkYS5hZGRFdmVudFNvdXJjZShuZXcgU3FzRXZlbnRTb3VyY2UoY2F0YWxvZ1N5bmNRdWV1ZSwge1xuICAgICAgYmF0Y2hTaXplOiAxXG4gICAgfSkpO1xuXG4gICAgLy8gUGVybWlzc2lvbnNcbiAgICBwcm9tcHRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKG1jcFNlcnZlckxhbWJkYSk7XG4gICAgcHJvbXB0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShwcm9jZXNzaW5nTGFtYmRhKTtcbiAgICBwcm9tcHRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNhdGFsb2dTeW5jTGFtYmRhKTtcbiAgICBwcm9tcHRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGF1dGhMYW1iZGEpO1xuICAgIHByb21wdHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodXNlckxhbWJkYSk7XG5cbiAgICBzZXNzaW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShtY3BTZXJ2ZXJMYW1iZGEpO1xuXG4gICAgdXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXV0aExhbWJkYSk7XG4gICAgdXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodXNlckxhbWJkYSk7XG4gICAgdXNlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc3RyaXBlV2ViaG9va0xhbWJkYSk7XG5cbiAgICBwcm9tcHRzQnVja2V0LmdyYW50UmVhZFdyaXRlKG1jcFNlcnZlckxhbWJkYSk7XG4gICAgcHJvbXB0c0J1Y2tldC5ncmFudFJlYWRXcml0ZShwcm9jZXNzaW5nTGFtYmRhKTtcbiAgICBwcm9tcHRzQnVja2V0LmdyYW50UmVhZFdyaXRlKGNhdGFsb2dTeW5jTGFtYmRhKTtcblxuICAgIHVzZXJQcm9tcHRzQnVja2V0LmdyYW50UmVhZFdyaXRlKGF1dGhMYW1iZGEpO1xuICAgIHVzZXJQcm9tcHRzQnVja2V0LmdyYW50UmVhZFdyaXRlKHVzZXJMYW1iZGEpO1xuXG4gICAgcHJvY2Vzc2luZ1F1ZXVlLmdyYW50U2VuZE1lc3NhZ2VzKG1jcFNlcnZlckxhbWJkYSk7XG4gICAgY2F0YWxvZ1N5bmNRdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyhtY3BTZXJ2ZXJMYW1iZGEpO1xuXG4gICAgcHJvY2Vzc2luZ1F1ZXVlLmdyYW50Q29uc3VtZU1lc3NhZ2VzKHByb2Nlc3NpbmdMYW1iZGEpO1xuICAgIGNhdGFsb2dTeW5jUXVldWUuZ3JhbnRDb25zdW1lTWVzc2FnZXMoY2F0YWxvZ1N5bmNMYW1iZGEpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGNsb3Vkd2F0Y2hQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdjbG91ZHdhdGNoOlB1dE1ldHJpY0RhdGEnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSk7XG5cbiAgICBtY3BTZXJ2ZXJMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KGNsb3Vkd2F0Y2hQb2xpY3kpO1xuICAgIHByb2Nlc3NpbmdMYW1iZGEuYWRkVG9Sb2xlUG9saWN5KGNsb3Vkd2F0Y2hQb2xpY3kpO1xuICAgIGNhdGFsb2dTeW5jTGFtYmRhLmFkZFRvUm9sZVBvbGljeShjbG91ZHdhdGNoUG9saWN5KTtcbiAgICBhdXRoTGFtYmRhLmFkZFRvUm9sZVBvbGljeShjbG91ZHdhdGNoUG9saWN5KTtcbiAgICB1c2VyTGFtYmRhLmFkZFRvUm9sZVBvbGljeShjbG91ZHdhdGNoUG9saWN5KTtcblxuICAgIC8vIENvZ25pdG8gcGVybWlzc2lvbnMgZm9yIGF1dGggbGFtYmRhXG4gICAgY29uc3QgY29nbml0b1BvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlcicsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblNldFVzZXJQYXNzd29yZCcsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkluaXRpYXRlQXV0aCcsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblJlc3BvbmRUb0F1dGhDaGFsbGVuZ2UnLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkxpc3RVc2VycycsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pblVwZGF0ZVVzZXJBdHRyaWJ1dGVzJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXVxuICAgIH0pO1xuXG4gICAgYXV0aExhbWJkYS5hZGRUb1JvbGVQb2xpY3koY29nbml0b1BvbGljeSk7XG4gICAgdXNlckxhbWJkYS5hZGRUb1JvbGVQb2xpY3koY29nbml0b1BvbGljeSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVcmwnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJ1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHtkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBVUkwgKFdlYiBBcHApJ1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYkJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogd2ViQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIEJ1Y2tldCBmb3Igd2ViIGFzc2V0cydcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTM0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogcHJvbXB0c0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBCdWNrZXQgZm9yIHByb21wdHMgY2F0YWxvZydcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUHJvbXB0c0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdXNlclByb21wdHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgQnVja2V0IGZvciB1c2VyLXVwbG9hZGVkIHByb21wdHMnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRHluYW1vREJUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogcHJvbXB0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgZm9yIHByb21wdHMnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlcnNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdXNlcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIGZvciB1c2VycydcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2duaXRvVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBJRCdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2duaXRvVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpS2V5Jywge1xuICAgICAgdmFsdWU6IGFwaUtleS5rZXlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgS2V5IElEJ1xuICAgIH0pO1xuICB9XG59XG4iXX0=