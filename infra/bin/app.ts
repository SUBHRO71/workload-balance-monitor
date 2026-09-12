import { App } from "aws-cdk-lib";
import { WorkloadMonitorStack } from "../lib/workload-monitor-stack";

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
new WorkloadMonitorStack(app, "WorkloadMonitorDevelopment", {
  env: { ...(account ? { account } : {}), region: process.env.CDK_DEFAULT_REGION ?? "us-east-1" },
  description: "Development foundation for the privacy-first Workload Balance Monitor",
});
