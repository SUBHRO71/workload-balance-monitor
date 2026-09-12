import { Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";

export class WorkloadMonitorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // Intentionally no service resources yet. Review authorization and consent
    // implementation before adding public routes, schedules, or notifications.
  }
}
