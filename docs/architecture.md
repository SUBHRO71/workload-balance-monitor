# Architecture boundaries

Apps depend only on client-safe packages. Contracts, domain, API client, design tokens and UI packages must not depend on backend-core, services, infrastructure or AWS SDKs. Root ESLint blocks these imports in client code; review package dependency changes too.

Backend authorization and storage belong in backend-core. API handlers and job handlers are separate entry points. Automated observations and human manager/HR decisions remain separate records and permissions. Phase 1 implements and deploys this foundation; personal product journeys begin in Phase 2.

Every account retains a personal context. Manager, HR, and organization-admin roles add scoped web workspaces; mobile provides personal features only. Owner access, role membership, reporting relationships, and current consent/grants are evaluated on the server. HR reads organization releases only. The organization administrator manages directory metadata without personal-content access.

Keep raw data under private DynamoDB key namespaces. Manager/HR service roles must not read those namespaces, scan the table, query private index projections, or invoke private workers. Explicit user shares are separate selected-field publications, with fixed record versions and expiring grants. See the [README specification](../README.md) for pages, data schema, IAM boundaries, and API catalogue.
