import type { SharingGrant } from "@workload/contracts";

const safe = (value: string): string => {
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(value)) throw new Error("Invalid opaque identifier");
  return value;
};

export const keys = {
  identityOrganizations: (userId: string) => ({ PK: `IDENTITY#USER#${safe(userId)}`, SK: "ORG#" }),
  organization: (orgId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}`, SK: "PROFILE" }),
  member: (orgId: string, userId?: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}`, SK: userId ? `MEMBER#${safe(userId)}` : "MEMBER#" }),
  orgTeam: (orgId: string, teamId?: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}`, SK: teamId ? `TEAM#${safe(teamId)}` : "TEAM#" }),
  teamProfile: (orgId: string, teamId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}#TEAM#${safe(teamId)}`, SK: "PROFILE" }),
  userTeams: (orgId: string, userId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: "TEAM#" }),
  teamAssignment: (orgId: string, teamId: string, userId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}#TEAM#${safe(teamId)}`, SK: `MEMBER#${safe(userId)}` }),
  teamManager: (orgId: string, teamId: string, managerId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}#TEAM#${safe(teamId)}`, SK: `MANAGER#${safe(managerId)}` }),
  invitation: (orgId: string, inviteId?: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}`, SK: inviteId ? `INVITE#${safe(inviteId)}` : "INVITE#" }),
  privatePartition: (orgId: string, userId: string) => `PRIVATE#ORG#${safe(orgId)}#USER#${safe(userId)}`,
  privatePrefix: (orgId: string, userId: string, type: "TASK" | "CHECKIN" | "ITEM" | "OBSERVATION" | "JOB") => ({ PK: keys.privatePartition(orgId, userId), SK: `${type}#` }),
  privateRecord: (orgId: string, userId: string, sortKey: string) => ({ PK: keys.privatePartition(orgId, userId), SK: sortKey }),
  consent: (orgId: string, userId: string) => ({ PK: keys.privatePartition(orgId, userId), SK: "CONSENT" }),
  preferences: (orgId: string, userId: string) => ({ PK: keys.privatePartition(orgId, userId), SK: "PREFERENCES" }),
  lookup: (orgId: string, userId: string, type: "TASK" | "CHECKIN" | "ITEM", id: string) => ({ PK: keys.privatePartition(orgId, userId), SK: `LOOKUP#${type}#${safe(id)}` }),
  job: (orgId: string, userId: string, jobId?: string) => ({ PK: keys.privatePartition(orgId, userId), SK: jobId ? `JOB#${safe(jobId)}` : "JOB#" }),
  grant: (orgId: string, grantId: string) => ({ PK: `GRANT#ORG#${safe(orgId)}#ID#${safe(grantId)}`, SK: "META" }),
  publication: (orgId: string, grantId: string, version: number) => ({ PK: `SHARE#ORG#${safe(orgId)}#GRANT#${safe(grantId)}`, SK: `CONTENT#${version}` }),
  managerInbox: (orgId: string, managerId: string) => ({ PK: `INBOX#ORG#${safe(orgId)}#USER#${safe(managerId)}`, SK: "SHARE#" }),
  ownerGrants: (orgId: string, ownerId: string) => ({ PK: `OWNERGRANTS#ORG#${safe(orgId)}#USER#${safe(ownerId)}`, SK: "GRANT#" }),
  shareGate: (orgId: string, userId: string) => ({ PK: `SHARESTATE#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: "CURRENT" }),
  teamView: (orgId: string, teamId: string, windowId?: string) => ({ PK: `TEAMVIEW#ORG#${safe(orgId)}#TEAM#${safe(teamId)}`, SK: windowId ? `WINDOW#${safe(windowId)}` : "WINDOW#" }),
  organizationView: (orgId: string, windowId?: string) => ({ PK: `ORGVIEW#ORG#${safe(orgId)}`, SK: windowId ? `WINDOW#${safe(windowId)}` : "WINDOW#" }),
  policy: (orgId: string) => ({ PK: `POLICY#ORG#${safe(orgId)}`, SK: "CURRENT" }),
  action: (orgId: string, target: `TEAM#${string}` | "HR", actionId?: string) => ({ PK: `ACTION#ORG#${safe(orgId)}#${target}`, SK: actionId ? `ACTION#${safe(actionId)}` : "ACTION#" }),
  notification: (orgId: string, userId: string, timestamp?: string, noticeId?: string) => ({ PK: `NOTICE#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: timestamp && noticeId ? `NOTICE#${timestamp}#${safe(noticeId)}` : "NOTICE#" }),
  notificationPreferences: (orgId: string, userId: string) => ({ PK: `NOTICE#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: "PREFERENCES" }),
  adminAudit: (orgId: string, timestamp?: string, eventId?: string) => ({ PK: `ADMINAUDIT#ORG#${safe(orgId)}`, SK: timestamp && eventId ? `EVENT#${timestamp}#${safe(eventId)}` : "EVENT#" }),
  outbox: (shard: number, timestamp: string, eventId: string) => ({ PK: `OUTBOX#${shard}`, SK: `EVENT#${timestamp}#${safe(eventId)}` }),
  idempotency: (orgId: string, userId: string, hash: string) => ({ PK: `REQUEST#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: `KEY#${safe(hash)}` }),
} as const;

export function isGrantReadable(grant: Pick<SharingGrant, "status" | "expiresAt">, now = new Date()): boolean {
  return grant.status === "active" && new Date(grant.expiresAt).getTime() > now.getTime();
}
