# Gap Review: Refined Execution Plan

Updated 2026-09-13 against `409757f`, after pulling `origin/main`.
Sources: [product requirements](README.md), [development guidance](docs/development.md), [original review](IMPLEMENTATION_GAP_REVIEW.md), and the proposed 14-gap plan.

## Do the reviews match?

Yes: all 14 proposed areas belong in the backlog. Invitations, scoped exports, access history and backup restoration add useful detail. Many are missing implementation as well as missing tests; adding tests alone will not complete the product.

Keep the original review's additional blockers: authenticated clients, default-off consent, functional navigation, S3 exports, honest job status, scheduling and service-role permissions. The original completion claim is still unsupported.

The earlier verified baseline was 14 suites / 61 tests. The proposed additions total 64, giving 125. Use that as an estimate, not a completion gate: consolidate overlapping scenarios and add missing boundary/failure cases. This documentation update does not rerun tests or certify the newly pulled commit.

## Progress log

### 2026-09-13 — W0/W1 started

- Completed in code: web and mobile consent defaults now start off; task/check-in API creation requires `Idempotency-Key`; API client creation methods carry the key; task/check-in source record, locator, idempotency result and personal-insight outbox event are assembled in one DynamoDB transaction; sequential replay returns the original record and payload reuse is rejected with 409.
- Added `tests/privacy/idempotency.test.ts` with task replay, payload mismatch and check-in replay coverage. Focused run: 15 suites / 64 tests passed.
- Full workspace validation after this batch: `pnpm check` passed (lint, 13 package typechecks, 15 test files / 64 tests, and builds).
- W2 started: invitations now generate a one-time token whose SHA-256 hash is stored, acceptance checks verified-email equality and the token, same-user replay returns the existing membership, and acceptance uses a conditional transaction. `tests/privacy/invitation-lifecycle.test.ts` covers recipient binding, token use, safe replay and reuse denial. Focused run: 16 suites / 65 tests passed.
- Still open: real DynamoDB conditional-write race tests, injected transaction/outbox failure rollback, idempotency expiry/retention, idempotency for every create/job endpoint, cursor security, real client authentication/API integration, and demo/live separation.
- Still open in W2: token delivery/authenticated onboarding integration, legacy invitation migration policy, offboarding archive access, stale-role endpoint tests, and real persistence transaction/race tests.
- Restart here: finish W1 against real persistence, then complete W2 offboarding and stale-role enforcement. Do not mark either work item complete from the in-memory test alone.

### 2026-09-13 — W1/W2/W6 checkpoint

- W1 cursor/version boundary is now implemented: task/check-in/private-item list calls enforce 1–100 page limits and validate opaque cursors against the owner partition and collection prefix; task/check-in updates accept `expectedVersion` and reject stale writes with 409. Added `tests/privacy/pagination-security.test.ts`.
- W2 role revocation coverage now proves current membership beats stale token groups. `updateMember` invalidates aggregate releases when roles/status change. Added `tests/privacy/role-revocation.test.ts`.
- W3 correction handling now validates `disputedVersion`, marks a referenced observation corrected, and synchronously invalidates dependent grants and aggregate releases before returning.
- W6 scoped owner exports now filter `tasks`, `checkins`, `shares`, `personal_records`, and `all`; added four export scope tests to `export-deletion-lifecycle.test.ts`.
- Focused validation: 18 suites / 74 tests passed. Backend typecheck passed. Full `pnpm check` is still required after this checkpoint.
- Still open: real DynamoDB transaction/race and rollback tests; invitation onboarding/offboarding integration; access-history persistence/API; HR/manager endpoint tests; worker generation/idempotency/notification handling; S3 export and deletion-scope semantics; restore markers; authenticated client/cache journeys; real API Gateway JWT tests.
- Restart here: run full `pnpm check`, commit/push this checkpoint, then implement access-history plus worker stale-generation/idempotency handling. Keep the remaining items explicitly open until real persistence or integration evidence exists.

### 2026-09-13 — access-history checkpoint

- Added an `ACCESS_AUDIT` contract and owner-scoped `ACCESSAUDIT#ORG#...#OWNER#...` partition. Successful manager publication reads now write a minimal audit record containing recipient, grant, action and timestamp only; owners can list it through `GET /v1/me/access-history`.
- Extended the sharing lifecycle test to verify one audit record and absence of content fields. Backend typecheck and the full Vitest invocation passed: 18 suites / 74 tests.
- Remaining audit caveat: records are currently append-only without the planned retention/anonymization worker or retry deduplication key. Those are still required for production readiness.
- Restart here: implement worker stale-generation and notification/job idempotency checks, then add HR/manager endpoint isolation tests and an explicit audit-retention test.

