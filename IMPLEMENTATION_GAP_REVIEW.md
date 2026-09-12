# Implementation and Test Gap Review

> Start with [the refined gap review and execution checklist](GAP_EXECUTION_README.md), updated against `409757f`. This original review remains as historical evidence for commit `f9ab28e`; its UI and policy descriptions must not be used as current acceptance criteria.

Review date: 2026-09-13  
Reviewed commit: `f9ab28ef85e7ce8e3b879f2d84e8062b0c612c17` (`docs: mark phase 6 complete and update delivery status in README`)  
Requirements source: the root `README.md`, especially Sections 1-5, 8, and 10

## Executive conclusion

The reviewed commit changes only `README.md`, marking Phases 0-6 complete and claiming that all release gates and product journeys pass end-to-end verification. The repository contains meaningful contracts, domain rules, DynamoDB repository code, Lambda handlers, CDK resources, and 61 passing automated tests. However, the evidence does **not** support describing the planned first release as fully implemented or end-to-end verified.

The largest gaps are:

1. The web and mobile applications are local, in-memory demonstrations and are not connected to Cognito or the API.
2. There are no executable browser, mobile, HTTP-handler, real-DynamoDB, SQS, S3, or deployed-stack end-to-end tests.
3. Owner exports are stored inline in DynamoDB rather than in the private S3 bucket described by the README, and export/deletion requests are completed synchronously before their queued workers run.
4. Scheduled aggregate and lifecycle processing is not operational. The only schedule is disabled and sends an unsupported placeholder job.
5. Several required job types and operational guarantees are not implemented or verified, including personal insights, notification delivery, retries/idempotency, DLQ recovery, and backup/deletion recovery.
6. Consent defaults to **on** in both user interfaces, contrary to the stated default-off rule.

The latest status change should be reverted or qualified. A defensible current description would be: backend/domain prototypes and synthetic privacy tests are implemented; production client integration and end-to-end release verification remain incomplete.

## Requirement-to-implementation gaps

