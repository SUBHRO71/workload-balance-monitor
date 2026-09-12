# Architecture boundaries

Apps depend only on client-safe packages. Contracts, domain, API client, design tokens and UI packages must not depend on backend-core, services, infrastructure or AWS SDKs. Root ESLint blocks these imports in client code; review package dependency changes too.

Backend authorization and storage belong in backend-core. API handlers and job handlers are separate entry points. Automated observations and human manager decisions remain separate records and permissions. No product features or cloud resources are implemented by this scaffold.
