import { Buffer } from "node:buffer";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type NativeAttributeValue,
} from "@aws-sdk/lib-dynamodb";
import {
  adminAuditRecordSchema,
  aggregateResponseSchema,
  accessAuditRecordSchema,
  checkInRecordSchema,
  consentRecordSchema,
  correctionRecordSchema,
  deletionRequestSchema,
  exportRequestSchema,
  humanActionRecordSchema,
  invitationRecordSchema,
  lifecycleJobRecordSchema,
  membershipSchema,
  notificationPreferencesSchema,
  notificationRecordSchema,
  observationSchema,
  organizationPolicySchema,
  ownerExportDataSchema,
  privateItemRecordSchema,
  publicationSchema,
  sharingGrantSchema,
  taskRecordSchema,
  teamAssignmentSchema,
  teamRecordSchema,
  workloadPreferencesSchema,
  type AcceptInvitationInput,
  type AdminAuditRecord,
  type AggregateResponse,
  type AccessAuditRecord,
  type CheckInInput,
  type CheckInRecord,
  type CheckInUpdate,
  type ConsentRecord,
  type ConsentScopes,
  type CorrectionInput,
  type CorrectionRecord,
  type DateRange,
  type DeletionRequest,
  type EvidenceStrength,
  type ExportRequest,
  type ExportScope,
  type HumanActionInput,
  type HumanActionRecord,
  type HumanActionUpdate,
  type InvitationInput,
  type InvitationRecord,
  type LifecycleJobRecord,
  type Membership,
  type MemberUpdate,
  type NotificationCategory,
  type NotificationPreferences,
  type NotificationRecord,
  type NotificationUpdate,
  type Observation,
  type ObservationUpdate,
  type OrganizationPolicy,
  type OwnerExportData,
  type PolicyPatch,
  type PrivateItemInput,
  type PrivateItemRecord,
  type PrivateItemUpdate,
  type Publication,
  type SharingGrant,
  type SharingGrantInput,
  type TaskInput,
  type TaskRecord,
  type TaskUpdate,
  type TeamAssignment,
  type TeamInput,
  type TeamRecord,
  type WorkloadPreferences,
  type WorkloadPreferencesUpdate,
} from "@workload/contracts";
import {
  calculateWeeklyWorkload,
  contributorCountBand,
  evaluateMeanDisclosure,
  generatePersonalInsights,
  isDateInRange,
  privateItemDeleteAfter,
  projectCheckInValues,
  projectSummaryValues,
  projectTaskValues,
  PROPOSED_MINIMUM_CONTRIBUTORS,
  type CheckInShareField,
  type ContributorMetric,
  type DisclosureDecision,
  type PersonalInsight,
  type SummaryShareField,
  type TaskShareField,
  type WeeklyWorkloadPoint,
} from "@workload/domain";
import {
  AuthorizationError,
  requireManagerPublication,
  requireRole,
  requireTeamManager,
  type AuthorizationStore,
  type CallerIdentity,
} from "./authorization";
import { keys } from "./keys";

export interface DynamoEntity { PK: string; SK: string; version?: number; [key: string]: NativeAttributeValue | undefined }

function requestFingerprint(operation: string, idempotencyKey: string, input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ operation, idempotencyKey, input }))
    .digest("hex");
}

function idempotencyKeyHash(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey).digest("hex");
}

function validateIdempotencyKey(value: string): string {
  if (!/^[A-Za-z0-9._~-]{1,128}$/.test(value)) throw new AuthorizationError("Invalid idempotency key", 400);
  return value;
}

function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AuthorizationError("Page limit must be an integer from 1 to 100", 400);
  return limit;
}

function decodeCursor(cursor: string | undefined, expectedPk: string, expectedSkPrefix: string): Record<string, string> | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof decoded.PK !== "string" || typeof decoded.SK !== "string" || decoded.PK !== expectedPk || !decoded.SK.startsWith(expectedSkPrefix)) {
      throw new Error("Cursor scope mismatch");
    }
    return { PK: decoded.PK, SK: decoded.SK };
  } catch {
    throw new AuthorizationError("Cursor is invalid or belongs to another collection", 400);
  }
}

function cleanItem<T extends Record<string, unknown>>(item: T): Record<string, unknown> {
  const rest = { ...item };
  delete rest.PK;
  delete rest.SK;
  return rest;
}

