import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { DynamoDBStreamHandler } from "aws-lambda";

const queueUrl = process.env.JOB_QUEUE_URL;
if (!queueUrl) throw new Error("JOB_QUEUE_URL is required");
const sqs = new SQSClient({});

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" || record.dynamodb?.NewImage?.entityType?.S !== "OUTBOX_EVENT") continue;
    const jobId = record.dynamodb.NewImage.jobId?.S;
    const jobType = record.dynamodb.NewImage.jobType?.S;
    const targetId = record.dynamodb.NewImage.targetId?.S;
    const schemaVersion = record.dynamodb.NewImage.schemaVersion?.N;
    if (!jobId || !jobType || !targetId || !schemaVersion) throw new Error("Outbox event is missing safe job metadata");
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify({ jobId, jobType, targetId, schemaVersion: Number(schemaVersion) }) }));
  }
};
