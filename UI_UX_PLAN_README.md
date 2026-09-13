# Pulse UI/UX Plan — Web and Mobile

Status: proposed implementation plan; no screen redesign has been implemented by this document.

Baseline: repository commit `011aa99`, reviewed 2026-09-13. Product authority: [README Sections 1–5](README.md), with engineering constraints from [development guidance](docs/development.md). Track backend readiness separately in [GAP_EXECUTION_README.md](GAP_EXECUTION_README.md).

## 1. Intended experience

Pulse should feel like a quiet, trustworthy personal workspace: clear text, restrained forest-green accents, soft neutral surfaces, and one obvious next action. A member should understand what was saved, who can see it, and what to do next without reading technical explanations. Managers should distinguish explicitly shared snapshots from team statistics. HR should understand organization trends without seeing individuals. Administrators should manage membership without entering personal workspaces.

Preserve the existing Pulse mark and recognizable green identity. Extend the existing design rather than introducing a new brand. The landing page explains the product; authenticated screens prioritize completing tasks. This is a workload reflection tool: no scores, leaderboards, clinical labels, or pressure to enable consent.

Planning assumptions: English first; light appearance first; desktop web and responsive web. Personal journeys belong to a member account with no work role. Manager, HR and admin accounts are role-isolated to their permitted work workspace; work dashboards remain on the website and native shows an explicit website handoff. A future request to combine personal and work views for multi-role accounts would be a scope change.

## 2. Evidence from the current screens

This is a source-based review, informed by the earlier login screenshots. It is not a fresh visual/device audit. No current screenshot set establishes exact rendering at all breakpoints. Root README completion claims conflict with parts of the implementation; use its product requirements, not its completion claims, as the design contract.

| Finding | Evidence | Planned correction |
| --- | --- | --- |
| Work roles lose personal web navigation | `apps/web/src/app.tsx` builds work-only `allowedTabs`; `Navigation.tsx` shows only the active work tab | Restore personal access for everyone; add workspace switching and multi-role navigation |
| Mobile blocks managers, HR, and admins behind a web-only message | `RootNavigator.tsx` returns `WorkOnlyScreen` whenever a work role exists | Open personal Home for every authenticated role; put work-dashboard links in account settings |
| Mobile personal journeys share one large screen | `apps/mobile/src/screens/home.tsx` contains five local tabs and forms | Separate navigable screens with persistent tab destinations and detail/form stacks |
| Visual rules are scattered | Inline styles across web pages; shared tokens contain five colors and four spacing values | Extend semantic tokens and platform components before polishing pages |
| Loading failure can resemble an empty account | `WorkloadContext.tsx` loads collections together and only logs failure | Visible per-section loading/error/retry; prevent partial failures erasing valid content |
| Some feedback is misleading | `SettingsPage.tsx` sets success without awaiting save; `NotificationsPage.tsx` has local sample notices and enabled default | Await persistence; remove fixture content from real sessions; keep notification choices off |
| Sharing preview is incomplete as a user explanation | `SharingPage.tsx` renders selected values into compact cards and builds input again at confirmation | Show every selected field, recipient, date range and exact expiry; confirm the reviewed selection and versions |
| Mobile entry assumes too much | `home.tsx` uses today's UTC date, defaults a rating, and falls back from invalid effort to a number | Use the user's timezone, require explicit rating choice, validate effort, preserve failed input |
| Large collections are only partially loaded | Web context requests 100 records; mobile requests 20 | Add cursor pagination and label summaries with actual window/coverage |

Priority is correctness of the journey, then information hierarchy, then visual polish. A prettier false-success message is still a broken experience.

## 3. Role and navigation model

| Account context | Web | Native mobile | Default destination |
| --- | --- | --- | --- |
| Member | My workspace | Personal tabs | Home |
| Manager | Manager workspace only | Manager website handoff | Manager overview |
| HR | HR workspace only | HR website handoff | HR overview |
| Admin | Administration workspace only | Administration website handoff | Admin people |
| Multiple work roles | Only the explicitly granted work tabs | Work-role handoff with no personal data | First granted work role |
| Offboarded membership | Own archived data subject to backend support | Own archived data subject to backend support | Explain archived context and available owner actions |