export class WorkloadStore implements AuthorizationStore {
  constructor(
    readonly tableName: string,
    readonly client: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({}),
      { marshallOptions: { removeUndefinedValues: true } },
    ),
  ) {}

  async getMembership(orgId: string, userId: string): Promise<Membership | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.member(orgId, userId), ConsistentRead: true }));
    return result.Item ? membershipSchema.parse(cleanItem(result.Item)) : undefined;
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

  async updateProfile(orgId: string, userId: string, displayName: string): Promise<Membership> {
    const current = await this.getMembership(orgId, userId);
    if (!current) throw new AuthorizationError("Membership not found", 404);
    const updated: Membership = { ...current, displayName, membershipVersion: current.membershipVersion + 1 };
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.member(orgId, userId), ...updated } }));
    return updated;
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
      if (canonical.Item) assignments.push(teamAssignmentSchema.parse(cleanItem(canonical.Item)));
    }
    return assignments.filter((assignment) => assignment.status === "active");
  }

  async isManagerOfTeam(orgId: string, teamId: string, managerId: string): Promise<boolean> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.teamManager(orgId, teamId, managerId), ConsistentRead: true }));
    return result.Item?.status === "active";
  }

  async getConsent(orgId: string, userId: string): Promise<ConsentRecord> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.consent(orgId, userId), ConsistentRead: true }));
    if (result.Item) return consentRecordSchema.parse(cleanItem(result.Item));
    const now = new Date().toISOString();
    return {
      entityType: "CONSENT", personalProcessing: false, teamAggregation: false, organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false }, effectiveAt: now,
      schemaVersion: 1, version: 1, createdAt: now, updatedAt: now,
    };
  }

  async putConsent(orgId: string, userId: string, scopes: ConsentScopes): Promise<ConsentRecord> {
    const previous = await this.getConsent(orgId, userId);
    const now = new Date().toISOString();
    const updated: ConsentRecord = {
      ...scopes, entityType: "CONSENT", effectiveAt: now, schemaVersion: 1, version: previous.version + 1,
      createdAt: previous.createdAt, updatedAt: now,
    };
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.consent(orgId, userId), ...updated } }));
    if (!updated.teamAggregation || !updated.organizationAggregation) {
      const userAssignments = await this.getActiveAssignmentsForUser(orgId, userId);
      for (const assignment of userAssignments) {
        await this.invalidateAggregateReleases(orgId, assignment.teamId);
      }
      await this.invalidateAggregateReleases(orgId);
      await this.saveOutboxEvent(0, "publication.invalidate", `${orgId}#${userId}`);
    }
    return updated;
  }

  async requirePersonalConsent(orgId: string, userId: string): Promise<ConsentRecord> {
    const consent = await this.getConsent(orgId, userId);
    if (!consent.personalProcessing) throw new AuthorizationError("Personal processing consent is not enabled", 403);
    return consent;
  }

  async getPreferences(orgId: string, userId: string): Promise<WorkloadPreferences> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.preferences(orgId, userId), ConsistentRead: true }));
    if (result.Item) {
      const item = cleanItem(result.Item);
      delete item.entityType;
      return workloadPreferencesSchema.parse(item);
    }
    return { timezone: "UTC", workdays: [1, 2, 3, 4, 5] };
  }

  async putPreferences(orgId: string, userId: string, update: WorkloadPreferencesUpdate): Promise<WorkloadPreferences> {
    const current = await this.getPreferences(orgId, userId);
    const updated: WorkloadPreferences = workloadPreferencesSchema.parse({ ...current, ...update });
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.preferences(orgId, userId), ...updated, entityType: "PREFERENCES" } }));
    return updated;
  }

  async createTask(orgId: string, userId: string, input: TaskInput, idempotencyKey?: string): Promise<TaskRecord> {
    await this.requirePersonalConsent(orgId, userId);
    const requestKey = idempotencyKey ? validateIdempotencyKey(idempotencyKey) : undefined;
    const requestHash = requestKey ? requestFingerprint("create-task", requestKey, input) : undefined;
    const requestKeyHash = requestKey ? idempotencyKeyHash(requestKey) : undefined;
    if (requestKey && requestHash && requestKeyHash) {
      const previous = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.idempotency(orgId, userId, requestKeyHash), ConsistentRead: true }));
      if (previous.Item) {
        if (previous.Item.requestHash !== requestHash) throw new AuthorizationError("Idempotency key was reused with different input", 409);
        return taskRecordSchema.parse(previous.Item.result);
      }
    }
    const id = `task-${randomUUID()}`;
    const now = new Date().toISOString();
    const task: TaskRecord = {
      ...input, entityType: "TASK", id, orgId, ownerId: userId, source: "user",
      schemaVersion: 1, version: 1, createdAt: now, updatedAt: now,
    };
    const taskKey = keys.privateRecord(orgId, userId, `TASK#${input.workDate}#${id}`);
    const lookupKey = keys.lookup(orgId, userId, "TASK", id);
    const outbox = this.buildOutboxItem(0, "personal.insight", `${orgId}#${userId}`);
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: this.tableName, Item: { ...taskKey, ...task } } },
        { Put: { TableName: this.tableName, Item: { ...lookupKey, targetSK: taskKey.SK, id, workDate: input.workDate } } },
        ...(requestKey && requestHash && requestKeyHash ? [{ Put: { TableName: this.tableName, Item: { ...keys.idempotency(orgId, userId, requestKeyHash), entityType: "IDEMPOTENCY", operation: "create-task", requestHash, result: task, createdAt: now }, ConditionExpression: "attribute_not_exists(PK)" } }] : []),
        { Put: { TableName: this.tableName, Item: outbox } },
      ],
    }));
    return task;
  }

  async listTasks(orgId: string, userId: string, limit = 50, cursor?: string): Promise<{ items: TaskRecord[]; nextCursor?: string }> {
    const ownerPk = keys.privatePartition(orgId, userId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName, KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": ownerPk, ":sk": "TASK#" },
      Limit: boundedLimit(limit),
      ExclusiveStartKey: decodeCursor(cursor, ownerPk, "TASK#"),
      ConsistentRead: true,
    }));
    const items = (result.Items ?? []).map((item) => taskRecordSchema.parse(cleanItem(item)));
    const nextCursor = result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") : undefined;
    return { items, ...(nextCursor ? { nextCursor } : {}) };
  }

  async getTask(orgId: string, userId: string, id: string): Promise<TaskRecord | undefined> {
    const lookup = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.lookup(orgId, userId, "TASK", id), ConsistentRead: true }));
    if (!lookup.Item?.targetSK) return undefined;
    const taskResult = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.privateRecord(orgId, userId, lookup.Item.targetSK), ConsistentRead: true }));
    return taskResult.Item ? taskRecordSchema.parse(cleanItem(taskResult.Item)) : undefined;
  }

  async updateTask(orgId: string, userId: string, id: string, patch: TaskUpdate): Promise<TaskRecord> {
    await this.requirePersonalConsent(orgId, userId);
    const existing = await this.getTask(orgId, userId, id);
    if (!existing) throw new AuthorizationError("Task not found", 404);
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== existing.version) {
      throw new AuthorizationError("Task version is stale", 409);
    }
    const changes = { ...patch };
    delete changes.expectedVersion;
    const now = new Date().toISOString();
    const updated: TaskRecord = taskRecordSchema.parse({ ...existing, ...changes, version: existing.version + 1, updatedAt: now });
    const oldSK = `TASK#${existing.workDate}#${id}`;
    const newSK = `TASK#${updated.workDate}#${id}`;
    const lookupKey = keys.lookup(orgId, userId, "TASK", id);
    if (oldSK !== newSK) {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: this.tableName, Key: keys.privateRecord(orgId, userId, oldSK) } },
          { Put: { TableName: this.tableName, Item: { ...keys.privateRecord(orgId, userId, newSK), ...updated } } },
          { Put: { TableName: this.tableName, Item: { ...lookupKey, targetSK: newSK, id, workDate: updated.workDate } } },
        ],
      }));
    } else {
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.privateRecord(orgId, userId, newSK), ...updated } }));
    }
    await this.saveOutboxEvent(0, "personal.insight", `${orgId}#${userId}`);
    await this.saveOutboxEvent(0, "publication.invalidate", `${orgId}#${userId}`);
    await this.invalidateGrantsForRecord(orgId, userId, id);
    return updated;
  }

  async deleteTask(orgId: string, userId: string, id: string): Promise<void> {
    const existing = await this.getTask(orgId, userId, id);
    if (!existing) throw new AuthorizationError("Task not found", 404);
    const oldSK = `TASK#${existing.workDate}#${id}`;
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: this.tableName, Key: keys.privateRecord(orgId, userId, oldSK) } },
        { Delete: { TableName: this.tableName, Key: keys.lookup(orgId, userId, "TASK", id) } },
      ],
    }));
    await this.saveOutboxEvent(0, "personal.insight", `${orgId}#${userId}`);
    await this.saveOutboxEvent(0, "publication.invalidate", `${orgId}#${userId}`);
    await this.invalidateGrantsForRecord(orgId, userId, id);
  }

  async createCheckIn(orgId: string, userId: string, input: CheckInInput, idempotencyKey?: string): Promise<CheckInRecord> {
    await this.requirePersonalConsent(orgId, userId);
    const requestKey = idempotencyKey ? validateIdempotencyKey(idempotencyKey) : undefined;
    const requestHash = requestKey ? requestFingerprint("create-check-in", requestKey, input) : undefined;
    const requestKeyHash = requestKey ? idempotencyKeyHash(requestKey) : undefined;
    if (requestKey && requestHash && requestKeyHash) {
      const previous = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.idempotency(orgId, userId, requestKeyHash), ConsistentRead: true }));
      if (previous.Item) {
        if (previous.Item.requestHash !== requestHash) throw new AuthorizationError("Idempotency key was reused with different input", 409);
        return checkInRecordSchema.parse(previous.Item.result);
      }
    }
    const id = `checkin-${randomUUID()}`;
    const now = new Date().toISOString();
    const checkIn: CheckInRecord = {
      ...input, entityType: "CHECKIN", id, orgId, ownerId: userId, source: "user",
      schemaVersion: 1, version: 1, createdAt: now, updatedAt: now,
    };
    const checkInKey = keys.privateRecord(orgId, userId, `CHECKIN#${input.checkInDate}#${id}`);
    const lookupKey = keys.lookup(orgId, userId, "CHECKIN", id);
    const outbox = this.buildOutboxItem(0, "personal.insight", `${orgId}#${userId}`);
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: this.tableName, Item: { ...checkInKey, ...checkIn } } },
        { Put: { TableName: this.tableName, Item: { ...lookupKey, targetSK: checkInKey.SK, id, checkInDate: input.checkInDate } } },
        ...(requestKey && requestHash && requestKeyHash ? [{ Put: { TableName: this.tableName, Item: { ...keys.idempotency(orgId, userId, requestKeyHash), entityType: "IDEMPOTENCY", operation: "create-check-in", requestHash, result: checkIn, createdAt: now }, ConditionExpression: "attribute_not_exists(PK)" } }] : []),
        { Put: { TableName: this.tableName, Item: outbox } },
      ],
    }));
    return checkIn;
  }

  async listCheckIns(orgId: string, userId: string, limit = 50, cursor?: string): Promise<{ items: CheckInRecord[]; nextCursor?: string }> {
    const ownerPk = keys.privatePartition(orgId, userId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName, KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": ownerPk, ":sk": "CHECKIN#" },
      Limit: boundedLimit(limit),
      ExclusiveStartKey: decodeCursor(cursor, ownerPk, "CHECKIN#"),
      ConsistentRead: true,
    }));
    const items = (result.Items ?? []).map((item) => checkInRecordSchema.parse(cleanItem(item)));
    const nextCursor = result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") : undefined;
    return { items, ...(nextCursor ? { nextCursor } : {}) };
  }

  async getCheckIn(orgId: string, userId: string, id: string): Promise<CheckInRecord | undefined> {
    const lookup = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.lookup(orgId, userId, "CHECKIN", id), ConsistentRead: true }));
    if (!lookup.Item?.targetSK) return undefined;
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.privateRecord(orgId, userId, lookup.Item.targetSK), ConsistentRead: true }));
    return result.Item ? checkInRecordSchema.parse(cleanItem(result.Item)) : undefined;
  }

  async updateCheckIn(orgId: string, userId: string, id: string, patch: CheckInUpdate): Promise<CheckInRecord> {
    const existing = await this.getCheckIn(orgId, userId, id);
    if (!existing) throw new AuthorizationError(`CheckIn ${id} not found`, 404);
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== existing.version) {
      throw new AuthorizationError("Check-in version is stale", 409);
    }
    const changes = { ...patch };
    delete changes.expectedVersion;
    const updated: CheckInRecord = checkInRecordSchema.parse({
      ...existing,
      ...changes,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    });
    const oldSK = `CHECKIN#${existing.checkInDate}#${id}`;
    const newSK = `CHECKIN#${updated.checkInDate}#${id}`;
    const lookupKey = keys.lookup(orgId, userId, "CHECKIN", id);
    if (oldSK !== newSK) {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: this.tableName, Key: keys.privateRecord(orgId, userId, oldSK) } },
          { Put: { TableName: this.tableName, Item: { ...keys.privateRecord(orgId, userId, newSK), ...updated } } },
          { Put: { TableName: this.tableName, Item: { ...lookupKey, targetSK: newSK, id, checkInDate: updated.checkInDate } } },
        ],
      }));
    } else {
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.privateRecord(orgId, userId, newSK), ...updated } }));
    }
    await this.saveOutboxEvent(0, "personal.insight", `${orgId}#${userId}`);
    await this.saveOutboxEvent(0, "publication.invalidate", orgId);
    await this.invalidateGrantsForRecord(orgId, userId, id);
    return updated;
  }

  async deleteCheckIn(orgId: string, userId: string, id: string): Promise<void> {
    const lookup = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.lookup(orgId, userId, "CHECKIN", id), ConsistentRead: true }));
    if (!lookup.Item?.targetSK) return;
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: this.tableName, Key: keys.privateRecord(orgId, userId, lookup.Item.targetSK) } },
        { Delete: { TableName: this.tableName, Key: keys.lookup(orgId, userId, "CHECKIN", id) } },
      ],
    }));
    await this.saveOutboxEvent(0, "personal.insight", `${orgId}#${userId}`);
    await this.saveOutboxEvent(0, "publication.invalidate", `${orgId}#${userId}`);
    await this.invalidateGrantsForRecord(orgId, userId, id);
  }

  async createPrivateItem(orgId: string, userId: string, input: PrivateItemInput): Promise<PrivateItemRecord> {
    await this.requirePersonalConsent(orgId, userId);
    const id = `item-${randomUUID()}`;
    const now = new Date().toISOString();
    const deleteAfter = privateItemDeleteAfter(input);
    const record = privateItemRecordSchema.parse({
      ...input,
      entityType: "PRIVATE_ITEM",
      id,
      orgId,
      ownerId: userId,
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...(deleteAfter ? { deleteAfter } : {}),
    });
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.privateRecord(orgId, userId, `ITEM#${id}`), ...record },
    }));
    return record;
  }

  async listPrivateItems(orgId: string, userId: string, limit = 50, cursor?: string): Promise<{ items: PrivateItemRecord[]; nextCursor?: string }> {
    const ownerPk = keys.privatePartition(orgId, userId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName, KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": ownerPk, ":sk": "ITEM#" },
      Limit: boundedLimit(limit),
      ExclusiveStartKey: decodeCursor(cursor, ownerPk, "ITEM#"),
      ConsistentRead: true,
    }));
    const items = (result.Items ?? []).map((item) => privateItemRecordSchema.parse(cleanItem(item)));
    const nextCursor = result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") : undefined;
    return { items, ...(nextCursor ? { nextCursor } : {}) };
  }

  async getPrivateItem(orgId: string, userId: string, id: string): Promise<PrivateItemRecord | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.privateRecord(orgId, userId, `ITEM#${id}`), ConsistentRead: true }));
    return result.Item ? privateItemRecordSchema.parse(cleanItem(result.Item)) : undefined;
  }

  async updatePrivateItem(orgId: string, userId: string, id: string, patch: PrivateItemUpdate): Promise<PrivateItemRecord> {
    await this.requirePersonalConsent(orgId, userId);
    const existing = await this.getPrivateItem(orgId, userId, id);
    if (!existing) throw new AuthorizationError("Private item not found", 404);
    const now = new Date().toISOString();
    let deleteAfter = existing.lifecycle === "one_time" ? existing.deleteAfter : undefined;
    if (existing.lifecycle === "one_time" && patch.eventEndAt) {
      deleteAfter = privateItemDeleteAfter({ ...existing, eventEndAt: patch.eventEndAt });
    }
    const updated = privateItemRecordSchema.parse({
      ...existing, ...patch, deleteAfter, version: existing.version + 1, updatedAt: now,
    });
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.privateRecord(orgId, userId, `ITEM#${id}`), ...updated } }));
    return updated;
  }

  async deletePrivateItem(orgId: string, userId: string, id: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: keys.privateRecord(orgId, userId, `ITEM#${id}`) }));
  }

  async getPersonalTrends(orgId: string, userId: string): Promise<{
    points: WeeklyWorkloadPoint[];
    evidenceStrength: EvidenceStrength;
    insights: PersonalInsight[];
    preferences: WorkloadPreferences;
  }> {
    const preferences = await this.getPreferences(orgId, userId);
    const { items: tasks } = await this.listTasks(orgId, userId, 100);
    const { items: checkIns } = await this.listCheckIns(orgId, userId, 100);
    const points = calculateWeeklyWorkload(tasks, checkIns);
    const insights = generatePersonalInsights(points, preferences.weeklyCapacity?.value);
    const strength: EvidenceStrength = points.length >= 6 ? "consistent" : points.length >= 3 ? "developing" : "limited";
    return { points, evidenceStrength: strength, insights, preferences };
  }

  async listObservations(orgId: string, userId: string): Promise<Observation[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName, KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": keys.privatePartition(orgId, userId), ":sk": "OBSERVATION#" },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => observationSchema.parse(cleanItem(item)));
  }

  async getObservation(orgId: string, userId: string, id: string): Promise<Observation | undefined> {
    const observations = await this.listObservations(orgId, userId);
    return observations.find((obs) => obs.id === id);
  }


  async updateObservationStatus(orgId: string, userId: string, id: string, status: ObservationUpdate["status"]): Promise<Observation> {
    const observation = await this.getObservation(orgId, userId, id);
    if (!observation) throw new AuthorizationError("Observation not found", 404);
    const updated: Observation = {
      ...observation, status, version: observation.version + 1, updatedAt: new Date().toISOString(),
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName, Item: { ...keys.privateRecord(orgId, userId, `OBSERVATION#${observation.range.from}#${id}`), ...updated },
    }));
    return updated;
  }

  async createCorrection(orgId: string, userId: string, input: CorrectionInput): Promise<CorrectionRecord> {
    const id = `corr-${randomUUID()}`;
    const now = new Date().toISOString();
    const record: CorrectionRecord = {
      ...input, entityType: "CORRECTION", id, orgId, ownerId: userId,
      status: "resolved", schemaVersion: 1, version: 1, createdAt: now, updatedAt: now,
    };
    const observation = await this.getObservation(orgId, userId, input.sourceOrObservationId);
    if (observation) {
      if (input.disputedVersion !== undefined && input.disputedVersion !== observation.version) {
        throw new AuthorizationError("Observation version mismatch", 409);
      }
      await this.updateObservationStatus(orgId, userId, observation.id, "corrected");
    }
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.privateRecord(orgId, userId, `CORRECTION#${id}`), ...record } }));
    await this.invalidateGrantsForRecord(orgId, userId, input.sourceOrObservationId);
    await this.invalidateAggregateReleases(orgId).catch(() => {});
    await this.saveOutboxEvent(0, "personal.insight", `${orgId}#${userId}`);
    await this.saveOutboxEvent(0, "publication.invalidate", `${orgId}#${userId}`);
    return record;
  }

  async saveOutboxEvent(shard: number, jobType: string, targetId: string, schemaVersion = 1): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.buildOutboxItem(shard, jobType, targetId, schemaVersion),
    }));
  }

  private buildOutboxItem(shard: number, jobType: string, targetId: string, schemaVersion = 1): DynamoEntity {
    const timestamp = new Date().toISOString();
    const eventId = randomUUID();
    return {
      ...keys.outbox(shard, timestamp, eventId),
      entityType: "OUTBOX_EVENT", jobId: eventId, jobType, targetId, schemaVersion, createdAt: timestamp,
    };
  }

  async createSharePreview(orgId: string, userId: string, input: SharingGrantInput): Promise<Publication> {
    const assignments = await this.getActiveAssignmentsForUser(orgId, userId);
    const assignment = assignments.find((a) => a.directManagerId === input.recipientManagerId);
    if (!assignment) {
      throw new AuthorizationError("Selected recipient is not an active direct manager", 400);
    }
    if (new Date(input.expiresAt).getTime() <= Date.now()) {
      throw new AuthorizationError("Expiration date must be in the future", 400);
    }
    const selectedValues: Array<{ selection: typeof input.selections[number]; values: Record<string, unknown> }> = [];
    for (const selection of input.selections) {
      if (selection.recordType === "task") {
        const task = await this.getTask(orgId, userId, selection.recordId);
        if (!task) throw new AuthorizationError(`Task ${selection.recordId} not found`, 404);
        if (task.version !== selection.recordVersion) throw new AuthorizationError(`Task version mismatch for ${selection.recordId}`, 409);
        if (!isDateInRange(task.workDate, input.range)) throw new AuthorizationError(`Task date ${task.workDate} is outside share range`, 400);
        const values = projectTaskValues(task, selection.fields as TaskShareField[]);
        selectedValues.push({ selection, values });
      } else if (selection.recordType === "check_in") {
        const checkIn = await this.getCheckIn(orgId, userId, selection.recordId);
        if (!checkIn) throw new AuthorizationError(`Check-in ${selection.recordId} not found`, 404);
        if (checkIn.version !== selection.recordVersion) throw new AuthorizationError(`Check-in version mismatch for ${selection.recordId}`, 409);
        if (!isDateInRange(checkIn.checkInDate, input.range)) throw new AuthorizationError(`Check-in date ${checkIn.checkInDate} is outside share range`, 400);
        const values = projectCheckInValues(checkIn, selection.fields as CheckInShareField[]);
        selectedValues.push({ selection, values });
      } else if (selection.recordType === "summary") {
        const trends = await this.getPersonalTrends(orgId, userId);
        const relevantTrends = trends.points.filter((p: WeeklyWorkloadPoint) => isDateInRange(p.weekStart, input.range));
        const values = projectSummaryValues(relevantTrends, selection.fields as SummaryShareField[]);
        selectedValues.push({ selection, values });
      }
    }
    const now = new Date().toISOString();
    return publicationSchema.parse({
      entityType: "PUBLICATION",
      grantId: "preview",
      publicationVersion: 1,
      orgId,
      ownerId: userId,
      recipientManagerId: input.recipientManagerId,
      range: input.range,
      expiresAt: input.expiresAt,
      selectedValues,
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  async createSharingGrant(orgId: string, userId: string, input: SharingGrantInput): Promise<{ grant: SharingGrant; publication: Publication }> {
    const preview = await this.createSharePreview(orgId, userId, input);
    const assignments = await this.getActiveAssignmentsForUser(orgId, userId);
    const assignment = assignments.find((a) => a.directManagerId === input.recipientManagerId);
    if (!assignment) throw new AuthorizationError("Selected recipient is not an active direct manager", 400);

    const grantId = `grant-${randomUUID()}`;
    const now = new Date().toISOString();
    const grant: SharingGrant = sharingGrantSchema.parse({
      ...input,
      entityType: "SHARING_GRANT",
      id: grantId,
      orgId,
      ownerId: userId,
      status: "active",
      gateGeneration: 1,
      assignmentVersion: assignment.assignmentVersion,
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    const publication: Publication = publicationSchema.parse({
      ...preview,
      grantId,
      createdAt: now,
      updatedAt: now,
    });

    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.grant(orgId, grantId), ...grant } }));
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.publication(orgId, grantId, 1), ...publication } }));
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.ownerGrants(orgId, userId), SK: `GRANT#${grantId}`, grantId, recipientManagerId: input.recipientManagerId, status: "active", expiresAt: input.expiresAt, createdAt: now },
    }));
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.managerInbox(orgId, input.recipientManagerId), SK: `SHARE#${grantId}`, grantId, ownerId: userId, status: "active", expiresAt: input.expiresAt, createdAt: now },
    }));
    await this.saveOutboxEvent(0, "publication.created", grantId);
    return { grant, publication };
  }

  async listOwnerGrants(orgId: string, userId: string): Promise<SharingGrant[]> {
    const prefix = keys.ownerGrants(orgId, userId);
    const pointers = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    const grants: SharingGrant[] = [];
    const now = Date.now();
    for (const item of pointers.Items ?? []) {
      if (typeof item.grantId !== "string") continue;
      const grant = await this.getGrant(orgId, item.grantId);
      if (!grant) continue;
      if (grant.status === "active" && new Date(grant.expiresAt).getTime() <= now) {
        grant.status = "expired";
        await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.grant(orgId, grant.id), ...grant } }));
      }
      grants.push(grant);
    }
    return grants;
  }

  async getGrant(orgId: string, grantId: string): Promise<SharingGrant | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.grant(orgId, grantId), ConsistentRead: true }));
    if (!result.Item) return undefined;
    const grant = sharingGrantSchema.parse(cleanItem(result.Item));
    if (grant.status === "active" && new Date(grant.expiresAt).getTime() <= Date.now()) {
      grant.status = "expired";
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.grant(orgId, grant.id), ...grant } }));
    }
    return grant;
  }

  async getPublication(orgId: string, grantId: string, version = 1): Promise<Publication | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.publication(orgId, grantId, version), ConsistentRead: true }));
    return result.Item ? publicationSchema.parse(cleanItem(result.Item)) : undefined;
  }

  async revokeGrant(orgId: string, userId: string, grantId: string): Promise<SharingGrant> {
    const grant = await this.getGrant(orgId, grantId);
    if (!grant) throw new AuthorizationError("Sharing grant not found", 404);
    if (grant.ownerId !== userId) throw new AuthorizationError("Cannot revoke another user's grant", 403);
    const now = new Date().toISOString();
    const updated: SharingGrant = { ...grant, status: "revoked", version: grant.version + 1, updatedAt: now };
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.grant(orgId, grantId), ...updated } }));
    await this.saveOutboxEvent(0, "publication.revoked", grantId);
    return updated;
  }

  async invalidateGrantsForRecord(orgId: string, userId: string, recordId: string): Promise<void> {
    const grants = await this.listOwnerGrants(orgId, userId);
    const now = new Date().toISOString();
    for (const grant of grants) {
      if (grant.status === "active" && grant.selections.some((s) => s.recordId === recordId)) {
        const updated: SharingGrant = { ...grant, status: "invalidated", version: grant.version + 1, updatedAt: now };
        await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.grant(orgId, grant.id), ...updated } }));
        await this.saveOutboxEvent(0, "publication.invalidated", grant.id);
      }
    }
  }

  async listManagerPublications(orgId: string, caller: CallerIdentity): Promise<Array<{ grant: SharingGrant; publication: Publication }>> {
    await requireRole(this, caller, orgId, "manager");
    const prefix = keys.managerInbox(orgId, caller.userId);
    const pointers = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    const items: Array<{ grant: SharingGrant; publication: Publication }> = [];
    const now = new Date();
    for (const pointer of pointers.Items ?? []) {
      if (typeof pointer.grantId !== "string") continue;
      const grant = await this.getGrant(orgId, pointer.grantId);
      if (!grant) continue;
      try {
        await requireManagerPublication(this, caller, grant, now);
        const pub = await this.getPublication(orgId, grant.id, 1);
        if (pub) items.push({ grant, publication: pub });
      } catch {
        // Ignored: revoked / expired / assignment-mismatched grants are hidden from manager
      }
    }
    return items;
  }

  async getManagerPublication(orgId: string, caller: CallerIdentity, grantId: string): Promise<{ grant: SharingGrant; publication: Publication }> {
    await requireRole(this, caller, orgId, "manager");
    const grant = await this.getGrant(orgId, grantId);
    if (!grant) throw new AuthorizationError("Shared publication is not available", 404);
    await requireManagerPublication(this, caller, grant, new Date());
    const publication = await this.getPublication(orgId, grantId, 1);
    if (!publication) throw new AuthorizationError("Shared publication is not available", 404);
    await this.recordAccessAudit(orgId, grant.ownerId, caller.userId, grant.id);
    return { grant, publication };
  }

  private async recordAccessAudit(orgId: string, ownerId: string, recipientId: string, grantId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const record: AccessAuditRecord = accessAuditRecordSchema.parse({
      entityType: "ACCESS_AUDIT", id: `audit-${randomUUID()}`, orgId, ownerId, recipientId, grantId, action: "grant.read", timestamp,
    });
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.accessAudit(orgId, ownerId, timestamp, record.id), ...record },
    }));
  }

  async listAccessHistory(orgId: string, ownerId: string): Promise<AccessAuditRecord[]> {
    const prefix = keys.accessAudit(orgId, ownerId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK }, ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => accessAuditRecordSchema.parse(cleanItem(item)));
  }

  // Phase 4: Protected Team & HR Releases
  async getOrganizationPolicy(orgId: string): Promise<OrganizationPolicy> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: keys.policy(orgId), ConsistentRead: true }));
    if (result.Item) return organizationPolicySchema.parse(cleanItem(result.Item));
    return { orgId, minimumContributors: PROPOSED_MINIMUM_CONTRIBUTORS, policyVersion: 1, disclosureGeneration: 1 };
  }

  async putOrganizationPolicy(policy: OrganizationPolicy): Promise<OrganizationPolicy> {
    if (policy.minimumContributors < PROPOSED_MINIMUM_CONTRIBUTORS) {
      throw new Error(`Minimum contributors cannot be lower than ${PROPOSED_MINIMUM_CONTRIBUTORS}`);
    }
    const validated = organizationPolicySchema.parse(policy);
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...keys.policy(policy.orgId), ...validated } }));
    return validated;
  }

  async listTeamAssignments(orgId: string, teamId: string): Promise<TeamAssignment[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `DIRECTORY#ORG#${orgId}#TEAM#${teamId}`, ":sk": "MEMBER#" },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => teamAssignmentSchema.parse(cleanItem(item)));
  }

  async listOrgMembers(orgId: string): Promise<Membership[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `DIRECTORY#ORG#${orgId}`, ":sk": "MEMBER#" },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => membershipSchema.parse(cleanItem(item)));
  }

  async listManagerTeams(orgId: string, caller: CallerIdentity): Promise<Array<{ teamId: string }>> {
    await requireRole(this, caller, orgId, "manager");
    const prefix = keys.userTeams(orgId, caller.userId);
    const pointers = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    const teams: Array<{ teamId: string }> = [];
    for (const pointer of pointers.Items ?? []) {
      if (typeof pointer.teamId !== "string") continue;
      if (await this.isManagerOfTeam(orgId, pointer.teamId, caller.userId)) {
        teams.push({ teamId: pointer.teamId });
      }
    }
    return teams;
  }

  async computeAndSaveTeamAggregate(
    orgId: string,
    teamId: string,
    range: DateRange,
  ): Promise<AggregateResponse> {
    const policy = await this.getOrganizationPolicy(orgId);
    const minThreshold = policy.minimumContributors;
    const assignments = await this.listTeamAssignments(orgId, teamId);
    const activeAssignments = assignments.filter((a) => a.status === "active");

    const effortContributions: ContributorMetric[] = [];
    const manageabilityContributions: ContributorMetric[] = [];
    const eligibleContributorIds: string[] = [];

    for (const assignment of activeAssignments) {
      const consent = await this.getConsent(orgId, assignment.userId);
      if (!consent.personalProcessing || !consent.teamAggregation) continue;

      eligibleContributorIds.push(assignment.userId);
      const tasksRes = await this.listTasks(orgId, assignment.userId, 100);
      const tasks = tasksRes.items.filter((t) => isDateInRange(t.workDate, range));
      const checkInsRes = await this.listCheckIns(orgId, assignment.userId, 100);
      const checkIns = checkInsRes.items.filter((c) => isDateInRange(c.checkInDate, range));

      const totalEffort = tasks.reduce((sum, t) => sum + t.effort.value, 0);
      if (tasks.length > 0 && totalEffort > 0) {
        effortContributions.push({ contributorId: assignment.userId, value: totalEffort });
      }
      if (checkIns.length > 0) {
        const meanRating = checkIns.reduce((sum, c) => sum + c.manageability, 0) / checkIns.length;
        manageabilityContributions.push({ contributorId: assignment.userId, value: meanRating });
      }
    }

    const windowKey = `${range.from}_${range.to}`;
    const previous = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.teamView(orgId, teamId, windowKey),
      ConsistentRead: true,
    }));
    const previousContributorIds: string[] = previous.Item?.contributorIds ?? [];

    let effortDisclosure: DisclosureDecision;
    try {
      effortDisclosure = evaluateMeanDisclosure(effortContributions, minThreshold, previousContributorIds);
    } catch {
      effortDisclosure = { state: "insufficient_contributors", contributorCount: effortContributions.length, reason: "Insufficient contributors" };
    }

    let manageabilityDisclosure: DisclosureDecision;
    try {
      manageabilityDisclosure = evaluateMeanDisclosure(manageabilityContributions, minThreshold, previousContributorIds);
    } catch {
      manageabilityDisclosure = { state: "insufficient_contributors", contributorCount: manageabilityContributions.length, reason: "Insufficient contributors" };
    }

    let state: "available" | "insufficient_contributors" | "unsafe_overlap";
    let metrics: Array<{ key: "meanWeeklyEffort" | "meanManageability"; value: number; contributorCountBand: "5-9" | "10-19" | "20+" }> | undefined;
    let reason: string | undefined;

    if (effortDisclosure.state === "unsafe_overlap" || manageabilityDisclosure.state === "unsafe_overlap") {
      state = "unsafe_overlap";
      reason = "The contributor change is too small to safely publish a successive release";
    } else if (effortDisclosure.state === "available" || manageabilityDisclosure.state === "available") {
      state = "available";
      metrics = [];
      if (effortDisclosure.state === "available") {
        metrics.push({
          key: "meanWeeklyEffort",
          value: Number(effortDisclosure.value.toFixed(1)),
          contributorCountBand: contributorCountBand(effortDisclosure.contributorCount),
        });
      }
      if (manageabilityDisclosure.state === "available") {
        metrics.push({
          key: "meanManageability",
          value: Number(manageabilityDisclosure.value.toFixed(1)),
          contributorCountBand: contributorCountBand(manageabilityDisclosure.contributorCount),
        });
      }
    } else {
      state = "insufficient_contributors";
      reason = `At least ${minThreshold} distinct consenting contributors are required`;
    }

    const totalDistinct = new Set([...effortContributions.map((c) => c.contributorId), ...manageabilityContributions.map((c) => c.contributorId)]).size;
    const strength: EvidenceStrength = totalDistinct >= 10 ? "consistent" : totalDistinct >= 5 ? "developing" : "limited";

    const response: AggregateResponse = aggregateResponseSchema.parse({
      state,
      range,
      generatedAt: new Date().toISOString(),
      evidenceStrength: strength,
      ...(state === "available" && metrics?.length ? { metrics } : { reason }),
    });

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...keys.teamView(orgId, teamId, windowKey),
        ...response,
        contributorIds: eligibleContributorIds,
        policyVersion: policy.policyVersion,
        disclosureGeneration: policy.disclosureGeneration,
      },
    }));

    return response;
  }

  async getTeamAggregate(
    orgId: string,
    teamId: string,
    caller: CallerIdentity,
    range?: DateRange,
  ): Promise<AggregateResponse> {
    await requireTeamManager(this, caller, orgId, teamId);
    if (range) {
      const windowKey = `${range.from}_${range.to}`;
      const record = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: keys.teamView(orgId, teamId, windowKey),
        ConsistentRead: true,
      }));
      const defaultRange: DateRange = range ?? { from: "2026-03-01", to: "2026-03-07" };
      if (record.Item) {
        const policy = await this.getOrganizationPolicy(orgId);
        const isStale = (typeof record.Item.policyVersion === "number" && record.Item.policyVersion < policy.policyVersion)
          || (typeof record.Item.disclosureGeneration === "number" && record.Item.disclosureGeneration < policy.disclosureGeneration);
        return aggregateResponseSchema.parse({
          state: isStale ? "invalid" : record.Item.state,
          range: record.Item.range ?? defaultRange,
          generatedAt: record.Item.generatedAt ?? new Date().toISOString(),
          evidenceStrength: record.Item.evidenceStrength ?? "limited",
          ...(record.Item.state === "available" && !isStale
            ? { metrics: record.Item.metrics }
            : { reason: isStale ? "Release invalidated by policy change" : (record.Item.reason ?? "Suppressed") }),
        });
      }
    } else {
      const defaultRange: DateRange = range ?? { from: "2026-03-01", to: "2026-03-07" };
      const prefix = keys.teamView(orgId, teamId);
      const query = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
        ConsistentRead: true,
      }));
      if (query.Items && query.Items.length > 0) {
        const latest = query.Items.sort((a, b) => (b.SK ?? "").localeCompare(a.SK ?? ""))[0]!;
        const policy = await this.getOrganizationPolicy(orgId);
        const isStale = (typeof latest.policyVersion === "number" && latest.policyVersion < policy.policyVersion)
          || (typeof latest.disclosureGeneration === "number" && latest.disclosureGeneration < policy.disclosureGeneration);
        return aggregateResponseSchema.parse({
          state: isStale ? "invalid" : latest.state,
          range: latest.range ?? defaultRange,
          generatedAt: latest.generatedAt ?? new Date().toISOString(),
          evidenceStrength: latest.evidenceStrength ?? "limited",
          ...(latest.state === "available" && !isStale
            ? { metrics: latest.metrics }
            : { reason: isStale ? "Release invalidated by policy change" : (latest.reason ?? "Suppressed") }),
        });
      }
    }

    const defaultRange: DateRange = range ?? { from: "2026-03-01", to: "2026-03-07" };
    return aggregateResponseSchema.parse({
      state: "insufficient_contributors",
      range: defaultRange,
      generatedAt: new Date().toISOString(),
      evidenceStrength: "limited",
      reason: "No aggregate release available for this window yet",
    });
  }

  async computeAndSaveOrgAggregate(
    orgId: string,
    range: DateRange,
  ): Promise<AggregateResponse> {
    const policy = await this.getOrganizationPolicy(orgId);
    const minThreshold = policy.minimumContributors;
    const allMembers = await this.listOrgMembers(orgId);
    const activeMembers = allMembers.filter((m) => m.status === "active");

    const effortContributions: ContributorMetric[] = [];
    const manageabilityContributions: ContributorMetric[] = [];
    const eligibleContributorIds: string[] = [];

    for (const member of activeMembers) {
      const consent = await this.getConsent(orgId, member.userId);
      if (!consent.personalProcessing || !consent.organizationAggregation) continue;

      eligibleContributorIds.push(member.userId);
      const tasksRes = await this.listTasks(orgId, member.userId, 100);
      const tasks = tasksRes.items.filter((t) => isDateInRange(t.workDate, range));
      const checkInsRes = await this.listCheckIns(orgId, member.userId, 100);
      const checkIns = checkInsRes.items.filter((c) => isDateInRange(c.checkInDate, range));

      const totalEffort = tasks.reduce((sum, t) => sum + t.effort.value, 0);
      if (tasks.length > 0 && totalEffort > 0) {
        effortContributions.push({ contributorId: member.userId, value: totalEffort });
      }
      if (checkIns.length > 0) {
        const meanRating = checkIns.reduce((sum, c) => sum + c.manageability, 0) / checkIns.length;
        manageabilityContributions.push({ contributorId: member.userId, value: meanRating });
      }
    }

    const windowKey = `${range.from}_${range.to}`;
    const previous = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.organizationView(orgId, windowKey),
      ConsistentRead: true,
    }));
    const previousContributorIds: string[] = previous.Item?.contributorIds ?? [];

    let effortDisclosure: DisclosureDecision;
    try {
      effortDisclosure = evaluateMeanDisclosure(effortContributions, minThreshold, previousContributorIds);
    } catch {
      effortDisclosure = { state: "insufficient_contributors", contributorCount: effortContributions.length, reason: "Insufficient contributors" };
    }

    let manageabilityDisclosure: DisclosureDecision;
    try {
      manageabilityDisclosure = evaluateMeanDisclosure(manageabilityContributions, minThreshold, previousContributorIds);
    } catch {
      manageabilityDisclosure = { state: "insufficient_contributors", contributorCount: manageabilityContributions.length, reason: "Insufficient contributors" };
    }

    let state: "available" | "insufficient_contributors" | "unsafe_overlap";
    let metrics: Array<{ key: "meanWeeklyEffort" | "meanManageability"; value: number; contributorCountBand: "5-9" | "10-19" | "20+" }> | undefined;
    let reason: string | undefined;

    if (effortDisclosure.state === "unsafe_overlap" || manageabilityDisclosure.state === "unsafe_overlap") {
      state = "unsafe_overlap";
      reason = "The contributor change is too small to safely publish a successive release";
    } else if (effortDisclosure.state === "available" || manageabilityDisclosure.state === "available") {
      state = "available";
      metrics = [];
      if (effortDisclosure.state === "available") {
        metrics.push({
          key: "meanWeeklyEffort",
          value: Number(effortDisclosure.value.toFixed(1)),
          contributorCountBand: contributorCountBand(effortDisclosure.contributorCount),
        });
      }
      if (manageabilityDisclosure.state === "available") {
        metrics.push({
          key: "meanManageability",
          value: Number(manageabilityDisclosure.value.toFixed(1)),
          contributorCountBand: contributorCountBand(manageabilityDisclosure.contributorCount),
        });
      }
    } else {
      state = "insufficient_contributors";
      reason = `At least ${minThreshold} distinct consenting contributors are required`;
    }

    const totalDistinct = new Set([...effortContributions.map((c) => c.contributorId), ...manageabilityContributions.map((c) => c.contributorId)]).size;
    const strength: EvidenceStrength = totalDistinct >= 10 ? "consistent" : totalDistinct >= 5 ? "developing" : "limited";

    const response: AggregateResponse = aggregateResponseSchema.parse({
      state,
      range,
      generatedAt: new Date().toISOString(),
      evidenceStrength: strength,
      ...(state === "available" && metrics?.length ? { metrics } : { reason }),
    });

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...keys.organizationView(orgId, windowKey),
        ...response,
        contributorIds: eligibleContributorIds,
        policyVersion: policy.policyVersion,
        disclosureGeneration: policy.disclosureGeneration,
      },
    }));

    return response;
  }

  async getOrgAggregate(
    orgId: string,
    caller: CallerIdentity,
    range?: DateRange,
  ): Promise<AggregateResponse> {
    await requireRole(this, caller, orgId, "hr");
    if (range) {
      const windowKey = `${range.from}_${range.to}`;
      const record = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: keys.organizationView(orgId, windowKey),
        ConsistentRead: true,
      }));
      const defaultRange: DateRange = range ?? { from: "2026-03-01", to: "2026-03-07" };
      if (record.Item) {
        return aggregateResponseSchema.parse({
          state: record.Item.state,
          range: record.Item.range ?? defaultRange,
          generatedAt: record.Item.generatedAt ?? new Date().toISOString(),
          evidenceStrength: record.Item.evidenceStrength ?? "limited",
          ...(record.Item.state === "available" ? { metrics: record.Item.metrics } : { reason: record.Item.reason ?? "Suppressed" }),
        });
      }
    } else {
      const defaultRange: DateRange = range ?? { from: "2026-03-01", to: "2026-03-07" };
      const prefix = keys.organizationView(orgId);
      const query = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
        ConsistentRead: true,
      }));
      if (query.Items && query.Items.length > 0) {
        const latest = query.Items.sort((a, b) => (b.SK ?? "").localeCompare(a.SK ?? ""))[0]!;
        return aggregateResponseSchema.parse({
          state: latest.state,
          range: latest.range ?? defaultRange,
          generatedAt: latest.generatedAt ?? new Date().toISOString(),
          evidenceStrength: latest.evidenceStrength ?? "limited",
          ...(latest.state === "available" ? { metrics: latest.metrics } : { reason: latest.reason ?? "Suppressed" }),
        });
      }
    }

    const defaultRange: DateRange = range ?? { from: "2026-03-01", to: "2026-03-07" };
    return aggregateResponseSchema.parse({
      state: "insufficient_contributors",
      range: defaultRange,
      generatedAt: new Date().toISOString(),
      evidenceStrength: "limited",
      reason: "No organization aggregate release available for this window yet",
    });
  }

  async invalidateAggregateReleases(orgId: string, teamId?: string): Promise<void> {
    if (teamId) {
      const prefix = keys.teamView(orgId, teamId);
      const query = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
        ConsistentRead: true,
      }));
      for (const item of query.Items ?? []) {
        if (item.state !== "invalid") {
          const updated: Record<string, unknown> = {
            ...item,
            state: "invalid",
            reason: "Release invalidated by privacy/membership change",
            updatedAt: new Date().toISOString(),
          };
          delete updated.metrics;
          await this.client.send(new PutCommand({ TableName: this.tableName, Item: updated }));
        }
      }
    }
    const orgPrefix = keys.organizationView(orgId);
    const orgQuery = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": orgPrefix.PK, ":sk": orgPrefix.SK },
      ConsistentRead: true,
    }));
    for (const item of orgQuery.Items ?? []) {
      if (item.state !== "invalid") {
        const updated: Record<string, unknown> = {
          ...item,
          state: "invalid",
          reason: "Release invalidated by privacy/membership change",
          updatedAt: new Date().toISOString(),
        };
        delete updated.metrics;
        await this.client.send(new PutCommand({ TableName: this.tableName, Item: updated }));
      }
    }
  }

  // --- Admin Directory & Policy ---

  async listMembers(orgId: string): Promise<Membership[]> {
    const prefix = keys.member(orgId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => membershipSchema.parse(cleanItem(item)));
  }

  async updateMember(
    orgId: string,
    userId: string,
    update: MemberUpdate,
    actor: CallerIdentity,
    actorEmail?: string,
  ): Promise<Membership> {
    const existing = await this.getMembership(orgId, userId);
    if (!existing) throw new AuthorizationError("Member not found", 404);
    const updated: Membership = {
      ...existing,
      roles: update.roles ?? existing.roles,
      status: update.status ?? existing.status,
      membershipVersion: existing.membershipVersion + 1,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.member(orgId, userId), ...updated },
    }));
    if (existing.status !== updated.status || existing.roles.join(",") !== updated.roles.join(",")) {
      // Membership changes must take effect against fresh backend reads even when a JWT is stale.
      await this.invalidateAggregateReleases(orgId).catch(() => {});
      if (existing.roles.includes("manager") && !updated.roles.includes("manager")) {
        for (const grant of await this.listOwnerGrants(orgId, userId).catch(() => [])) {
          if (grant.status === "active") {
            await this.client.send(new PutCommand({
              TableName: this.tableName,
              Item: { ...keys.grant(orgId, grant.id), ...grant, status: "invalidated", version: grant.version + 1, updatedAt: new Date().toISOString() },
            })).catch(() => {});
          }
        }
      }
    }
    await this.logAdminAudit(
      orgId,
      actor.userId,
      "member.update",
      userId,
      { update, previousRoles: existing.roles, previousStatus: existing.status },
      actorEmail,
    );
    return updated;
  }

  async createInvitation(
    orgId: string,
    input: InvitationInput,
    actor: CallerIdentity,
    actorEmail?: string,
  ): Promise<InvitationRecord> {
    const invitationId = `inv_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const record: InvitationRecord = {
      id: invitationId,
      orgId,
      email: input.email,
      token,
      roles: input.roles,
      teamId: input.teamId,
      directManagerId: input.directManagerId,
      status: "pending",
      expiresAt,
      createdAt: now,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.invitation(orgId, invitationId), ...record, token: undefined, tokenHash },
    }));
    await this.logAdminAudit(
      orgId,
      actor.userId,
      "member.invite",
      invitationId,
      { email: input.email, roles: input.roles },
      actorEmail,
    );
    return record;
  }

  async listInvitations(orgId: string): Promise<InvitationRecord[]> {
    const prefix = keys.invitation(orgId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => {
      const cleaned = cleanItem(item);
      delete cleaned.tokenHash;
      return invitationRecordSchema.parse(cleaned);
    });
  }

  async acceptInvitation(
    orgId: string,
    input: AcceptInvitationInput,
    user: { userId: string; email: string },
  ): Promise<Membership> {
    const inviteItem = (await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.invitation(orgId, input.invitationId),
      ConsistentRead: true,
    }))).Item;
    if (!inviteItem) throw new AuthorizationError("Invitation not found", 404);
    const invite = invitationRecordSchema.parse(cleanItem(inviteItem));
    if (invite.status === "accepted" && invite.acceptedBy === user.userId) {
      const existingMembership = await this.getMembership(orgId, user.userId);
      if (existingMembership) return existingMembership;
    }
    if (invite.status !== "pending" || new Date(invite.expiresAt).getTime() <= Date.now()) {
      throw new AuthorizationError("Invitation is no longer valid or has expired", 400);
    }
    if (invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new AuthorizationError("Invitation is addressed to a different verified account", 403);
    }
    if (invite.tokenHash) {
      if (!input.token) throw new AuthorizationError("Invitation token is required", 400);
      const presentedHash = createHash("sha256").update(input.token).digest("hex");
      if (presentedHash !== invite.tokenHash) throw new AuthorizationError("Invitation token is invalid", 403);
    }
    const now = new Date().toISOString();
    const membership: Membership = {
      orgId,
      userId: user.userId,
      displayName: input.displayName,
      email: user.email,
      roles: invite.roles,
      status: "active",
      membershipVersion: 1,
    };
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: this.tableName, Item: { ...inviteItem, token: undefined, status: "accepted", acceptedAt: now, acceptedBy: user.userId }, ConditionExpression: "#status = :pending", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":pending": "pending" } } },
        { Put: { TableName: this.tableName, Item: { ...keys.member(orgId, user.userId), ...membership } } },
        { Put: { TableName: this.tableName, Item: { PK: `IDENTITY#USER#${user.userId}`, SK: `ORG#${orgId}`, orgId, active: true } } },
      ],
    }));
    if (invite.teamId) {
      await this.assignTeamMember(
        orgId,
        invite.teamId,
        user.userId,
        { directManagerId: invite.directManagerId },
        { userId: user.userId, tokenGroups: [] },
      );
    }
    return membership;
  }

  async listTeams(orgId: string): Promise<TeamRecord[]> {
    const prefix = keys.orgTeam(orgId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => teamRecordSchema.parse(cleanItem(item)));
  }

  async createTeam(
    orgId: string,
    input: TeamInput,
    actor: CallerIdentity,
    actorEmail?: string,
  ): Promise<TeamRecord> {
    const now = new Date().toISOString();
    const team: TeamRecord = {
      orgId,
      teamId: input.teamId,
      teamName: input.teamName,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: this.tableName, Item: { ...keys.teamProfile(orgId, input.teamId), ...team } } },
        { Put: { TableName: this.tableName, Item: { ...keys.orgTeam(orgId, input.teamId), ...team } } },
      ],
    }));
    await this.logAdminAudit(orgId, actor.userId, "team.create", input.teamId, { teamName: input.teamName }, actorEmail);
    return team;
  }

  async updateTeam(
    orgId: string,
    teamId: string,
    update: { teamName?: string | undefined; status?: "active" | "archived" | undefined },
    actor: CallerIdentity,
    actorEmail?: string,
  ): Promise<TeamRecord> {
    const existingResult = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.teamProfile(orgId, teamId),
      ConsistentRead: true,
    }));
    if (!existingResult.Item) throw new AuthorizationError("Team not found", 404);
    const existing = teamRecordSchema.parse(cleanItem(existingResult.Item));
    const now = new Date().toISOString();
    const updated: TeamRecord = {
      ...existing,
      teamName: update.teamName ?? existing.teamName,
      status: update.status ?? existing.status,
      updatedAt: now,
    };
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: this.tableName, Item: { ...keys.teamProfile(orgId, teamId), ...updated } } },
        { Put: { TableName: this.tableName, Item: { ...keys.orgTeam(orgId, teamId), ...updated } } },
      ],
    }));
    await this.logAdminAudit(orgId, actor.userId, "team.update", teamId, { update }, actorEmail);
    return updated;
  }

  async assignTeamMember(
    orgId: string,
    teamId: string,
    userId: string,
    assignment: { directManagerId?: string | undefined; effectiveFrom?: string | undefined; effectiveTo?: string | undefined },
    actor: CallerIdentity,
    actorEmail?: string,
  ): Promise<TeamAssignment> {
    const now = new Date().toISOString();
    const existing = (await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.teamAssignment(orgId, teamId, userId),
      ConsistentRead: true,
    }))).Item;
    const version = existing ? (((existing.assignmentVersion as number) ?? 1) + 1) : 1;
    const record: TeamAssignment = {
      orgId,
      teamId,
      userId,
      ...(assignment.directManagerId ? { directManagerId: assignment.directManagerId } : {}),
      effectiveFrom: assignment.effectiveFrom ?? now,
      ...(assignment.effectiveTo ? { effectiveTo: assignment.effectiveTo } : {}),
      assignmentVersion: version,
      status: "active",
    };
    const transactItems: Array<{ Put: { TableName: string; Item: Record<string, unknown> } }> = [
      { Put: { TableName: this.tableName, Item: { ...keys.teamAssignment(orgId, teamId, userId), ...record } } },
      { Put: { TableName: this.tableName, Item: { PK: `DIRECTORY#ORG#${orgId}#USER#${userId}`, SK: `TEAM#${teamId}`, orgId, teamId, userId, status: "active" } } },
    ];
    if (assignment.directManagerId) {
      transactItems.push({
        Put: { TableName: this.tableName, Item: { ...keys.teamManager(orgId, teamId, assignment.directManagerId), orgId, teamId, managerId: assignment.directManagerId, status: "active" } },
      });
    }
    await this.client.send(new TransactWriteCommand({ TransactItems: transactItems }));
    await this.invalidateAggregateReleases(orgId, teamId);
    await this.logAdminAudit(orgId, actor.userId, "team.member_assign", `${teamId}#${userId}`, { assignment }, actorEmail);
    return record;
  }

  async removeTeamMember(
    orgId: string,
    teamId: string,
    userId: string,
    actor: CallerIdentity,
    actorEmail?: string,
  ): Promise<void> {
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: this.tableName, Key: keys.teamAssignment(orgId, teamId, userId) } },
        { Delete: { TableName: this.tableName, Key: { PK: `DIRECTORY#ORG#${orgId}#USER#${userId}`, SK: `TEAM#${teamId}` } } },
      ],
    }));
    await this.invalidateAggregateReleases(orgId, teamId);
    await this.logAdminAudit(orgId, actor.userId, "team.member_remove", `${teamId}#${userId}`, {}, actorEmail);
  }

  async patchOrganizationPolicy(
    orgId: string,
    patch: PolicyPatch,
    actor: CallerIdentity,
    actorEmail?: string,
  ): Promise<OrganizationPolicy> {
    if (patch.minimumContributors !== undefined && patch.minimumContributors < 5) {
      throw new AuthorizationError("Minimum contributors cannot be lower than privacy floor of 5", 400);
    }
    const current = await this.getOrganizationPolicy(orgId);
    const newMin = patch.minimumContributors ?? current.minimumContributors;
    if (newMin < 5) {
      throw new AuthorizationError("Minimum contributors cannot be lower than privacy floor of 5", 400);
    }
    const updated: OrganizationPolicy = {
      orgId,
      minimumContributors: newMin,
      policyVersion: current.policyVersion + 1,
      disclosureGeneration: current.disclosureGeneration + 1,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.policy(orgId), ...updated },
    }));
    await this.invalidateAggregateReleases(orgId);
    await this.logAdminAudit(orgId, actor.userId, "policy.patch", orgId, { patch, previousPolicy: current }, actorEmail);
    return updated;
  }

  async logAdminAudit(
    orgId: string,
    actorId: string,
    action: string,
    targetId: string,
    details: Record<string, unknown>,
    actorEmail?: string,
  ): Promise<AdminAuditRecord> {
    const now = new Date().toISOString();
    const eventId = `evt_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const record: AdminAuditRecord = {
      id: eventId,
      orgId,
      actorId,
      actorEmail,
      action,
      targetId,
      details,
      timestamp: now,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.adminAudit(orgId, now, eventId), ...record },
    }));
    return record;
  }

  async listAdminAuditEvents(orgId: string): Promise<AdminAuditRecord[]> {
    const prefix = keys.adminAudit(orgId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    const items = (result.Items ?? []).map((item) => adminAuditRecordSchema.parse(cleanItem(item)));
    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // --- Human Actions ---

  async createHumanAction(
    orgId: string,
    scope: "team" | "hr",
    teamId: string | undefined,
    input: HumanActionInput,
    author: { userId: string; displayName: string },
  ): Promise<HumanActionRecord> {
    const actionId = `act_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date().toISOString();
    const target = scope === "team" ? (`TEAM#${teamId!}` as const) : ("HR" as const);
    const record: HumanActionRecord = {
      id: actionId,
      orgId,
      scope,
      teamId: scope === "team" ? teamId : undefined,
      authorId: author.userId,
      authorName: author.displayName,
      rationale: input.rationale,
      status: input.status,
      followUpAt: input.followUpAt,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdAt: now,
      updatedAt: now,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.action(orgId, target, actionId), ...record },
    }));
    return record;
  }

  async listHumanActions(orgId: string, scope: "team" | "hr", teamId?: string): Promise<HumanActionRecord[]> {
    const target = scope === "team" ? (`TEAM#${teamId!}` as const) : ("HR" as const);
    const prefix = keys.action(orgId, target);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    const items = (result.Items ?? []).map((item) => humanActionRecordSchema.parse(cleanItem(item)));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getHumanAction(
    orgId: string,
    scope: "team" | "hr",
    actionId: string,
    teamId?: string,
  ): Promise<HumanActionRecord | undefined> {
    const target = scope === "team" ? (`TEAM#${teamId!}` as const) : ("HR" as const);
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.action(orgId, target, actionId),
      ConsistentRead: true,
    }));
    return result.Item ? humanActionRecordSchema.parse(cleanItem(result.Item)) : undefined;
  }

  async updateHumanAction(
    orgId: string,
    scope: "team" | "hr",
    actionId: string,
    update: HumanActionUpdate,
    teamId?: string,
  ): Promise<HumanActionRecord> {
    const existing = await this.getHumanAction(orgId, scope, actionId, teamId);
    if (!existing) throw new AuthorizationError("Human action not found", 404);
    const target = scope === "team" ? (`TEAM#${teamId!}` as const) : ("HR" as const);
    const updated: HumanActionRecord = {
      ...existing,
      rationale: update.rationale ?? existing.rationale,
      status: update.status ?? existing.status,
      followUpAt: update.followUpAt !== undefined ? update.followUpAt : existing.followUpAt,
      updatedAt: new Date().toISOString(),
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.action(orgId, target, actionId), ...updated },
    }));
    return updated;
  }

  // --- Notifications ---

  async createNotification(
    orgId: string,
    userId: string,
    notice: { title: string; message: string; category: NotificationCategory; link?: string },
  ): Promise<NotificationRecord> {
    const noticeId = `notif_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      id: noticeId,
      orgId,
      userId,
      title: notice.title,
      message: notice.message,
      category: notice.category,
      read: false,
      link: notice.link,
      createdAt: now,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.notification(orgId, userId, now, noticeId), ...record },
    }));
    return record;
  }

  async listNotifications(orgId: string, userId: string): Promise<NotificationRecord[]> {
    const prefix = keys.notification(orgId, userId);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    const items = (result.Items ?? []).map((item) => notificationRecordSchema.parse(cleanItem(item)));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateNotification(
    orgId: string,
    userId: string,
    noticeId: string,
    update: NotificationUpdate,
  ): Promise<NotificationRecord> {
    const prefix = keys.notification(orgId, userId);
    const query = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": prefix.PK, ":sk": prefix.SK },
      ConsistentRead: true,
    }));
    const found = (query.Items ?? []).find((item) => item.id === noticeId);
    if (!found) throw new AuthorizationError("Notification not found", 404);
    const updated: NotificationRecord = {
      ...notificationRecordSchema.parse(cleanItem(found)),
      read: update.read,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...found, ...updated },
    }));
    return updated;
  }

  async getNotificationPreferences(orgId: string, userId: string): Promise<NotificationPreferences> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.notificationPreferences(orgId, userId),
      ConsistentRead: true,
    }));
    if (result.Item) return notificationPreferencesSchema.parse(cleanItem(result.Item));
    return { inAppEnabled: true, emailEnabled: false, weeklyDigestEnabled: false };
  }

  async putNotificationPreferences(
    orgId: string,
    userId: string,
    prefs: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const validated = notificationPreferencesSchema.parse(prefs);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...keys.notificationPreferences(orgId, userId), ...validated, orgId, userId },
    }));
    return validated;
  }

  // --- Lifecycle: Data Export, Deletion & Retention ---

  async listCorrections(orgId: string, userId: string): Promise<CorrectionRecord[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": keys.privatePartition(orgId, userId),
        ":sk": "CORRECTION#",
      },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => correctionRecordSchema.parse(cleanItem(item)));
  }

  async compileOwnerExportData(orgId: string, userId: string, exportId: string, downloadExpiresAt: string, scope: ExportScope = "all"): Promise<OwnerExportData> {
    const preferences = await this.getPreferences(orgId, userId).catch(() => undefined);
    const consent = await this.getConsent(orgId, userId).catch(() => undefined);
    const includePersonal = scope === "all" || scope === "personal_records";
    const includeTasks = includePersonal || scope === "tasks";
    const includeCheckIns = includePersonal || scope === "checkins";
    const includeShares = scope === "all" || scope === "shares";
    const { items: tasks } = includeTasks ? await this.listTasks(orgId, userId, 100) : { items: [] };
    const { items: checkIns } = includeCheckIns ? await this.listCheckIns(orgId, userId, 100) : { items: [] };
    const { items: privateItems } = includePersonal ? await this.listPrivateItems(orgId, userId, 100) : { items: [] };
    const observations = includePersonal ? await this.listObservations(orgId, userId) : [];
    const corrections = includePersonal ? await this.listCorrections(orgId, userId) : [];
    const grants = includeShares ? await this.listOwnerGrants(orgId, userId) : [];
    const notifications = includePersonal ? await this.listNotifications(orgId, userId) : [];

    const exportData: OwnerExportData = {
      exportId,
      generatedAt: new Date().toISOString(),
      orgId,
      userId,
      metadata: {
        version: 1,
        schemaVersion: 1,
        notice: "This archive contains strictly your personal workload records. In accordance with privacy architecture, no other employees' records or raw aggregate datasets are included.",
        downloadExpiresAt,
      },
      ...(includePersonal && preferences ? { preferences } : {}),
      ...(includePersonal && consent ? { consent } : {}),
      tasks,
      checkIns,
      privateItems,
      observations,
      corrections,
      grants,
      notifications,
    };

    return ownerExportDataSchema.parse(exportData);
  }

  async createExportJob(orgId: string, userId: string, input?: ExportRequest): Promise<LifecycleJobRecord> {
    const validated = exportRequestSchema.parse(input ?? { scope: "all" });
    const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date();
    // 24-hour download availability per README Section 4 Retention & Deletion
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const record: LifecycleJobRecord = {
      entityType: "JOB",
      id: jobId,
      orgId,
      ownerId: userId,
      kind: "export",
      status: "completed",
      scope: validated.scope,
      expiresAt,
      downloadUrl: `/v1/me/exports/${jobId}/download`,
      s3Key: `owner-exports/${orgId}/${userId}/${jobId}.json`,
      schemaVersion: 1,
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const exportData = await this.compileOwnerExportData(orgId, userId, jobId, expiresAt, validated.scope);

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...keys.job(orgId, userId, jobId),
        ...record,
        exportPayload: JSON.stringify(exportData),
      },
    }));

    await this.saveOutboxEvent(0, "owner.export", `${orgId}#${userId}#${jobId}`);
    return record;
  }

  async getJob(orgId: string, userId: string, jobId: string): Promise<LifecycleJobRecord | undefined> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.job(orgId, userId, jobId),
      ConsistentRead: true,
    }));
    if (!result.Item) return undefined;
    const cleaned = cleanItem(result.Item);
    if (cleaned.ownerId !== userId || cleaned.orgId !== orgId) return undefined;
    return lifecycleJobRecordSchema.parse(cleaned);
  }

  async getExportDownload(orgId: string, userId: string, jobId: string): Promise<{ job: LifecycleJobRecord; data: OwnerExportData }> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: keys.job(orgId, userId, jobId),
      ConsistentRead: true,
    }));
    if (!result.Item) throw new AuthorizationError("Export job not found", 404);
    const cleaned = cleanItem(result.Item);
    if (cleaned.ownerId !== userId || cleaned.orgId !== orgId) throw new AuthorizationError("Unauthorized access to job", 403);
    const job = lifecycleJobRecordSchema.parse(cleaned);

    if (job.status !== "completed") {
      throw new AuthorizationError("Export job is still processing", 400);
    }
    if (new Date(job.expiresAt).getTime() <= Date.now()) {
      throw new AuthorizationError("Export download has expired (24-hour limit exceeded)", 404);
    }

    let exportData: OwnerExportData;
    if (result.Item.exportPayload && typeof result.Item.exportPayload === "string") {
      exportData = JSON.parse(result.Item.exportPayload) as OwnerExportData;
    } else {
      const scope = exportRequestSchema.parse({ scope: job.scope }).scope;
      exportData = await this.compileOwnerExportData(orgId, userId, jobId, job.expiresAt, scope);
    }
    return { job, data: exportData };
  }

  async createDeletionJob(orgId: string, userId: string, input: DeletionRequest): Promise<LifecycleJobRecord> {
    const validated = deletionRequestSchema.parse(input);
    const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const record: LifecycleJobRecord = {
      entityType: "JOB",
      id: jobId,
      orgId,
      ownerId: userId,
      kind: "delete",
      status: "completed",
      scope: validated.scope,
      expiresAt,
      schemaVersion: 1,
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Synchronously execute full deletion cascade
    await this.executeDeletion(orgId, userId, jobId);

    // Save deletion job record so caller can see completion
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...keys.job(orgId, userId, jobId),
        ...record,
      },
    }));

    await this.saveOutboxEvent(0, "owner.delete", `${orgId}#${userId}#${jobId}`);
    return record;
  }

  async executeDeletion(orgId: string, userId: string, _jobId?: string): Promise<{ success: boolean; deletedCount: number }> {
    let deletedCount = 0;

    // 1. Revoke and purge all owner grants, publications, and recipient inbox pointers
    const grants = await this.listOwnerGrants(orgId, userId);
    for (const grant of grants) {
      await this.revokeGrant(orgId, userId, grant.id).catch(() => {});
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: keys.publication(orgId, grant.id, 1),
      })).catch(() => {});
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: keys.managerInbox(orgId, grant.recipientManagerId).PK, SK: `SHARE#${grant.id}` },
      })).catch(() => {});
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: keys.ownerGrants(orgId, userId).PK, SK: `GRANT#${grant.id}` },
      })).catch(() => {});
      deletedCount += 3;
    }

    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: keys.shareGate(orgId, userId),
    })).catch(() => {});

    // 2. Cascade Invalidation of affected Team and Org Aggregate Releases
    const assignments = await this.getActiveAssignmentsForUser(orgId, userId).catch(() => []);
    for (const assignment of assignments) {
      await this.invalidateAggregateReleases(orgId, assignment.teamId).catch(() => {});
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: keys.teamAssignment(orgId, assignment.teamId, userId),
      })).catch(() => {});
      deletedCount++;
    }
    await this.invalidateAggregateReleases(orgId).catch(() => {});

    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: keys.userTeams(orgId, userId).PK, SK: "TEAM#" },
    })).catch(() => {});

    // 3. Mark member inactive in directory
    const existingMember = await this.getMembership(orgId, userId).catch(() => undefined);
    if (existingMember) {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          ...keys.member(orgId, userId),
          ...existingMember,
          status: "inactive",
          membershipVersion: existingMember.membershipVersion + 1,
        },
      }));
    }

    // 4. Delete user identity pointer
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: `IDENTITY#USER#${userId}`, SK: `ORG#${orgId}` },
    })).catch(() => {});

    // 5. Purge ALL items in PRIVATE# partition
    const privatePartition = keys.privatePartition(orgId, userId);
    const partitionItems = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": privatePartition },
      ConsistentRead: true,
    }));

    for (const item of partitionItems.Items ?? []) {
      if (_jobId && item.SK === `JOB#${_jobId}`) continue;
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: item.PK as string, SK: item.SK as string },
      }));
      deletedCount++;
    }

    // 6. Purge notifications
    const notifications = await this.listNotifications(orgId, userId).catch(() => []);
    for (const notif of notifications) {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: keys.notification(orgId, userId, notif.createdAt, notif.id),
      })).catch(() => {});
      deletedCount++;
    }
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: keys.notificationPreferences(orgId, userId),
    })).catch(() => {});

    // 7. Log content-free administrative audit
    await this.logAdminAudit(orgId, "system", "delete_account", userId, {
      reason: "Owner requested account and data deletion",
      recordsPurged: deletedCount,
    }).catch(() => {});

    return { success: true, deletedCount };
  }

  async cleanupExpiredPrivateItems(orgId: string, userId: string, now = new Date()): Promise<number> {
    const { items } = await this.listPrivateItems(orgId, userId, 100);
    let prunedCount = 0;
    const nowIso = now.toISOString();

    for (const item of items) {
      if (item.lifecycle === "one_time" && item.deleteAfter && item.deleteAfter <= nowIso) {
        await this.deletePrivateItem(orgId, userId, item.id);
        prunedCount++;
      }
    }
    return prunedCount;
  }
}
