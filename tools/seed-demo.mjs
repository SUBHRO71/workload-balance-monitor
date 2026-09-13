import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// The AWS CLI loads shared profiles by default; the Node SDK needs this flag
// when a profile is configured in the shared config/credentials files.
process.env.AWS_SDK_LOAD_CONFIG ??= "1";
const region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "us-east-1";
const tableName = process.env.SEED_TABLE_NAME || "WorkloadMonitor-WorkloadMonitorDevelopment";
const profile = process.env.AWS_PROFILE;
let credentials;
if (profile) {
  try {
    const exported = JSON.parse(execFileSync("aws", ["configure", "export-credentials", "--profile", profile, "--format", "process"], { encoding: "utf8", windowsHide: true }));
    credentials = {
      accessKeyId: exported.AccessKeyId,
      secretAccessKey: exported.SecretAccessKey,
      ...(exported.SessionToken ? { sessionToken: exported.SessionToken } : {}),
      ...(exported.Expiration ? { expiration: new Date(exported.Expiration) } : {}),
    };
  } catch {
    throw new Error(`AWS CLI could authenticate profile ${profile}, but its credentials could not be exported for the seed process.`);
  }
}
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region, ...(credentials ? { credentials } : {}) }), { marshallOptions: { removeUndefinedValues: true } });
const now = new Date();
const iso = now.toISOString();
const date = (daysAgo) => new Date(now.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
const id = (prefix, value) => `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
const safe = (value) => value.replace(/[^A-Za-z0-9_-]/g, "-");

const scan = await ddb.send(new ScanCommand({
  TableName: tableName,
  FilterExpression: "begins_with(PK, :directory) AND begins_with(SK, :member)",
  ExpressionAttributeValues: { ":directory": "DIRECTORY#ORG#", ":member": "MEMBER#" },
  ProjectionExpression: "PK, SK, orgId, userId, displayName, email, #roles, #status",
  ExpressionAttributeNames: { "#roles": "roles", "#status": "status" },
}));
const members = (scan.Items ?? []).filter((item) =>
  item.status === "active" &&
  item.orgId &&
  item.userId &&
  item.PK === `DIRECTORY#ORG#${safe(item.orgId)}`,
);
if (members.length === 0) {
  throw new Error(`No active development members found in ${tableName}. Set SEED_TABLE_NAME if the deployed stack uses another table.`);
}

const orgId = members[0].orgId;
const orgMembers = members.filter((member) => member.orgId === orgId);
const extraMembers = [
  { userId: "demo-seed-member", displayName: "Demo Contributor One", email: "demo.contributor1@example.invalid" },
  { userId: "demo-seed-member-2", displayName: "Demo Contributor Two", email: "demo.contributor2@example.invalid" },
];
for (const extra of extraMembers) {
  if (orgMembers.some((member) => member.userId === extra.userId)) continue;
  const extraMember = { orgId, ...extra, roles: ["member"], status: "active", membershipVersion: 1 };
  await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `DIRECTORY#ORG#${safe(orgId)}`, SK: `MEMBER#${extraMember.userId}`, ...extraMember } }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `IDENTITY#USER#${extraMember.userId}`, SK: `ORG#${safe(orgId)}`, orgId, active: true } }));
  orgMembers.push(extraMember);
}
const managers = orgMembers.filter((member) => (member.roles ?? []).includes("manager"));
const manager = managers[0];
const teamId = "demo-team";
const teamName = "Synthetic Product Team";

const put = (item) => ddb.send(new PutCommand({ TableName: tableName, Item: item }));
const privatePk = (userId) => `PRIVATE#ORG#${safe(orgId)}#USER#${safe(userId)}`;
const directoryPk = `DIRECTORY#ORG#${safe(orgId)}`;

await put({ PK: directoryPk, SK: `TEAM#${teamId}`, orgId, teamId, teamName, status: "active", createdAt: iso, updatedAt: iso });
if (manager) {
  await put({ PK: `DIRECTORY#ORG#${safe(orgId)}#TEAM#${teamId}`, SK: `MANAGER#${safe(manager.userId)}`, entityType: "TEAM_MANAGER", orgId, teamId, managerId: manager.userId, status: "active", assignmentVersion: 1, updatedAt: iso, source: "synthetic" });
  await put({ PK: `DIRECTORY#ORG#${safe(orgId)}#USER#${safe(manager.userId)}`, SK: `TEAM#${teamId}`, orgId, teamId, userId: manager.userId, status: "active" });
}