### 2026-09-13 — worker safety checkpoint

- Worker parsing now fails malformed or unsupported SQS jobs into the queue retry/DLQ path instead of silently acknowledging them; malformed bodies are not logged.
- Correction invalidation outbox targets now use the organization target expected by the aggregate worker, while existing record-change targets remain backward-compatible.
- Still open: job ID deduplication, expected disclosure-generation checks, notification delivery rechecks, and worker integration tests against SQS/DynamoDB.
- Restart here: add generation/idempotency fields to job contracts and implement safe notification delivery before claiming W5 complete.

Current remote checkpoint: `eaba8a7` on `origin/main`. The last complete `pnpm check` passed at the prior checkpoint (`a0e3f81`); the subsequent worker-only change has backend/workers typechecks passing but should be included in the next full check.

## Correct these assumptions before writing tests

| Proposed expectation | Refined acceptance rule |
| --- | --- |
| IAM is the boundary, not application logic. | Both are required. IAM restricts service namespaces; handlers enforce ownership, current roles, membership, consent, assignments and grants within them. |
| HR/manager users cannot read individual records. | Every role retains its own personal workspace. Deny other owners' records. HR-only fails manager routes; explicitly assigned HR + manager users may use their manager permissions. |
| Managers cannot see individual check-ins. | Explicit publications may contain selected date/rating fields; private notes and unselected source fields remain excluded. |
| Every denied object must return 403. | README allows 404 for absent/inaccessible objects. Use 403 for forbidden role/context and the documented object-concealment response. Always assert no protected content. |
| Expired JWTs should be tested in Lambda handlers. | Test token issuer/audience/expiry/scope at API Gateway with real tokens. Handler tests cover verified claims plus current permissions. Injected claims bypass gateway validation. |
| Invitation retry must succeed but consumed tokens cannot be reused. | Same subject + same idempotency key may replay the original result; another subject or new consumption must fail. Existing status is `accepted`, not `consumed`. |
| Flagging always means corrected. | Distinguish `disputed` from `corrected` and pending from resolved. Invalidate affected disclosure immediately either way. Current correction field is `disputedVersion`; validate it against evidence. |
| Corrected observations can never be action references. | README requires current authorized evidence, not a blanket ban on corrected evidence. Block private observations/invalid publications; define eligibility for newly approved corrected evidence explicitly. |
| Access history is permanent and all repeated views deduplicate. | Proposed audit retention is 365 days, with account-deletion/anonymization exceptions. Revocation preserves history within retention. Deduplicate one event's retries, not distinct genuine views. |
| Pagination must return null and clamp oversized limits. | README specifies bounded pages and authorized opaque cursors, not these conventions. Current clients use optional cursors and the query schema limits pages to 1-100. Recommended: omit exhausted cursor and reject invalid limits with 400; align all contracts if choosing otherwise. |
| Stale jobs silently disappear; any worker failure leaves all data intact. | Stale jobs must not publish; record a safe outcome. Access gates change atomically; cleanup may be incremental and retryable. Failed cleanup must not restore revoked access. |
| Device push is a first-release blocker. | README Section 6 defers device push. First release covers in-app notifications and opted-in generic manager email. |
| All 14 audit invariants are verified. | Gate 10 checks a hard-coded key array; Gate 11 allows either published or suppressed output; Gate 12 asserts a correction record without testing a dependent publication. Separate infrastructure tests inspect actual templates, but the audit title overstates coverage. |

## Evidence and work-item mapping