### Web shell

Desktop: a 240px sidebar, compact top bar, and bounded content area. Top bar shows organization, workspace switch, notifications, and account menu. Sidebar groups destinations by the selected workspace. Page header contains title, one-sentence purpose, freshness if relevant, and primary action.

Personal navigation is available only to accounts without a work role: Home, Tasks, Check-ins, Private items, Trends, Sharing, Notifications, Privacy & data and Settings. A manager, HR or admin sees only the permitted role workspace; no personal tabs are rendered or prefetched. Manager: Overview, Shared with me, Decisions. HR: Overview, Decisions. Administration: People, Invitations, Teams, Policies, Audit log.

At compact widths, replace the sidebar with a labelled menu sheet. Retain organization/workspace context in the header. Avoid multiple wrapping rows of equal-weight navigation buttons. Workspaces stay reachable even for multi-role accounts.

### Native shell

Member accounts use five labelled bottom destinations: Home, Tasks, Check-in, Sharing, More. Work-role accounts show a role-specific handoff screen with the permitted website destination and sign-out; they do not receive personal data tabs. Check-in opens a normal screen, not an automatic submission.

Use a navigation stack for task details, editing, private items, observations, and share composition. Maintain iOS back/swipe conventions and Android system back. Leaving a dirty form offers Keep editing or Discard; routine tab changes preserve in-memory drafts for that user/context. Clear drafts on logout and incompatible context switches. Do not introduce persistent offline personal storage before its consent and retention policy exists.

### URL contract

Adopt the README's canonical routes: `/app`, `/app/tasks`, `/app/check-ins`, `/app/private`, `/app/trends`, `/app/sharing`, `/app/privacy`, `/app/notifications`, `/app/settings`; details use IDs. Work routes use `/manager`, `/manager/shared`, `/manager/teams/:teamId`, `/hr`, and `/admin` with named subsections.

Redirect existing `/app/checkins`, `/app/manager`, `/app/hr`, and `/app/admin` links to their canonical equivalents. Add real back/forward handling, safe post-login return paths, not-found states and access-denied states. Keep Hooks unconditional during routing refactors. Validate authorization on the backend for every request; a workspace switch is not permission.

## 4. Visual design specification

| Element | Proposed rule |
| --- | --- |
| Surfaces | Retain background `#F4F7F5`, white surface, text `#193A2A`, secondary text `#52665B`, primary green `#326855` |
| Additional semantic tokens | Border, focus ring, selected surface, disabled text, success, warning, danger; verify every foreground/background pair before use |
| Typography | Web: system sans initially; native: platform system font with Dynamic Type/font scaling. Body 16/24, labels 14/20, section headings 20/28, page titles 28–32/36–40; tabular numerals for comparable values |
| Spacing | Extend existing 8/16/24/40 scale with 4/12/32/48. Default page inset 24 desktop, 16 compact; section separation 24–32 |
| Shape | Controls 8px radius, grouped surfaces 12px, modal/sheet 16px. Use separators for lists; reserve cards for meaningful groups |
| Hierarchy | One filled primary button per screen mode; secondary outlined/text actions; destructive style only for destructive actions |
| Icons | One consistent outlined family for web; platform-appropriate equivalents on native. Labels for navigation and meaningful actions; replace decorative emoji controls |
| Motion | Brief 120–200ms feedback and 180–240ms panel transitions as design targets; reduce/disable nonessential movement when requested by the OS |
| Charts | Green effort series; distinct labelled manageability series on its own 1–5 scale. Missing values stay missing. Provide a text/table alternative |
| Imagery | Keep Pulse's existing brand artwork on welcome/landing. No stock imagery or decoration competing with data entry |

These are proposed design choices, not measured compliance claims. Keep a single token source in `packages/design-tokens`; build web/native adapters in `packages/ui-web` and `packages/ui-native`. Do not apply web pixel assumptions directly to native font scaling.

Reusable components: AppShell, WorkspaceSwitcher, PageHeader, Button, FormField, StatusBadge, EmptyState, ErrorState, CollectionList, ConsentRow, SharePreview, TrendPanel, ConfirmationDialog, JobStatus. Keep domain authorization and persistence outside visual components.

