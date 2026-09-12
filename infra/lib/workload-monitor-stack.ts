import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CfnOutput, Duration, RemovalPolicy, Stack, type StackProps,
  aws_apigatewayv2 as apigatewayv2, aws_apigatewayv2_authorizers as authorizers,
  aws_apigatewayv2_integrations as integrations, aws_cognito as cognito,
  aws_dynamodb as dynamodb, aws_scheduler as scheduler,
  aws_iam as iam, aws_lambda as lambda, aws_lambda_event_sources as eventSources,
  aws_lambda_nodejs as lambdaNodejs, aws_logs as logs, aws_s3 as s3, aws_sqs as sqs,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = (...parts: string[]) => path.resolve(here, "..", "..", ...parts);

export class WorkloadMonitorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const table = new dynamodb.Table(this, "WorkloadTable", {
      tableName: `WorkloadMonitor-${this.stackName}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED, readCapacity: 5, writeCapacity: 5,
      encryption: dynamodb.TableEncryption.AWS_MANAGED, stream: dynamodb.StreamViewType.NEW_IMAGE,
      timeToLiveAttribute: "ttl", pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const deadLetterQueue = new sqs.Queue(this, "JobDeadLetterQueue", { encryption: sqs.QueueEncryption.SQS_MANAGED, retentionPeriod: Duration.days(14) });
    const jobQueue = new sqs.Queue(this, "JobQueue", {
      encryption: sqs.QueueEncryption.SQS_MANAGED, visibilityTimeout: Duration.minutes(6),
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 5 },
    });
    const privateExportBucket = new s3.Bucket(this, "PrivateExportBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true, objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [{ id: "ExpireOwnerExports", expiration: Duration.days(1), prefix: "owner-exports/" }],
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false, signInAliases: { email: true }, autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: { minLength: 12, requireDigits: true, requireLowercase: true, requireUppercase: true, requireSymbols: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    for (const groupName of ["member", "manager", "hr", "org_admin"]) {
      new cognito.CfnUserPoolGroup(this, `Group${groupName.replace("_", "")}`, { userPoolId: userPool.userPoolId, groupName });
    }
    const readScope = new cognito.ResourceServerScope({ scopeName: "read", scopeDescription: "Read authorized workload resources" });
    const apiResource = userPool.addResourceServer("ApiResource", { identifier: "workload-monitor", scopes: [readScope] });
    const oauth: cognito.OAuthSettings = {
      flows: { authorizationCodeGrant: true },
      scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE, cognito.OAuthScope.resourceServer(apiResource, readScope)],
      callbackUrls: ["http://localhost:5173/auth/callback", "workloadbalance://auth/callback"],
      logoutUrls: ["http://localhost:5173/", "workloadbalance://sign-out"],
    };
    const webClient = userPool.addClient("WebClient", { generateSecret: false, authFlows: { userSrp: true, userPassword: true }, oAuth: oauth, preventUserExistenceErrors: true });
    const mobileClient = userPool.addClient("MobileClient", { generateSecret: false, authFlows: { userSrp: true, userPassword: true }, oAuth: oauth, preventUserExistenceErrors: true });
    const userPoolDomain = userPool.addDomain("HostedDomain", { cognitoDomain: { domainPrefix: `workload-monitor-${this.account}` } });

    const defaults: Partial<lambdaNodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_24_X, memorySize: 256, timeout: Duration.seconds(15),
      bundling: { minify: true, sourceMap: true },
      environment: { TABLE_NAME: table.tableName },
    };
    const createFunction = (name: string, entry: string, functionName: string) => new lambdaNodejs.NodejsFunction(this, name, {
      ...defaults, entry: source(entry), handler: "handler", functionName,
      logGroup: new logs.LogGroup(this, `${name}Logs`, { logGroupName: `/aws/lambda/${functionName}`, retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
    });
    const healthFunction = createFunction("HealthFunction", "services/api/src/health.ts", "workload-monitor-development-health");
    const personalFunction = createFunction("PersonalFunction", "services/api/src/personal.ts", "workload-monitor-development-personal");
    const workFunction = createFunction("WorkFunction", "services/api/src/work.ts", "workload-monitor-development-work");
    const adminFunction = createFunction("AdminFunction", "services/api/src/admin.ts", "workload-monitor-development-admin");
    const outboxLogGroup = new logs.LogGroup(this, "OutboxDispatcherLogs", {
      logGroupName: "/aws/lambda/workload-monitor-development-outbox", retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY,
    });
    const outboxFunction = new lambdaNodejs.NodejsFunction(this, "OutboxDispatcher", {
      ...defaults, entry: source("services/workers/src/outbox-dispatcher.ts"), handler: "handler",
      functionName: "workload-monitor-development-outbox", logGroup: outboxLogGroup,
      environment: { TABLE_NAME: table.tableName, JOB_QUEUE_URL: jobQueue.queueUrl },
    });
    const jobWorkerLogGroup = new logs.LogGroup(this, "JobWorkerLogs", {
      logGroupName: "/aws/lambda/workload-monitor-development-job-worker", retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY,
    });
    const jobWorkerFunction = new lambdaNodejs.NodejsFunction(this, "JobWorker", {
      ...defaults, entry: source("services/workers/src/job-worker.ts"), handler: "handler",
      functionName: "workload-monitor-development-job-worker", logGroup: jobWorkerLogGroup,
      environment: { TABLE_NAME: table.tableName, EXPORT_BUCKET_NAME: privateExportBucket.bucketName },
    });
    jobWorkerFunction.addEventSource(new eventSources.SqsEventSource(jobQueue, { batchSize: 5 }));

    this.addDynamoPermissions(
      personalFunction, table,
      ["PRIVATE#*", "IDENTITY#*", "DIRECTORY#*", "OWNERGRANTS#*", "GRANT#*", "SHARESTATE#*", "SHARE#*", "INBOX#*", "OUTBOX#*", "REQUEST#*", "NOTICE#*"],
      ["PRIVATE#*", "OWNERGRANTS#*", "GRANT#*", "SHARESTATE#*", "SHARE#*", "INBOX#*", "OUTBOX#*", "REQUEST#*", "NOTICE#*"],
    );
    this.addDynamoPermissions(
      workFunction, table,
      ["DIRECTORY#*", "GRANT#*", "SHARESTATE#*", "SHARE#*", "INBOX#*", "TEAMVIEW#*", "ORGVIEW#*", "POLICY#*", "ACTION#*", "ACCESSAUDIT#*", "NOTICE#*"],
      ["ACTION#*", "ACCESSAUDIT#*", "NOTICE#*"],
    );
    this.addDynamoPermissions(
      adminFunction, table,
      ["DIRECTORY#*", "IDENTITY#*", "POLICY#*", "ADMINAUDIT#*", "TEAMVIEW#*", "ORGVIEW#*"],
      ["DIRECTORY#*", "IDENTITY#*", "POLICY#*", "ADMINAUDIT#*", "TEAMVIEW#*", "ORGVIEW#*"],
    );
    this.addDynamoPermissions(
      jobWorkerFunction, table,
      ["PRIVATE#*", "DIRECTORY#*", "IDENTITY#*", "OWNERGRANTS#*", "GRANT#*", "SHARE#*", "SHARESTATE#*", "INBOX#*", "TEAMVIEW#*", "ORGVIEW#*", "POLICY#*", "NOTICE#*", "ADMINAUDIT#*", "OUTBOX#*"],
      ["PRIVATE#*", "DIRECTORY#*", "IDENTITY#*", "OWNERGRANTS#*", "GRANT#*", "SHARE#*", "SHARESTATE#*", "INBOX#*", "TEAMVIEW#*", "ORGVIEW#*", "POLICY#*", "NOTICE#*", "ADMINAUDIT#*", "OUTBOX#*"],
    );
    privateExportBucket.grantReadWrite(jobWorkerFunction);
    privateExportBucket.grantRead(personalFunction);
    personalFunction.addEnvironment("EXPORT_BUCKET_NAME", privateExportBucket.bucketName);

    jobQueue.grantSendMessages(outboxFunction);
    outboxFunction.addEventSource(new eventSources.DynamoEventSource(table as unknown as dynamodb.ITable, {
      startingPosition: lambda.StartingPosition.LATEST, batchSize: 10, retryAttempts: 3, bisectBatchOnError: true,
      filters: [lambda.FilterCriteria.filter({ eventName: lambda.FilterRule.isEqual("INSERT"), dynamodb: { NewImage: { entityType: { S: lambda.FilterRule.isEqual("OUTBOX_EVENT") } } } })],
    }));

    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      apiName: "workload-monitor-development",
      corsPreflight: {
        allowOrigins: ["http://localhost:5173"], allowHeaders: ["authorization", "content-type", "idempotency-key", "x-org-id"],
        allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.PUT, apigatewayv2.CorsHttpMethod.PATCH, apigatewayv2.CorsHttpMethod.DELETE, apigatewayv2.CorsHttpMethod.OPTIONS], maxAge: Duration.hours(1),
      },
    });
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer("CognitoJwt", `https://cognito-idp.${this.region}.${this.urlSuffix}/${userPool.userPoolId}`, { jwtAudience: [webClient.userPoolClientId, mobileClient.userPoolClientId] });
    const healthIntegration = new integrations.HttpLambdaIntegration("HealthIntegration", healthFunction);
    const authenticatedMethods = [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.PUT, apigatewayv2.HttpMethod.PATCH, apigatewayv2.HttpMethod.DELETE];
    httpApi.addRoutes({ path: "/health", methods: [apigatewayv2.HttpMethod.GET], integration: healthIntegration });
    const corsPaths = ["/v1/me", "/v1/me/{proxy+}", "/v1/invitations/{proxy+}", "/v1/manager", "/v1/manager/{proxy+}", "/v1/hr", "/v1/hr/{proxy+}", "/v1/admin", "/v1/admin/{proxy+}"];
    for (const [index, path] of corsPaths.entries()) {
      httpApi.addRoutes({ path, methods: [apigatewayv2.HttpMethod.OPTIONS], integration: healthIntegration });
      const integration = path.startsWith("/v1/me") || path.startsWith("/v1/invitations")
        ? new integrations.HttpLambdaIntegration(`PersonalIntegration${index}`, personalFunction)
        : path.startsWith("/v1/admin")
          ? new integrations.HttpLambdaIntegration(`AdminIntegration${index}`, adminFunction)
          : new integrations.HttpLambdaIntegration(`WorkIntegration${index}`, workFunction);
      httpApi.addRoutes({ path, methods: authenticatedMethods, integration, authorizer: jwtAuthorizer, authorizationScopes: ["workload-monitor/read"] });
    }

    const schedulerRole = new iam.Role(this, "WeeklyAggregationSchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      description: "Allows the disabled weekly aggregation schedule to enqueue one identifier-only job",
    });
    schedulerRole.addToPolicy(new iam.PolicyStatement({ actions: ["sqs:SendMessage"], resources: [jobQueue.queueArn] }));
    new scheduler.CfnSchedule(this, "WeeklyAggregationFoundation", {
      description: "Disabled until Phase 4 aggregation workers are implemented",
      flexibleTimeWindow: { mode: "OFF" },
      scheduleExpression: `rate(${Duration.days(7).toDays()} days)`,
      state: "DISABLED",
      target: {
        arn: jobQueue.queueArn,
        roleArn: schedulerRole.roleArn,
        input: JSON.stringify({ jobType: "aggregation.not-enabled", schemaVersion: 1 }),
      },
    });
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "WebClientId", { value: webClient.userPoolClientId });
    new CfnOutput(this, "MobileClientId", { value: mobileClient.userPoolClientId });
    new CfnOutput(this, "HostedUiBaseUrl", { value: userPoolDomain.baseUrl() });
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "JobQueueUrl", { value: jobQueue.queueUrl });
    new CfnOutput(this, "ExportBucketName", { value: privateExportBucket.bucketName });
  }

  private addDynamoPermissions(target: lambda.Function, table: dynamodb.Table, readKeys: string[], writeKeys: string[]): void {
    target.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Query", "dynamodb:TransactGetItems"],
      resources: [table.tableArn], conditions: { "ForAllValues:StringLike": { "dynamodb:LeadingKeys": readKeys } },
    }));
    target.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:TransactWriteItems"],
      resources: [table.tableArn], conditions: { "ForAllValues:StringLike": { "dynamodb:LeadingKeys": writeKeys } },
    }));
  }
}
