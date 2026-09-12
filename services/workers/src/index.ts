import type { SQSHandler } from "aws-lambda";

// Throw rather than acknowledge and discard work before processing is implemented.
// This handler is not attached to a live queue.
export const handler: SQSHandler = async () => {
  throw new Error("Worker processing is not configured.");
};
