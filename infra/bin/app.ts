import { App } from "aws-cdk-lib";
import { WorkloadMonitorStack } from "../lib/workload-monitor-stack";

const app = new App();
new WorkloadMonitorStack(app, "WorkloadMonitorDevelopment");
