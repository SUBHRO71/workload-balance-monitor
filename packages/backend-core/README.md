# @workload/backend-core

Server-only authorization and persistence boundary. Never import it from frontend or client-safe packages. It now provides validated DynamoDB keys, strong-consistency membership/reporting-line reads, versioned owner writes, transactional outbox writes, and authorization gates for owners, current roles, direct managers, team managers, HR, and organization administrators.