| Severity | README requirement or claim | Repository evidence | Gap / required follow-up |
| --- | --- | --- | --- |
| Critical | All phases and personal/work journeys are fully implemented and verified end to end. | `apps/web/src/app.tsx` switches components with React state; `apps/web/src/context/WorkloadContext.tsx` owns demo records in memory. `apps/mobile/App.tsx` renders one local `HomeScreen`. Neither client uses `@workload/api-client`, Cognito, persisted sessions, or server data. | Implement client authentication and API integration, real route/navigation handling, loading/error/denied states, and executable end-to-end journeys. Do not call the local demonstrations completed product work. |
| Critical | All consent choices are initially off, and enforcement is server-side. | Web context initializes `personalProcessing: true`. Mobile `home.tsx` also initializes it to `true` while displaying text that all defaults are off. UI state is local and never reaches the server. | Default every optional scope to false outside an explicitly isolated demo identity. Persist changes through `PUT /v1/me/consent`, re-fetch authoritative consent, and add client/server integration tests. |
| Critical | Owner export is a background job producing an owner-only archive in private S3 with a 24-hour download period. | `createExportJob` immediately sets `status: "completed"`, compiles the export synchronously, and writes `exportPayload` into the DynamoDB job item. The configured `EXPORT_BUCKET_NAME` is unused; there is no S3 `PutObject`/`GetObject`. The worker recompiles data but does not store it or update job state. | Implement queued status transitions, S3 object creation/read, authenticated download delivery, failure state, retry/idempotency, and expiry cleanup. Test with AWS-compatible integrations. Large inline exports also risk DynamoDB's item-size limit. |
| Critical | Permanent account deletion is a background lifecycle workflow with operational recovery/backup handling. | `createDeletionJob` marks the job complete and executes deletion synchronously. The queue subsequently invokes deletion again. No recovery procedure, backup erasure policy, restore test, partial-failure handling, or reconciliation is present. | Define the deletion state machine and idempotent worker, prove all relevant partitions/pointers/releases are covered, and document/test backup retention and recovery behavior before a live-data pilot. |
| High | Protected aggregates and retention run through bounded scheduled processing. | `WeeklyAggregationFoundation` is `DISABLED`, describes Phase 4 as unimplemented, and emits `aggregation.not-enabled`, which `job-worker.ts` ignores. No schedule enumerates eligible organizations/users for aggregate generation or one-time-item pruning. | Add safe, bounded scheduling and discovery, enable it only after integration verification, and test stale/duplicate schedules and changed item versions. |
| High | Queue jobs include personal insights, aggregate publication/invalidation, exports, deletion, lifecycle scheduling, and notification delivery. | `job-worker.ts` handles only aggregate/invalidation and three lifecycle strings. It silently ignores `personal.insight` and `notification.deliver` (and any unknown valid-looking job). | Implement all catalogue job types or narrow the README scope. Unknown types should fail observably and be eligible for retry/DLQ handling. |
| High | Committed outbox, retry, poison-message DLQ, stale-generation checks, and idempotent handling prevent lost or duplicated work. | CDK provisions SQS/DLQ, but tests do not execute the stream dispatcher or SQS Lambda handler. No test proves partial-batch failure behavior, deduplication, retry safety, poison-message redrive, or recovery. The worker loops records and has no partial batch response. | Add idempotency records/conditions where needed, partial batch responses, integration tests for duplicate and partial failure, and operational DLQ alarms/runbooks. |
| High | Web routes and pages listed in Section 3 exist with role-aware navigation and deep links. | The web app has no router. It uses an `activeTab` state, exposes workspaces in one app shell, and lacks real `/sign-in`, `/auth/callback`, `/join`, `/onboarding`, record detail, observation detail, share detail, manager detail, action detail, and admin audit URLs. | Implement URL routes, authorization-aware workspace discovery, direct-link behavior, and route-level access/error states. Add route and browser tests. |
| High | Mobile supports authentication, personal dashboards, CRUD, trends/observations, sharing, notifications, settings, and corrections. | Mobile has one screen with dashboard/tasks/check-in/private/consent tabs. Data is preloaded and local. Task/check-in edit/delete coverage is incomplete; sharing, trends, observations, notifications, settings, authentication, onboarding, and API persistence are absent. | Complete the stated mobile scope and verify native bundles plus device/simulator flows. |
| High | Demo identities and records never mix with live organizations, publications, or notifications. | Web starts with `isDemoMode: true`, but the toggle does not select a separate data/auth backend. The same in-memory context is used regardless of the toggle. Mobile always seeds `demo-org`/`demo-user` data without an explicit separate demo entry. | Create a hard demo/live boundary with separate configuration, identity, storage, and visible labeling. Test that demo data cannot call live mutation/share/notification endpoints. |
| High | API creates/jobs use idempotency keys; updates use expected versions and return `409` for stale writes. | API Gateway allows an `idempotency-key` header, and a key helper exists, but handlers do not require/use that header. Mutation handlers do not read an expected version from headers, and repository update methods generally derive the current record before writing. | Enforce idempotency and optimistic concurrency at the HTTP boundary with conditional writes. Add replay and concurrent-update handler tests. |
| High | New organizational activity requires current membership; organization context is authoritative. | Personal handlers accept `x-org-id` before considering the caller's memberships. No common guard proves the requested organization is an active or archived context before all personal operations. | Resolve organization context from authoritative memberships/archived ownership and reject arbitrary tenant headers. Add forged-header and offboarding tests through the HTTP handler. |
| Medium | API collections have bounded sizes and authorized opaque cursors. | Personal handlers use raw `Number(...)`, default to 50, and pass caller-controlled limits/cursors directly. Cursors are base64-encoded DynamoDB keys, not authenticated/opaque, and parsing errors are not consistently mapped to `400`. | Validate query schemas, enforce the 1-100 bound, and sign/encrypt or server-map cursors. Test malformed, forged, cross-owner, negative, and excessive inputs. |
| Medium | Workload APIs use suitable scopes; authentication and authorization are distinct. | Every API route—including writes and administrative operations—uses the single `workload-monitor/read` authorization scope. | Define and enforce appropriate mutation/admin scopes, or document why application authorization alone is the intended model. Add JWT claim/scope handler tests. |
| Medium | Notifications support opted-in delivery channels and safe links. | In-app records/preferences exist, but no actual email/push delivery implementation is present and `notification.deliver` is ignored. | Implement only explicitly opted-in channels, safe templates/links, unsubscribe/revocation behavior, and delivery integration tests; otherwise label email/push as deferred. |
| Medium | All data pages provide loading, empty, saved/pending, retry, access-denied, freshness, and privacy states; charts have text alternatives and timezone-aware dates. | Current clients operate synchronously in memory and therefore do not implement or verify most network/error/accessibility/timezone states. | Add a UI-state acceptance matrix and component/browser/native tests for each required state. |
| Medium | Documentation accurately describes current behavior. | Root Section 8 still says only `/health` and `/v1/me` are exposed, while infra routes proxy trees for personal, invitation, manager, HR, and admin APIs. `infra/README.md`, `services/api/README.md`, `services/workers/README.md`, and all three test READMEs also describe earlier/incomplete phases. | Reconcile documentation with the actual implementation. Keep planned, prototype, deployed, and verified statuses separate. |

## Test gaps

### Existing coverage that is useful