## 5. Screen-by-screen plan

| Existing or required screen | Hierarchy and primary action | Mobile adaptation / important state |
| --- | --- | --- |
| Landing / Welcome | Pulse identity → one-sentence purpose → three concrete benefits → privacy summary → Get started | Short first viewport; CTA reaches sign-in; demo entry only when isolated demo exists |
| Login / callback | Sign in → secure sign-in button → recovery/help → return to welcome | System browser on native; visible cancellation, expired-session and retry states; no user-selectable privileged role |
| Join / onboarding (required addition) | Validate invitation → explain account/workspace → optional preferences → independent consent choices → Home | Short steps, progress/back controls, Continue with choices off; distinguish expired, used and wrong-account invitations |
| Dashboard / Home | Current week → Add task → optional check-in → trend summary → recent entries → sharing summary | Single column; short entry shortcuts; insufficient evidence is explanatory, never a zero score |
| Tasks | Date/status filter → task list → Add task; each row opens detail/edit | Compact cards: title, date, effort, status; optional fields collapsed in form; pagination/load more |
| Check-ins | Question → labelled 1–5 choice → optional private reflection → Save privately → history | No default selection; rating labels describe manageability; keyboard-safe save area; edit/delete history |
| Private items | Owner-only label → items → Add private item; choose ongoing or dated item | Date required for one-time item; display server-derived removal date; no share control |
| Trends | Reporting window → effort chart → manageability chart → coverage explanation → observations | Short range selector, readable summary and table; capacity line only if owner supplied compatible units |
| Observation detail (required addition) | Explanation → evidence/window/freshness → review source → correct or dismiss | Correction form retains input; share requires a separate intentional flow |
| Sharing center | Active shares → recipient/expiry/status → New share; past shares secondary | Readable cards; last-view history only when backed by audit data; revoke stays discoverable |
| Share composer | Records and fields → named recipient/window/expiry → exact review → Confirm share | Full-screen steps; Back preserves choices, changing any choice invalidates preview; show all selected values including status |
| Privacy & data | What each audience sees → independent controls → export → deletion | Each toggle explains its own scope; save pending/retry; destructive action separated from routine preferences |
| Notifications | Unread/all → genuine generic notices → authorized destination; channel preferences secondary | Empty inbox is honest; no sample manager reads or implied aggregate participation |
| Settings | Profile → timezone/workdays → optional capacity → organization/security/session | Allow capacity to remain unset; await save response; logout clears personal state |
| Manager overview | Assigned team → released window/freshness → approved statistics → Review decisions | Responsive website; suppressed release omits chart; no person-level drilldown or exact small cohort counts |
| Shared with me | Active publications → selected share → approved fields/expiry → separate decision action | Server-revalidated detail, readable field labels, unavailable-after-revoke state; never fetch source tasks |
| Manager decisions | Open/follow-up status → decision list → Record decision | Separate from shared values; clear author/date/status, save/retry and reference validity |
| HR overview | Organization/window → released statistics → evidence/limitations → follow-up | Responsive website; no individual names, participation list or team filter that creates unauthorized cohorts |
| HR decisions | Organization decisions → status/follow-up → Record decision | Same components as manager, organization audience explicit |
| Admin people | Search/filter directory → member detail → roles/status | Role changes show consequence before confirmation; never a personal-record link |
| Admin invitations | Email → roles → optional team/manager → review → create | Status/expiry and retry; represent delivery truthfully; do not say Sent if only created |
| Admin teams | Team list → assignments → update reporting line | Confirm impact on existing shares; labels identify manager and effective date |
| Admin policies | Current privacy floor → explanation → edit/save | UI enforces minimum 5 and server remains authoritative; no consent override |
| Admin audit | Time/action filters → minimal audit rows → detail | Readable events rather than raw JSON; excludes personal content |

Native gaps are additions, not completed screens: sharing, trends/observation detail, notifications, dedicated settings and full export/deletion journeys need implementation beyond restructuring `home.tsx`.

## 6. Key flows and interaction contracts

### First session

