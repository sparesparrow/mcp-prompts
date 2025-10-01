#!/usr/bin/env node

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
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

export interface McpPromptsSecurityStackProps extends cdk.StackProps {
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
}

export class McpPromptsSecurityStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: ecs.Cluster;
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;
  public readonly api: apigateway.RestApi;
  public readonly userPool: cognito.UserPool;
  public readonly secrets: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: McpPromptsSecurityStackProps) {
    super(scope, id, props);

    // 1. VPC with private subnets for security
    this.vpc = new ec2.Vpc(this, 'McpPromptsVpc', {
      maxAzs: 2,
      natGateways: 1, // Cost optimization
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });

    // 2. VPC Endpoints for AWS services (security enhancement)
    this.createVpcEndpoints();

    // 3. Secrets Manager for sensitive data
    this.secrets = new secretsmanager.Secret(this, 'McpPromptsSecrets', {
      secretName: 'mcp-prompts/secrets',
      description: 'Secrets for MCP Prompts application',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          stripeSecretKey: 'sk_test_...',
          stripeWebhookSecret: 'whsec_...',
          jwtSecret: 'your-jwt-secret-here'
        }),
        generateStringKey: 'randomKey',
        excludeCharacters: '"@/\\'
      }
    });

    // 4. SSL Certificate (if domain provided)
    let certificate: acm.ICertificate | undefined;
    if (props.certificateArn) {
      certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn);
    } else if (props.domainName) {
      certificate = new acm.Certificate(this, 'Certificate', {
        domainName: props.domainName,
        subjectAlternativeNames: [`*.${props.domainName}`],
        validation: acm.CertificateValidation.fromDns()
      });
    }

    // 5. ECS Cluster for containerized deployment
    this.cluster = new ecs.Cluster(this, 'McpPromptsCluster', {
      vpc: this.vpc,
      clusterName: 'mcp-prompts-cluster',
      containerInsights: true
    });

    // 6. ECR Repository for container images
    const ecrRepo = new ecr.Repository(this, 'McpPromptsEcrRepo', {
      repositoryName: 'mcp-prompts',
      imageScanOnPush: true,
      lifecycleRules: [{
        maxImageCount: 10,
        rulePriority: 1
      }]
    });

    // 7. ECS Task Role with minimal permissions
    const taskRole = new iam.Role(this, 'McpPromptsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for MCP Prompts ECS tasks',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // 8. ECS Task Definition with security best practices
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'McpPromptsTaskDef', {
      family: 'mcp-prompts',
      cpu: 512,
      memoryLimitMiB: 1024,
      taskRole,
      executionRole: new iam.Role(this, 'McpPromptsExecutionRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
        ]
      })
    });

    // 9. Container with security configurations
    const container = taskDefinition.addContainer('mcp-prompts', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      memoryLimitMiB: 1024,
      cpu: 512,
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        STORAGE_TYPE: 'aws'
      },
      secrets: {
        AWS_ACCESS_KEY_ID: ecs.Secret.fromSecretsManager(this.secrets, 'aws_access_key_id'),
        AWS_SECRET_ACCESS_KEY: ecs.Secret.fromSecretsManager(this.secrets, 'aws_secret_access_key'),
        STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(this.secrets, 'stripe_secret_key'),
        STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(this.secrets, 'stripe_webhook_secret'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(this.secrets, 'jwt_secret')
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'mcp-prompts',
        logRetention: logs.RetentionDays.ONE_MONTH
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3003/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60)
      }
    });

    container.addPortMappings({
      containerPort: 3003,
      protocol: ecs.Protocol.TCP
    });

    // 10. Fargate Service with security groups
    const securityGroup = new ec2.SecurityGroup(this, 'McpPromptsSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for MCP Prompts service',
      allowAllOutbound: false
    });

    // Allow HTTPS traffic
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Allow HTTP traffic (redirected to HTTPS)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    // Allow internal communication
    securityGroup.addIngressRule(
      ec2.Peer.securityGroupId(securityGroup.securityGroupId),
      ec2.Port.allTraffic(),
      'Allow internal communication'
    );

    // Allow outbound HTTPS to AWS services
    securityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS to AWS services'
    );

    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'McpPromptsService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 2, // High availability
      publicLoadBalancer: true,
      securityGroups: [securityGroup],
      certificate,
      domainName: props.domainName,
      domainZone: props.hostedZoneId ? 
        route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
          hostedZoneId: props.hostedZoneId,
          zoneName: props.domainName!
        }) : undefined,
      redirectHTTP: true, // Redirect HTTP to HTTPS
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      enableLogging: true
    });

    // 11. Enhanced Cognito User Pool with security features
    this.userPool = new cognito.UserPool(this, 'McpPromptsUserPool', {
      userPoolName: 'mcp-prompts-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7)
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        },
        givenName: {
          required: true,
          mutable: true
        },
        familyName: {
          required: true,
          mutable: true
        }
      },
      customAttributes: {
        subscriptionTier: new cognito.StringAttribute({
          minLen: 1,
          maxLen: 20,
          mutable: true
        }),
        subscriptionExpiresAt: new cognito.DateTimeAttribute({
          mutable: true
        })
      },
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      userVerification: {
        emailSubject: 'Verify your email for MCP Prompts',
        emailBody: 'Please verify your email by clicking the link: {##Verify Email##}',
        emailStyle: cognito.VerificationEmailStyle.LINK
      }
    });

    // 12. User Pool Client with security settings
    const userPoolClient = new cognito.UserPoolClient(this, 'McpPromptsUserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true
      },
      generateSecret: true, // Enable client secret for additional security
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO]
    });

    // 13. DynamoDB Tables with encryption and backup
    const promptsTable = new dynamodb.Table(this, 'PromptsTable', {
      tableName: 'mcp-prompts',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // 14. S3 Buckets with encryption and access logging
    const promptsBucket = new s3.Bucket(this, 'PromptsBucket', {
      bucketName: `mcp-prompts-catalog-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessLoggingPrefix: 'access-logs/',
      serverAccessLogsBucket: new s3.Bucket(this, 'AccessLogsBucket', {
        bucketName: `mcp-prompts-access-logs-${this.account}-${this.region}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        lifecycleRules: [{
          id: 'DeleteOldLogs',
          expiration: cdk.Duration.days(90)
        }]
      }),
      lifecycleRules: [{
        id: 'DeleteOldVersions',
        noncurrentVersionExpiration: cdk.Duration.days(30)
      }]
    });

    // 15. API Gateway with enhanced security
    this.api = new apigateway.RestApi(this, 'McpPromptsApi', {
      restApiName: 'MCP Prompts Service',
      description: 'Secure API for MCP Prompts with AWS backend',
      defaultCorsPreflightOptions: {
        allowOrigins: props.domainName ? [`https://${props.domainName}`] : ['*'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        maxAge: cdk.Duration.seconds(86400)
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL]
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['*'],
            conditions: {
              StringNotEquals: {
                'aws:SourceIp': ['0.0.0.0/0'] // Restrict to specific IPs in production
              }
            }
          })
        ]
      })
    });

    // 16. WAF for API Gateway (if available)
    // Note: WAF is not directly supported in CDK v2, but can be added via custom resources

    // 17. CloudWatch Alarms for security monitoring
    this.createSecurityAlarms();

    // 18. Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID for MCP Prompts'
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepo.repositoryUri,
      description: 'ECR Repository URI'
    });

    new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
      value: this.service.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS Name'
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    });

    new cdk.CfnOutput(this, 'SecretsArn', {
      value: this.secrets.secretArn,
      description: 'Secrets Manager ARN'
    });
  }

  private createVpcEndpoints(): void {
    // VPC Endpoints for AWS services to keep traffic within VPC
    const vpcEndpoints = [
      { service: ec2.VpcEndpointAwsService.DYNAMODB, name: 'DynamoDB' },
      { service: ec2.VpcEndpointAwsService.S3, name: 'S3' },
      { service: ec2.VpcEndpointAwsService.SECRETS_MANAGER, name: 'SecretsManager' },
      { service: ec2.VpcEndpointAwsService.CLOUDWATCH_LOGS, name: 'CloudWatchLogs' },
      { service: ec2.VpcEndpointAwsService.ECR, name: 'ECR' },
      { service: ec2.VpcEndpointAwsService.ECR_DOCKER, name: 'ECRDocker' }
    ];

    vpcEndpoints.forEach(({ service, name }) => {
      new ec2.VpcEndpoint(this, `${name}VpcEndpoint`, {
        vpc: this.vpc,
        service,
        subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
        privateDnsEnabled: true
      });
    });
  }

  private createSecurityAlarms(): void {
    // CloudWatch Alarms for security monitoring
    const alarms = [
      {
        name: 'HighErrorRate',
        description: 'High error rate in API Gateway',
        metric: this.api.metricClientError(),
        threshold: 10,
        evaluationPeriods: 2
      },
      {
        name: 'HighLatency',
        description: 'High latency in API Gateway',
        metric: this.api.metricLatency(),
        threshold: 5000, // 5 seconds
        evaluationPeriods: 2
      }
    ];

    alarms.forEach(({ name, description, metric, threshold, evaluationPeriods }) => {
      new cdk.aws_cloudwatch.Alarm(this, `${name}Alarm`, {
        alarmName: `mcp-prompts-${name.toLowerCase()}`,
        alarmDescription: description,
        metric,
        threshold,
        evaluationPeriods,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING
      });
    });
  }
}
