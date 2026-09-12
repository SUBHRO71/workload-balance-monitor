import { describe, expect, it } from "vitest";
import { AuthorizationError, WorkloadStore } from "../../packages/backend-core/src/index";
import { createInMemoryDynamoClient } from "./in-memory-dynamo";

describe("invitation lifecycle", () => {
  it("binds acceptance to the invited email and token, and safely replays for the same user", async () => {
    const store = new WorkloadStore("test-table", createInMemoryDynamoClient());
    const invite = await store.createInvitation(
      "org-1",
      { email: "alice@example.invalid", roles: ["member"] },
      { userId: "admin-1", tokenGroups: ["org_admin"] },
    );

    expect(invite.token).toBeDefined();
    expect((await store.listInvitations("org-1"))[0]?.tokenHash).toBeUndefined();

    await expect(store.acceptInvitation("org-1", {
      invitationId: invite.id,
      displayName: "Bob",
      token: invite.token,
    }, { userId: "bob-1", email: "bob@example.invalid" })).rejects.toMatchObject({ statusCode: 403 });

    const accepted = await store.acceptInvitation("org-1", {
      invitationId: invite.id,
      displayName: "Alice",
      token: invite.token,
    }, { userId: "alice-1", email: "alice@example.invalid" });
    expect(accepted.status).toBe("active");
    expect(accepted.email).toBe("alice@example.invalid");

    const replay = await store.acceptInvitation("org-1", {
      invitationId: invite.id,
      displayName: "Alice Changed",
      token: invite.token,
    }, { userId: "alice-1", email: "alice@example.invalid" });
    expect(replay.userId).toBe("alice-1");

    await expect(store.acceptInvitation("org-1", {
      invitationId: invite.id,
      displayName: "Alice",
      token: invite.token,
    }, { userId: "alice-2", email: "alice@example.invalid" })).rejects.toBeInstanceOf(AuthorizationError);
  });
});