| ID | Proposed gap(s) | Current code evidence |
| --- | --- | --- |
| W0 | Additional original gaps | [Web app](apps/web/src/app.tsx): landing Get Started opens `/app`, but dashboard tabs only change selection; `DashboardPage` always renders, demo toggle is a no-op, other paths fall back to landing. [Web context](apps/web/src/context/WorkloadContext.tsx) and [mobile](apps/mobile/src/screens/home.tsx) use local seeded data; consent defaults are now off, but clients are not yet API-backed or separated from live data. |
| W1 | 1, 10 | [Store](packages/backend-core/src/dynamo-store.ts): task/check-in creation now carries an idempotency key and includes the personal-insight outbox item in the transaction; sequential replay, bounded limits, cursor ownership/collection validation and stale-version rejection are covered. Real conditional races and failure rollback remain open. |
| W2 | 2, 3, 13 | `acceptInvitation` now checks intended email, token hash, expiry and same-user replay, with conditional membership writes. Current-role checks and revocation tests exist; endpoint/persistence coverage, offboarding archive access and authenticated onboarding remain open. |
| W3 | 4, 5, 6, 7 | `createCorrection` now validates evidence version, marks observations corrected and invalidates dependent disclosures synchronously. No `/v1/me/access-history` route or access-event persistence was found. Ordinary sharing tests exist, but actual role endpoint permissions are not established. |
| W4 | 11, aggregate gaps | [Aggregate worker](services/workers/src/jobs/aggregate.ts) lacks expected generation and defaults to March 2026. Its invalidation target interprets segment two as team ID, while correction jobs send user ID. |
| W5 | 8, 11 | [SQS handler](services/workers/src/job-worker.ts) ignores insight/notification/unknown types; malformed JSON logs raw body and continues. [Dispatcher](services/workers/src/outbox-dispatcher.ts) omits expected generation and explicit idempotency key. |
| W6 | 9, 12 | Store export scope filtering is implemented and tested, but records are still compiled inline in DynamoDB; one page per collection, no S3 upload. Deletion runs synchronously, ignores scope, swallows several failures and reads one private-partition page. No restore-marker replay is implemented. |
| W7 | 14, client gaps | No real client authentication/API journeys or cache lifecycle. Mobile lacks much of the planned page set. E2E/integration directories contain plans rather than executable suites. |
| W8 | Deployment | [CDK](infra/lib/workload-monitor-stack.ts) sets one-month logs but disables PITR and the placeholder weekly schedule. Personal IAM lacks directory writes for invitation acceptance and access-audit reads for the planned history endpoint. Verify required invalidation permissions too. |

## Ordered implementation and test checklist

All boxes are outstanding. For each item attach an implementation commit, test scenario/file, test layer, last result and remaining limitation. Use synthetic fixtures only.

### W0. Establish the baseline

- [ ] Reconcile root/service/test README completion claims with implemented, tested and deployed behavior.
- [ ] Default real-account optional consent off; establish explicit demo identity/data isolation.
- [ ] Create shared fixtures: two owners, two organizations, two teams, manager-only, HR-only, admin-only and a genuine multi-role identity; at least six contributors for overlap scenarios.
- [ ] Create handler and real-persistence harnesses. Keep browser/native and deployed-service tests separate.

Tests: fresh real account has all optional scopes off; server blocks new collection; unavailable API never substitutes sample records; demo activity never targets live data/shares/notifications.

### W1. Durable writes, concurrency and pagination

Partial implementation exists: task/check-in API creation now carries a caller-supplied idempotency key, detects sequential payload reuse and includes its outbox event in the same transaction request. Finish caller/org/operation-scoped idempotency with request fingerprints; conditional versions; atomic record/locator/gate/outbox writes; validated context-bound cursors and page limits.

Tests: `idempotency.test.ts`, `pagination-security.test.ts`, and `tests/integration/write-durability.test.ts`.

- [ ] Same task/check-in request + key returns original ID; changed payload + same key returns 409. Concurrent duplicates produce one record and logical job.
- [ ] Inject outbox/transaction failure: no primary record, locator or successful idempotency result commits alone.
- [ ] Two updates with the same expected version: one succeeds, one returns 409; no lost invalidation work.
- [ ] Alice's cursor fails for Bob, org-A cursor fails in org-B, and task cursor fails on check-ins. Malformed/tampered inputs return the agreed safe error with no data.
- [ ] Real multipage queries return each row once; empty/exhausted pages follow the agreed cursor contract; invalid/oversized limits follow the chosen bound policy.

Exit: failure, concurrency and pagination behavior verified with real persistence.

### W2. Invitations, offboarding and role enforcement

Implement recipient-bound token validation, verified-identity binding, atomic acceptance, idempotent retries and authoritative active/archive context resolution. Preserve global personal access on offboarding.

Tests: `invitation-lifecycle.test.ts`, `role-revocation.test.ts`, `tests/integration/tenant-authorization.test.ts`.