- Consent schemas default omitted scopes to false.
- Domain tests cover the minimum-five rule, equal weighting, and one successive-release overlap case.
- Store-level synthetic tests cover task/check-in/private-item operations, sharing projections, authorization helpers, aggregate records, admin isolation, and lifecycle methods.
- CDK assertion tests inspect selected IAM leading-key conditions and the disabled schedule.
- Synthetic fixtures use invalid domains and deterministic data.

### Missing or insufficient coverage

1. **No end-to-end suites.** `tests/e2e/README.md` explicitly says Playwright and Maestro suites are planned. There are no executable sign-in, onboarding, CRUD, sharing, manager, HR, admin, export, deletion, or notification user journeys.
2. **No integration suites.** `tests/integration/README.md` explicitly says no live AWS integration tests exist. Tests call `WorkloadStore` directly with `tests/privacy/in-memory-dynamo.ts`, bypassing API Gateway, JWT parsing, Lambda handlers, real DynamoDB expressions/transactions, Streams, SQS, S3, Cognito, and EventBridge Scheduler.
3. **The “14-point release-gates audit” is not a full audit.** Several cases prove a narrower property than the gate name suggests. For example, owner isolation lists Bob's own partition rather than attempting a forged HTTP owner lookup; multi-role coverage checks one unassigned team; IAM coverage inspects synthesized strings; deletion coverage does not address backups; and notification coverage does not execute delivery.
4. **No HTTP contract tests.** Status codes, headers, payload schemas, malformed requests, route/method matching, pagination, idempotency keys, expected versions, inaccessible-object `404`s, and absence of private data in errors are not systematically tested through handlers.
5. **No authentication tests.** There is no PKCE client flow, callback/session/refresh/logout test, invalid issuer/audience/scope test, stale-token role test through API Gateway, or client cache clearing test when organization/workspace changes.
6. **No real persistence tests.** Conditional writes, transactions, consistent reads, cursor behavior, item-size limits, DynamoDB TTL timing, concurrent consent/revocation races, and stream records are not verified against DynamoDB Local or an ephemeral AWS stack.
7. **No queue reliability tests.** Duplicate delivery, partial batch failure, retry, DLQ redrive, stale generation rejection, malformed payload handling, and unknown job handling are untested.
8. **No S3 export tests.** Bucket permissions/lifecycle synthesize, but no archive is written to or read from S3 and no presigned/authenticated object behavior is tested.
9. **No UI tests.** There are no component, accessibility, visual, router, browser, native device, offline/cache, or timezone tests.
10. **No deployment verification.** CDK synthesis passes, but this review found no current deployment diff, smoke test, API request, CloudWatch alarm check, or proof that the deployed `us-east-1` stack matches the repository.
11. **No operational recovery tests.** There are no backup/restore, deletion-versus-backup, DLQ replay, rollback, throttling, alarm, or incident-runbook exercises.
12. **No test for the UI consent-default regression.** Contract defaults pass while both UIs explicitly override personal processing to true.

## Documentation corrections recommended immediately

Until the gaps above are closed, update the root README as follows:

- Replace “Phases 0 through 6 are fully implemented and verified” with a qualified status that separates backend prototypes, client demonstrations, deployed infrastructure, and verified production journeys.
- Reopen at least the client integration and operational portions of Phases 2-6.
- Replace “pass end-to-end verification” and “comprehensive 14-point audit” with “61 synthetic unit/store tests pass,” unless executable end-to-end and integration evidence is added.
- Remove the claim that exports are stored in private S3 until the code actually uses the bucket.
- State that the aggregate schedule remains disabled and lifecycle pruning has no operational scheduler.
- Update package/service/test READMEs so they do not contradict the root README or current route configuration.

## Suggested acceptance evidence before declaring completion

1. An authenticated web journey and authenticated mobile journey against an ephemeral deployed stack.
2. Handler contract tests for every documented endpoint and denial case.
3. DynamoDB/SQS/S3 integration tests covering concurrency, duplicate jobs, retries, DLQ, export lifecycle, and deletion reconciliation.
4. Playwright coverage for personal, manager, HR, and admin routes; native simulator coverage for the complete mobile scope.
5. A traceable Section 10 matrix linking every release gate to tests that exercise the actual boundary named by the requirement.
6. Deployment smoke results and an operational checklist for alarms, backup/restore, data deletion, and disabled/enabled schedules.

## Validation performed during this review

- `pnpm check` — passed: lint, type checks, 14 test files / 61 tests, and builds.
- `pnpm mobile:check` — passed: Expo dependencies reported up to date.
- `pnpm infra:synth` — passed: `WorkloadMonitorDevelopment` synthesized.

These results establish compilation, lint cleanliness, synthetic unit/store behavior, and successful CDK synthesis. They do not establish end-to-end product behavior or production privacy certification.
