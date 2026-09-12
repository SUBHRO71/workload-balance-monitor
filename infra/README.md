# Infrastructure

`pnpm infra:synth` synthesizes the Phase 1 development stack. `pnpm --filter @workload/infra exec cdk diff WorkloadMonitorDevelopment` reviews it, and `cdk deploy` changes AWS.

`WorkloadMonitorDevelopment` is deployed in `us-east-1`. It provisions Cognito, a 5 RCU/5 WCU DynamoDB table with TTL and Streams, separate namespace-scoped Lambda roles, an HTTP API with a Cognito JWT authorizer, SQS with a dead-letter queue, identifier-only outbox dispatch, a private S3 export bucket with one-day object expiry, 30-day Lambda logs, and a disabled weekly EventBridge Scheduler schedule. Only `/health` and `/v1/me` are routed. Do not load real employee data before the remaining privacy release gates are complete.
