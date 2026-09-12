import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WorkloadMonitorStack } from "../../infra/lib/workload-monitor-stack";

function synthesizeTemplate(): Record<string, unknown> {
  const app = new App();
  const stack = new WorkloadMonitorStack(app, "PrivacyBoundaryTest", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  return Template.fromStack(stack).toJSON() as Record<string, unknown>;
}

describe("AWS privacy boundaries", () => {
  const synthesized = synthesizeTemplate();

  it("does not grant DynamoDB Scan and scopes every data statement by leading key", () => {
    const templateText = JSON.stringify(synthesized);
    expect(templateText).not.toContain("dynamodb:Scan");

    const template = synthesized as { Resources: Record<string, { Type: string; Properties?: unknown }> };
    const policies = Object.values(template.Resources).filter((resource) => resource.Type === "AWS::IAM::Policy");
    const dataStatements = policies.flatMap((resource) => {
      const document = (resource.Properties as { PolicyDocument?: { Statement?: Array<Record<string, unknown>> } })?.PolicyDocument;
      return (document?.Statement ?? []).filter((statement) => {
        const actions = JSON.stringify(statement.Action);
        return actions.includes("dynamodb:GetItem") || actions.includes("dynamodb:Query") || actions.includes("dynamodb:PutItem");
      });
    });
    expect(dataStatements.length).toBeGreaterThan(0);
    for (const statement of dataStatements) {
      expect(JSON.stringify(statement)).toContain("dynamodb:LeadingKeys");
    }
  });

  it("keeps private namespaces out of work and administration policies", () => {
    const template = synthesized as { Resources: Record<string, { Type: string; Properties?: unknown }> };
    const namedPolicies = Object.entries(template.Resources)
      .filter(([, resource]) => resource.Type === "AWS::IAM::Policy")
      .map(([logicalId, resource]) => [logicalId, JSON.stringify(resource.Properties)] as const);
    const workAndAdmin = namedPolicies.filter(([logicalId]) => logicalId.startsWith("WorkFunctionServiceRole") || logicalId.startsWith("AdminFunctionServiceRole"));
    expect(workAndAdmin).toHaveLength(2);
    for (const [, policy] of workAndAdmin) expect(policy).not.toContain("PRIVATE#");
    const workPolicy = workAndAdmin.find(([logicalId]) => logicalId.startsWith("WorkFunctionServiceRole"))?.[1] ?? "";
    const parsed = JSON.parse(workPolicy) as { PolicyDocument: { Statement: Array<{ Action: string[]; Condition?: unknown }> } };
    const writeStatement = parsed.PolicyDocument.Statement.find((statement) => statement.Action.includes("dynamodb:PutItem"));
    expect(JSON.stringify(writeStatement?.Condition)).not.toContain("GRANT#");
    expect(JSON.stringify(writeStatement?.Condition)).not.toContain("SHARE#");
  });

  it("keeps the weekly aggregation schedule disabled until its worker exists", () => {
    const template = synthesized as { Resources: Record<string, { Type: string; Properties?: Record<string, unknown> }> };
    const schedules = Object.values(template.Resources).filter((resource) => resource.Type === "AWS::Scheduler::Schedule");
    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.Properties?.State).toBe("DISABLED");
  });

  it("allows the authenticated organization context header in browser CORS preflights", () => {
    const templateText = JSON.stringify(synthesized);
    expect(templateText).toContain("x-org-id");
    expect(templateText).toContain("http://localhost:5173");
  });
});
