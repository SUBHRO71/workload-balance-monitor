# Background workers

The DynamoDB Streams outbox dispatcher sends identifier-only jobs to the encrypted SQS queue; malformed records fail for bounded retry and dead-letter handling. Aggregation, insights, exports, deletion, and notification consumers remain unimplemented. The weekly EventBridge Scheduler schedule is deployed disabled.