for (const member of orgMembers) {
  const userId = member.userId;
  const pk = privatePk(userId);
  const isManager = (member.roles ?? []).includes("manager");
  await put({ PK: pk, SK: "CONSENT", entityType: "CONSENT", personalProcessing: true, teamAggregation: !isManager, organizationAggregation: !isManager, notifications: { inApp: true, managerEmail: false, devicePush: false }, effectiveAt: iso, schemaVersion: 1, version: 1, createdAt: iso, updatedAt: iso });
  await put({ PK: pk, SK: "PREFERENCES", entityType: "PREFERENCES", timezone: "UTC", weeklyCapacity: { value: 40, unit: "hours" }, workdays: [1, 2, 3, 4, 5] });
  for (let index = 0; index < 6; index += 1) {
    const workDate = date(index * 2);
    const taskId = id("seed-task", `${orgId}:${userId}:${index}`);
    const checkInId = id("seed-checkin", `${orgId}:${userId}:${index}`);
    const taskSk = `TASK#${workDate}#${taskId}`;
    const checkInSk = `CHECKIN#${workDate}#${checkInId}`;
    await put({ PK: pk, SK: taskSk, entityType: "TASK", id: taskId, orgId, ownerId: userId, title: `Synthetic planning item ${index + 1}`, workDate, effort: { value: 3 + index * 0.75, unit: "hours" }, status: index === 0 ? "in_progress" : "done", priority: index === 0 ? "high" : "normal", source: "synthetic", schemaVersion: 1, version: 1, createdAt: iso, updatedAt: iso });
    await put({ PK: pk, SK: `LOOKUP#TASK#${taskId}`, targetSK: taskSk, id: taskId, workDate });
    await put({ PK: pk, SK: checkInSk, entityType: "CHECKIN", id: checkInId, orgId, ownerId: userId, checkInDate: workDate, manageability: Math.min(5, 2 + (index % 4)), source: "synthetic", schemaVersion: 1, version: 1, createdAt: iso, updatedAt: iso });
    await put({ PK: pk, SK: `LOOKUP#CHECKIN#${checkInId}`, targetSK: checkInSk, id: checkInId, checkInDate: workDate });
    await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: pk, SK: `TASK#${taskId}` } }));
    await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: pk, SK: `CHECKIN#${checkInId}` } }));
  }
  const privateId = id("seed-private", `${orgId}:${userId}`);
  await put({ PK: pk, SK: `ITEM#${privateId}`, entityType: "PRIVATE_ITEM", id: privateId, orgId, ownerId: userId, type: "note", title: "Synthetic personal planning note", lifecycle: "ongoing", schemaVersion: 1, version: 1, createdAt: iso, updatedAt: iso });
  if (!isManager && manager) {
    await put({ PK: `DIRECTORY#ORG#${safe(orgId)}#TEAM#${teamId}`, SK: `MEMBER#${safe(userId)}`, orgId, teamId, userId, directManagerId: manager.userId, effectiveFrom: iso, assignmentVersion: 1, status: "active" });
    await put({ PK: `DIRECTORY#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: `TEAM#${teamId}`, orgId, teamId, userId, status: "active" });
  }
  await put({ PK: `NOTICE#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: "PREFERENCES", inAppEnabled: true, emailEnabled: false, weeklyDigestEnabled: false });
  const noticeId = id("seed-notice", `${orgId}:${userId}`);
  await put({ PK: `NOTICE#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: `NOTICE#${iso}#${noticeId}`, id: noticeId, orgId, userId, title: "Synthetic workspace ready", message: "Synthetic development records are available for review.", category: "system", read: false, link: "/app", createdAt: iso });
}

const contributors = orgMembers.filter((member) => !(member.roles ?? []).includes("manager")).map((member) => member.userId);
if (contributors.length < 5) throw new Error("Synthetic aggregate was not published because fewer than five non-manager contributors were prepared.");
const range = { from: date(13), to: date(0) };
const windowId = `${range.from}_${range.to}`;
const metrics = [
  { key: "meanWeeklyEffort", value: 29.3, contributorCountBand: "5-9" },
  { key: "meanManageability", value: 3.2, contributorCountBand: "5-9" },
];
await put({ PK: `POLICY#ORG#${safe(orgId)}`, SK: "CURRENT", orgId, minimumContributors: 5, policyVersion: 1, disclosureGeneration: 0 });
await put({ PK: `TEAMVIEW#ORG#${safe(orgId)}#TEAM#${teamId}`, SK: `WINDOW#${windowId}`, state: "available", range, generatedAt: iso, evidenceStrength: "developing", metrics, contributorIds: contributors, policyVersion: 1, disclosureGeneration: 0 });
await put({ PK: `ORGVIEW#ORG#${safe(orgId)}`, SK: `WINDOW#${windowId}`, state: "available", range, generatedAt: iso, evidenceStrength: "developing", metrics, contributorIds: contributors, policyVersion: 1, disclosureGeneration: 0 });

console.log(JSON.stringify({ tableName, orgId, membersSeeded: orgMembers.length, teamId, managerId: manager?.userId ?? null, source: "synthetic" }, null, 2));
