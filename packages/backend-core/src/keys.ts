import type { SharingGrant } from "@workload/contracts";

const safe = (value: string): string => {
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(value)) throw new Error("Invalid opaque identifier");
  return value;
};

export const keys = {
  identityOrganizations: (userId: string) => ({ PK: `IDENTITY#USER#${safe(userId)}`, SK: "ORG#" }),
  organization: (orgId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}`, SK: "PROFILE" }),
  member: (orgId: string, userId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}`, SK: `MEMBER#${safe(userId)}` }),
  userTeams: (orgId: string, userId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}#USER#${safe(userId)}`, SK: "TEAM#" }),
  teamAssignment: (orgId: string, teamId: string, userId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}#TEAM#${safe(teamId)}`, SK: `MEMBER#${safe(userId)}` }),
  teamManager: (orgId: string, teamId: string, managerId: string) => ({ PK: `DIRECTORY#ORG#${safe(orgId)}#TEAM#${safe(teamId)}`, SK: `MANAGER#${safe(managerId)}` }),
  privatePartition: (orgId: string, userId: string) => `PRIVATE#ORG#${safe(orgId)}#USER#${safe(userId)}`,
  privatePrefix: (orgId: string, userId: string, type: "TASK" | "CHECKIN" | "ITEM" | "OBSERVATION" | "JOB") => ({ PK: keys.privatePartition(orgId, userId), SK: `${type}#` }),
  privateRecord: (orgId: string, userId: string, sortKey: string) => ({ PK: keys.privatePartition(orgId, userId), SK: sortKey }),
  consent: (orgId: string, userId: string) => ({ PK: keys.privatePartition(orgId, userId), SK: "CONSENT" }),
  grant: (orgId: string, grantId: string) => ({ PK: `GRANT#ORG#${safe(orgId)}#ID#${safe(grantId)}`, SK: "META" }),
  publication: (orgId: string, grantId: string, version: number) => ({ PK: `SHARE#ORG#${safe(orgId)}#GRANT#${safe(grantId)}`, SK: `CONTENT#${version}` }),
  managerInbox: (orgId: string, managerId: string) => ({ PK: `INBOX#ORG#${safe(orgId)}#USER#${safe(managerId)}`, SK: "SHARE#" }),
  ownerGrants: (orgId: string, ownerId: string) => ({ PK: `OWNERGRANTS#ORG#${safe(orgId)}#USER#${safe(ownerId)}`, SK: "GRANT#" }),
  teamView: (orgId: string, teamId: string) => ({ PK: `TEAMVIEW#ORG#${safe(orgId)}#TEAM#${safe(teamId)}`, SK: "WINDOW#" }),
  organizationView: (orgId: string) => ({ PK: `ORGVIEW#ORG#${safe(orgId)}`, SK: "WINDOW#" }),
  policy: (orgId: string) => ({ PK: `POLICY#ORG#${safe(orgId)}`, SK: "CURRENT" }),
  outbox: (shard: number, timestamp: string, eventId: string) => ({ PK: `OUTBOX#${shard}`, SK: `EVENT#${timestamp}#${safe(eventId)}` }),
} as const;

export function isGrantReadable(grant: Pick<SharingGrant, "status" | "expiresAt">, now = new Date()): boolean {
  return grant.status === "active" && new Date(grant.expiresAt).getTime() > now.getTime();
}
