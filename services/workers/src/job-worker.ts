import type { SQSHandler } from "aws-lambda";
import { WorkloadStore } from "@workload/backend-core";
import { processAggregateJob, type AggregateJobPayload } from "./jobs/aggregate";
import { processLifecycleJob, type LifecycleJobPayload } from "./jobs/lifecycle";

const tableName = process.env.TABLE_NAME;
const store = tableName ? new WorkloadStore(tableName) : undefined;

export const handler: SQSHandler = async (event) => {
  if (!store) throw new Error("TABLE_NAME is required");
  for (const record of event.Records) {
    let payload: { jobType: string; targetId: string; expectedDisclosureGeneration?: number };
    try {
      payload = JSON.parse(record.body) as { jobType: string; targetId: string };
    } catch {
      // Throw so SQS redrive/DLQ policy handles malformed work; never log private payloads.
      throw new Error("Malformed SQS message body");
    }

    if (
      payload.jobType === "team.aggregate" ||
      payload.jobType === "org.aggregate" ||
      payload.jobType === "publication.invalidate"
    ) {
      await processAggregateJob(store, payload as AggregateJobPayload);
    } else if (
      payload.jobType === "owner.export" ||
      payload.jobType === "owner.delete" ||
      payload.jobType === "lifecycle.schedule"
    ) {
      await processLifecycleJob(store, payload as LifecycleJobPayload);
    } else {
      throw new Error(`Unsupported worker job type: ${payload.jobType}`);
    }
  }
};