Welcome → Cognito sign-in → invitation/membership resolution → short onboarding → My workspace. User may continue with all choices off. Home explains “Personal storage is off” and offers Review privacy choices without hiding account controls. No active membership must produce a clear archived/pending/unassigned state, not an endless loader.

### Save a task or check-in

Open form → enter required fields → validate → save pending → server success → saved entry. Preserve input on errors; retries reuse the same idempotency key for unchanged input. Changing input starts a new logical request. Never silently convert an invalid number to 1 or report successful storage before the response. Refresh/relogin must retrieve the entry.

### Share with a manager

Select existing records → choose allowed fields → review named manager, reporting window and expiry → server preview → confirm the exact reviewed request → grant shown in Sharing. After creation, explain “Your manager can now view this snapshot.” New records do not join it. Check-in private notes and private items never appear in selection options. Source-version conflict returns to review; recipient changes require a new preview.

Revocation: choose Revoke access → confirm named recipient/snapshot → wait for server → revoked status. The next recipient request must deny the share. Clear rendered content when access fails or the share expires; support refresh/focus revalidation. Do not imply a previously viewed snapshot can be erased from someone's memory.

### Export and deletion

Choose scope → request → show actual job status → download when ready or retry if failed. Only show a 24-hour expiry supplied by the export contract. Delete flow names scope, consequences and retained account status accurately; distinguish deleting personal records, leaving an organization and deleting a global account. Never label a local state reset “Account deleted.” Backend completion semantics are a dependency, not something UI copy can fix.

## 7. Layout sketches

Desktop personal shell:

```text
Pulse / organization     Workspace: My workspace       Notices / Account
-------------------     ----------------------------------------------
Home                    This week                          [Add task]
Tasks                   Date window · Last updated
Check-ins               Effort summary       Check-in invitation
Private items           Weekly trend / insufficient-data explanation
Trends                  Recent tasks and check-ins
Sharing                 Active sharing summary
-------------------
Privacy · Settings
```

Native personal Home:

```text
Pulse                                  Account
This week                         [Add task]
Workload summary / honest empty state
How manageable does your workload feel?
Recent entries
Sharing status · Private items shortcut
----------------------------------------------
Home     Tasks     Check-in     Sharing     More
```

Manager/HR reuse the web shell with scoped navigation and a reporting-window header. Admin replaces charts with searchable directory lists and detail panels. The information hierarchy, not uniform card count, determines each layout.

## 8. Responsive, accessibility and state requirements

Web targets: 320, 375, 430, 768, 1024 and 1440 CSS pixels. Compact layouts use one column; tablet supports bounded two-pane details where useful; desktop content caps around 1200px, forms around 640px. Tables switch to labelled cards or an explicit contained table region. Page-level horizontal overflow is unacceptable. Long names and translated copy wrap.