- [ ] Reject expired, revoked, tampered and wrong-recipient invitations. Same authorized retry returns prior result; other-user reuse fails; new consent stays off.
- [ ] Offboard a member: work access/shares stop immediately, while own archived reads/export/deletion and global account remain available.
- [ ] Revoke manager assignment, HR role or admin role after obtaining a token; next endpoint request fails despite stale groups.
- [ ] Reassign former manager: old grants stay closed. Include effective-date and assignment-version cases.
- [ ] Forged owner body/path/header and foreign organization context cannot expose or modify other owners, teams or policies.
- [ ] Gateway rejects invalid/expired tokens; handlers reject valid-token revoked roles. Authorized operations also succeed under actual Lambda roles.

### W3. Sharing, corrections, role isolation and access history

Implement atomic disclosure gates, immutable correction evidence references, authorized human-action references, minimal view events and the owner history endpoint.

Tests: `correction-flow.test.ts`, `hr-isolation.test.ts`, `manager-isolation.test.ts`, `access-audit.test.ts`, and persistence race tests.

- [ ] Confirmation rejects stale source versions/changed manager; recipient sees exactly approved fields. No private notes/items, unselected fields or later-created records.
- [ ] Seed actual evidence, observation, active publication and releases. Correct/flag source; before workers run all affected disclosures fail closed.
- [ ] Validate captured `disputedVersion`; subsequent edits preserve historical reference. Dismissal removes active display but retains owner history.
- [ ] HR-only fails manager routes; manager-only fails HR routes; ordinary members fail work routes. All retain own personal access; explicit multi-role positives pass.
- [ ] Work recipients cannot read source collections or export for another owner. Action references fail when evidence is private, invalid or closed; action records do not copy private values.
- [ ] Each genuine view records recipient/grant/action/time without viewed values; same-event retries deduplicate. Owner/history isolation holds across all workspaces.
- [ ] Revocation preserves audit events within retention; account deletion applies the disclosed audit policy.
- [ ] Race revocation with reads and fail cleanup midway: reads after acknowledged revocation return no protected content and the gate stays closed.

### W4. Aggregation and schedules

Implement typed target IDs, explicit fixed windows, generation checks at publication commit, current audience-specific consent and bounded cohort scheduling. Resolve the user-ID/team-ID mismatch.

Tests: extend aggregate suites and `worker-idempotency.test.ts`.

- [ ] Apply the minimum to distinct contributors per metric/window/audience, not just team size. Missing evidence is not zero; per-person weights and effort units are valid.
- [ ] Team/HR inputs are independently consented; no private items/text or participation identities appear in outputs.
- [ ] Unsafe successive and complementary releases are suppressed; assert suppression specifically, not either of two outcomes.
- [ ] Consent/policy/membership/correction changes during computation prevent an older generation publishing.
- [ ] Scheduler uses intended window/timezone and bounded discovery without private-record scans.

### W5. Queue processing and notification delivery

Implement validated job envelopes, missing personal insight/notification processing, safe retries and DLQ recovery; recheck opt-in/access/expiry at delivery. Device push stays deferred.

Tests: `worker-idempotency.test.ts`, `notification-safety.test.ts`, `tests/integration/queue-delivery.test.ts`.

- [ ] Replaying export/delete/invalidation/notification jobs does not duplicate logical effects; missing/deleted targets finish safely.
- [ ] Revoke a grant or opt out after enqueue: delivery is suppressed. Authorized in-app/email events contain generic content only.
- [ ] Notification links repeat authentication/current access checks; direct links cannot bypass revocation.
- [ ] Malformed/unknown jobs fail observably without logging raw bodies or silently disappearing. Exercise mixed batches, transient failures and DLQ redrive.
- [ ] Crash after side effect but before acknowledgement; retry reconciles state. Document external email guarantees rather than claiming universal exactly-once delivery.

Exit: actual stream -> queue -> worker integration exercised, with safe observable outcomes.

### W6. Export, deletion, retention and restoration

Implement real pending/processing/completed/failed jobs, S3 output, complete pagination, scope filtering, resumable cleanup and durable deletion markers outside the restore path. Enforce expiry at read time and validate scheduled item versions/dates.

Tests: extend `export-deletion-lifecycle.test.ts`; add `tests/integration/export-storage.test.ts` and `tests/integration/restore-safety.test.ts`.

