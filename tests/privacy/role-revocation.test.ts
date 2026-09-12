import { describe, expect, it } from "vitest";
import { AuthorizationError, WorkloadStore, requireRole } from "../../packages/backend-core/src/index";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { keys } from "../../packages/backend-core/src/keys";

describe("current membership beats stale token claims", () => {
  it("denies a role immediately after membership role removal", async () => {
    const client = createInMemoryDynamoClient();
    const store = new WorkloadStore("test-table", client);
    await client.send(new PutCommand({
      TableName: "test-table",
      Item: { ...keys.member("org-1", "manager-1"), orgId: "org-1", userId: "manager-1", email: "manager@example.invalid", displayName: "Manager", roles: ["manager"], status: "active", membershipVersion: 1 },
    }));
    const caller = { userId: "manager-1", tokenGroups: ["manager"] };
    await expect(requireRole(store, caller, "org-1", "manager")).resolves.toBeDefined();
    await store.updateMember("org-1", "manager-1", { roles: ["member"] }, { userId: "admin-1", tokenGroups: [] });
    await expect(requireRole(store, caller, "org-1", "manager")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("denies an inactive member despite a valid-looking token", async () => {
    const client = createInMemoryDynamoClient();
    const store = new WorkloadStore("test-table", client);
    await client.send(new PutCommand({
      TableName: "test-table",
      Item: { ...keys.member("org-1", "hr-1"), orgId: "org-1", userId: "hr-1", email: "hr@example.invalid", displayName: "HR", roles: ["hr"], status: "active", membershipVersion: 1 },
    }));
    await store.updateMember("org-1", "hr-1", { status: "inactive" }, { userId: "admin-1", tokenGroups: [] });
    await expect(requireRole(store, { userId: "hr-1", tokenGroups: ["hr"] }, "org-1", "hr")).rejects.toBeInstanceOf(AuthorizationError);
  });
});