Native targets: small/standard/large phones and tablet; safe areas, keyboard, rotation and large text must preserve navigation and save actions. Use platform screen units. Adopt 44pt iOS and 48dp Android interaction targets; aim for 44px web controls. WCAG's 24px AA minimum has exceptions and is not the same as this product's larger design target. See [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Keyboard access, visible focus, screen-reader labels, semantic headings, modal focus return and announced save/error messages are required. Text contrast target is 4.5:1 for normal text; controls and chart alternatives must remain understandable without color. Test zoom and font scaling, reduced motion, and tab order. Follow [Apple tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars) and [Android adaptive layout guidance](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics) for native behavior.

| State | User sees | Recovery / rule |
| --- | --- | --- |
| Loading | Reserved layout and Loading message | Bound waiting; expose retry on failure |
| Empty | No entries yet + relevant next action | Never substitute fixture data |
| Consent off | Plain explanation and Review privacy choices | No coercive repeated prompt |
| Saving | Disabled duplicate submission, Saving | Preserve draft |
| Failed/offline | Could not save + Retry | Do not claim offline sync unless a durable queue exists |
| Stale conflict | This entry changed + Review latest | Reconcile versions before retry |
| Session expired | Sign in again | Safe return path, no protected content left visible |
| Permission removed | Access no longer available | Return to permitted workspace |
| Suppressed | Not enough eligible data to show a release | No metrics, exact small count or participation names |
| Stale/corrected output | Unavailable or corrected label | Do not display withdrawn values as current |
| Job queued/running/failed | Actual job status | Poll authorized status; retry according to contract |

## 9. Implementation sequence and restart checklist

All implementation items below are initially pending. Complete one phase at a time and record evidence. No extra skills or packages need downloading to finish this plan.

| Phase | Work / likely files | Exit evidence |
| --- | --- | --- |
| U1 — navigation truth | `app.tsx`, `Navigation.tsx`, mobile `RootNavigator.tsx`, `WorkOnlyScreen.tsx`; canonical route mapping and workspace switch | Every role reaches own workspace, only granted workspaces appear, deep links/back/logout behave correctly |
| U2 — visual foundation | `packages/design-tokens`, `ui-web`, `ui-native`, web styles | Buttons, fields, badges, empty/error states and shells demonstrated at compact/desktop sizes |
| U3 — personal entry | Dashboard, Tasks, CheckIns, PrivateItems, Settings; extract mobile screens under `src/screens` | Real save/reload/edit/delete with draft preservation, optional capacity, timezone-aware dates |
| U4 — sharing and privacy | Sharing, Privacy, notifications, observation detail | Every selected field reviewed, stale preview rejected, revoke denied to recipient; job and consent states truthful |
| U5 — work screens | Manager, HR, Admin page families | Scoped lists/statistics, honest suppression, clear directory workflows and consequence confirmations |
| U6 — native completion | Home/More navigation, sharing, trends, notices, privacy/settings and website handoffs | All four roles complete personal journeys on native; work links open website and reauthorize |
| U7 — verification and handoff | Visual captures, browser/device checks, updated plan and gap log | Recorded scenario results, remaining dependencies and commit references |

Choose the native navigation library during U1 against the existing Expo SDK 57 setup. If Expo Router is introduced, reserve `apps/mobile/src/app` for routes and retain screen components under `src`; do not mix unrelated project restructuring into the design work. Before mobile implementation, read [the exact SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/), verify component compatibility, and add runtime libraries with `expo install`.

Use the existing shared API client and backend contracts. New UI states may require better request cancellation, cache scoping, pagination and observation/job endpoints; track these as functional dependencies. Immediate consent invalidation, source-version checks, access history, archival rights and job completion require backend evidence. Do not describe a design change as satisfying them by itself.

## 10. Acceptance scenarios

| ID | Conduct this test | Expected outcome |
| --- | --- | --- |
| UX01 | Sign in with member, manager, HR, admin and multi-role fixtures on web/native | Personal workspace available to all; work destinations match current roles |
| UX02 | Open canonical and legacy links; use browser back/forward and native back | Correct screen/context, no blank route or Hooks-order crash |
| UX03 | Create task/check-in; fail network once; retry; refresh | Input survives; one logical save; same record reloads |
| UX04 | Open settings before preferences finish loading; save with API failure | Server values populate safely; no false success or overwritten dirty input |
| UX05 | Add one-time private item; adjust date; inspect visibility | Correct disclosed expiry; private item absent from share controls |
| UX06 | Preview title-only task then date/rating check-in; edit source before confirm | Exact selected values; private note absent; changed version requires fresh review |
| UX07 | Create another task after publishing; revoke original share; refresh manager | New task absent; revoked share cannot be read |
| UX08 | Open manager/HR with zero, insufficient, valid and stale releases | Distinct honest states; no individual contribution list or invalid metrics |
| UX09 | Change role or organization mid-session; logout then sign in as another fixture | Previous context content and drafts cleared; no stale permissions |
| UX10 | Submit invitation, reporting-line and policy changes with a failure/conflict | Understandable consequence/retry; no policy floor below 5; no false Sent label |
| UX11 | Request export/deletion with queued, failed and completed job fixtures | Status matches backend; download expiry respected; deletion scope accurately named |
| UX12 | Keyboard and screen-reader pass; 320px web; large native text; keyboard open | Labels/actions reachable, focus visible, no clipped controls, chart alternative available |
| UX13 | Fresh real session with no notifications or disabled optional choices | No samples; all optional scopes remain off until chosen |
| UX14 | Load enough entries to exceed first page, including mixed effort units | Pagination works; summaries do not misrepresent partial data or mix units |

Run `pnpm check` after implementation batches; `pnpm mobile:check` plus native bundle/device verification for mobile changes; `pnpm infra:synth` only when infrastructure changes. Automated tests should cover meaningful state/authorization contracts, not merely restate markup. Capture representative Home, form, share preview, Manager, HR and Admin states at desktop/compact sizes; native Home/form/sharing on both platforms. Review once, fix a consolidated batch, confirm once.

Suggested usability evaluation with synthetic data: first-time participants locate privacy settings, save an entry, and explain what a manager can see; managers find an approved share and distinguish it from aggregates; admins explain the effect of a reporting-line change. Record completion, wrong turns and wording misunderstandings. Targets are proposed; no usability study has been conducted.

## 11. Progress log and resumption

| Date | Checkpoint | Evidence / next step |
| --- | --- | --- |
| 2026-09-13 | UI/UX planning complete | Source review, role inventory, proposed design system, flows and acceptance scenarios documented; implementation begins at U1 |
| 2026-09-13 | U1 navigation and shell foundation completed | Web navigation now renders personal tabs only for member accounts and role-only workspaces for manager/HR/admin accounts; mobile restores the role handoff screen; role workspaces do not prefetch personal records; responsive authenticated-shell styles added. `pnpm.cmd typecheck` passes. Next: U2 shared component/token cleanup, then form and page-state polish. |
| 2026-09-13 | U2 state and feedback pass started | Notifications now use authenticated notification APIs with a real empty state, persisted read state and channel preferences; Settings waits for the API before showing success/error. `pnpm.cmd build` and lint/typecheck pass. `pnpm.cmd mobile:check` is blocked by local Expo `EACCES` network/connection failure; full `pnpm.cmd check` reaches tests but the existing CDK infrastructure test cannot bundle `services/api/src/health.ts` because the sandbox reports access denied. Re-run those checks in a normal network-enabled developer shell. |
| 2026-09-13 | Role-isolation correction applied | Per product-owner clarification, any active manager/HR/admin role now receives only its role workspace on web; personal tabs and personal API prefetch are disabled for those accounts. Mobile restores the role handoff screen and opens the permitted website route. Member accounts retain the personal tabs. `pnpm.cmd lint` and `pnpm.cmd typecheck` pass. |
| 2026-09-13 | U4 sharing review guard added | Sharing now validates date order, labels the two-step flow, records the exact preview input, and rejects confirmation if source versions or selections changed after preview. Web build passes; all 72 non-infrastructure privacy tests pass. |
| 2026-09-13 | Route and browser-history pass added | Canonical `/app/check-ins` and legacy `/app/checkins` now resolve to the same tab; tab changes write canonical URLs and browser back/forward updates the active screen. Lint and typecheck pass. |
| 2026-09-13 | Native input safety pass added | Mobile task/check-in dates now use the device-local calendar date; invalid or non-positive effort is rejected with an actionable message before submission. Lint and typecheck pass. |
| 2026-09-13 | Hook-order regression fixed | Browser-history synchronization now runs unconditionally before auth/loading returns in `DashboardRoute`, eliminating the React “Rendered more hooks” crash during sign-in. Lint, typecheck and build pass. |
| 2026-09-13 | Synthetic role screens populated | Development `org-demo` now contains six canonical synthetic members, five privacy-floor contributors, editable workload/check-in fixtures, a demo team, generic notices, and privacy-safe team/organization releases. Refresh or sign out/in to verify each role surface. |

For every later checkpoint append: phase, files changed, commit, checks run, visual/device evidence, known blocker and exact next action. Mark a phase complete only when its exit evidence is attached.

Skill influence: Impeccable's planning workflow informed task-first hierarchy and explicit state models; UI/UX Pro Max supplied a design-system search and accessibility/interaction priorities. Its generic blue/orange palette and wellness typography suggestions were unsuitable for the established Pulse identity, so the implementation retains the repository's green/paper identity and system typography. The Impeccable context engine was unavailable locally; existing source and requirements supplied the context. The current implementation pass changes web/mobile navigation, responsive workspace styling, authenticated notification states and settings feedback; it does not change auth configuration or cloud resources.