- [ ] `tasks`, `checkins` and `shares` exports contain only selected categories plus safe envelope metadata. Define/test `personal_records` too and agree omitted-versus-empty fields.
- [ ] `all` includes all agreed owner categories across pages without coworkers, aggregates, PK/SK or infrastructure metadata. Define current-org versus all-owned-archives scope before claiming global completeness.
- [ ] Large archives reach S3 before completion; other owners cannot download; expiry denies access even before cleanup; originals survive export expiry.
- [ ] `shares` deletion preserves private records/account. Define/test `personal_records` and `all` deletion separately; current code ignores this scope too.
- [ ] Mid-deletion failure never reports success or restores disclosure. Retry removes every targeted page/pointer/publication/copy, respecting audit exceptions.
- [ ] Extend one-time event date after scheduling: stale trigger cannot delete it. Actual expiry hides it even with delayed cleanup. Ongoing records do not expire.
- [ ] Restore older data into isolation, prove deleted records were reintroduced, then replay durable markers before serving traffic. Reads, exports and workers cannot resurrect deleted content/publications.

### W7. Web and mobile completion

Implement Cognito PKCE/session handling, API data, real navigation, role-aware workspaces, safe caches and online retry states. Follow Expo SDK 57 versioned documentation before mobile edits.

Browser/native tests:

- [ ] Get Started -> `/app`; each dashboard tab displays its page. Deep links, refresh/back and hosted SPA fallback work. Fix today's selected-tab-only behavior.
- [ ] Invitation -> onboarding off defaults -> opt in -> save -> reload returns server record. Failed submissions never claim success.
- [ ] Preview -> confirm -> manager read -> revoke -> next read denied. HR views safe aggregate states only.
- [ ] User A logout then user B login exposes none of A's data. Org/workspace switches clear incompatible data; late A responses cannot refill B's cache.
- [ ] No sensitive offline submissions persist. Cover loading/empty/retry/denied and insufficient/suppressed/stale/corrected displays, text alternatives and timezone boundaries.
- [ ] Export/deletion and complete mobile personal journeys use the real backend. Mobile never adds hidden work dashboards.

### W8. Deployment and pilot evidence

- [ ] Test narrow actual IAM permissions for authorized operations and denied private reads, including Query/batch/transaction/index access. Fix personal invitation/history/invalidation permissions without broad private access for work roles.
- [ ] Replace hard-coded audit assertions with synthesized-resource checks and deployed denied-operation probes.
- [ ] Run `pnpm check`, `pnpm mobile:check`, `pnpm infra:synth` using pnpm 10.30.0. Native bundles/device tests are additional.
- [ ] Review dev stack diff, account/region, schedules and costs before deployment. There is no root `pnpm cdk deploy` script; use the infra workspace CDK executable when deployment is undertaken.
- [ ] Deploy synthetic-only dev fixtures: two owners for isolation and at least six contributors for overlap tests. `.invalid` mailboxes cannot receive verification: use controlled provisioning and a controlled deliverable mailbox for actual email tests.
- [ ] Verify Amplify route fallback/login and native installation/callbacks. Configure budget/operational alerts and verify existing one-month log retention in deployed resources.
- [ ] Select/disclose backup retention, enable PITR as appropriate, and demonstrate marker replay before live traffic. PITR alone does not establish deletion safety.
- [ ] Attach deployed commit/date/environment and manual consent/sharing/suppression/archive/export/deletion acceptance evidence. Show retention disclosures before saving data.

## Test quality and immediate next batch

The [current in-memory DynamoDB double](tests/privacy/in-memory-dynamo.ts) ignores limits, cursors and conditions; transactions apply sequentially without rollback. It cannot prove durability, pagination or race safety. Use it for fast ordinary scenarios; use real persistence for those guarantees and deployed AWS for IAM/JWT/service wiring.

1. Start W0-W1: settle response conventions, build handler/persistence fixtures, implement idempotent task/check-in writes with atomic outbox, then exercise concurrent retries and injected failures.
2. Finish W2 before expanding disclosure: invitation binding and archived-owner access must work under real service permissions.
3. Work W3-W6 in order, pairing code changes with failure/race tests; consolidate duplicate idempotency scenarios.
4. Finish W7 journeys and W8 deployment evidence. Required failures remain open tasks; skipped tests, `it.todo` and permissive assertions do not count toward completion.

No implementation, new tests or deployment is claimed by this documentation refinement.
