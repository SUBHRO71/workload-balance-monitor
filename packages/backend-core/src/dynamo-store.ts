import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, type NativeAttributeValue } from "@aws-sdk/lib-dynamodb";
import { membershipSchema, teamAssignmentSchema, type Membership, type TeamAssignment } from "@workload/contracts";
import type { AuthorizationStore } from "./authorization";
import { keys } from "./keys";

export interface DynamoEntity { PK: string; SK: string; version?: number; [key: string]: NativeAttributeValue | undefined }

export class WorkloadStore implements AuthorizationStore {
  constructor(readonly tableName: string, readonly client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })) {}

  async getMembership(orgId: string, userId: string): Promise<Membership | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.member(orgId, userId), ConsistentRead: true }));
    return result.Item ? membershipSchema.parse(result.Item) : undefined;
  }

  async listUserMemberships(userId: string): Promise<Membership[]> {
    const prefix = keys.identityOrganizations(userId);
    const pointers = await this.client.send(new QueryCommand({
      TableName: this.tableName, KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK }, ConsistentRead: true,
    }));
    const memberships: Membership[] = [];
    for (const pointer of pointers.Items ?? []) {
      if (typeof pointer.orgId !== "string") continue;
      const membership = await this.getMembership(pointer.orgId, userId);
      if (membership) memberships.push(membership);
    }
    return memberships;
  }

  async getActiveAssignmentsForUser(orgId: string, userId: string): Promise<TeamAssignment[]> {
    const prefix = keys.userTeams(orgId, userId);
    const pointers = await this.client.send(new QueryCommand({
      TableName: this.tableName, KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK }, ConsistentRead: true,
    }));
    const assignments: TeamAssignment[] = [];
    for (const pointer of pointers.Items ?? []) {
      if (typeof pointer.teamId !== "string") continue;
      const canonical = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.teamAssignment(orgId, pointer.teamId, userId), ConsistentRead: true }));
      if (canonical.Item) assignments.push(teamAssignmentSchema.parse(canonical.Item));
    }
    return assignments.filter((assignment) => assignment.status === "active");
  }

  async isManagerOfTeam(orgId: string, teamId: string, managerId: string): Promise<boolean> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.teamManager(orgId, teamId, managerId), ConsistentRead: true }));
    return result.Item?.status === "active";
  }

  async getOwnerEntity<T>(orgId: string, ownerId: string, sortKey: string): Promise<T | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.privateRecord(orgId, ownerId, sortKey), ConsistentRead: true }));
    return result.Item as T | undefined;
  }

  async putVersionedOwnerEntity(entity: DynamoEntity, expectedVersion?: number): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName, Item: entity,
      ConditionExpression: expectedVersion === undefined ? "attribute_not_exists(PK) AND attribute_not_exists(SK)" : "#version = :expectedVersion",
      ExpressionAttributeNames: expectedVersion === undefined ? undefined : { "#version": "version" },
      ExpressionAttributeValues: expectedVersion === undefined ? undefined : { ":expectedVersion": expectedVersion },
    }));
  }

  async transact(items: DynamoEntity[], clientRequestToken: string): Promise<void> {
    if (!items.length || items.length > 100) throw new Error("Transaction must contain 1–100 items");
    await this.client.send(new TransactWriteCommand({
      ClientRequestToken: clientRequestToken,
      TransactItems: items.map((Item) => ({ Put: { TableName: this.tableName, Item, ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)" } })),
    }));
  }
}
