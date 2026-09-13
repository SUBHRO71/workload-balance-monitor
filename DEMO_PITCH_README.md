# Hackathon Pitch & Live Demo Guide — Pulse / Workload Balance Monitor

This is the presenter-ready guide for the current synthetic development deployment. It is grounded in the product contract in `README.md`, especially Sections 1–5 and 10. It deliberately separates what can be shown live from the longer-term contract so the pitch stays credible.

> **One-sentence product:** Pulse helps an employee understand their changing workload, choose exactly what to tell their manager, and contribute—only by consent—to privacy-protected team and organization signals.

> **The line to remember:** This is a mirror for the employee and a conversation aid for the organization—not a surveillance dashboard.

---

## 1. The actual goal

Pulse is built around three questions:

1. **How is my workload changing?** The employee sees personal task, check-in, and trend information derived from data they deliberately enter.
2. **What do I want my manager to know?** The employee explicitly selects records and fields, reviews the exact snapshot, and publishes a frozen share to their current manager.
3. **Is consenting work becoming harder to sustain?** Managers and HR see numeric aggregate releases only when the applicable consent and privacy rules are satisfied.

The product is not trying to measure activity, score productivity, rank employees, or diagnose burnout. It collects no keystrokes, screenshots, mouse activity, or passive app usage. New accounts start with optional processing and sharing choices off.

### The trust contract

- Consent is separate by purpose. Personal processing, team aggregation, HR aggregation, manager sharing, and notifications do not imply one another.
- Private items are owner-only and have no manager or HR viewing route.
- A manager share is a frozen publication containing only the exact fields confirmed by the owner. Later records or edits are not silently added.
- Team and HR releases require at least five distinct consenting contributors for the metric, audience, and reporting window.
- Administrators may raise that floor but cannot lower it below five.
- Managers, HR, and administrators are blocked from private DynamoDB namespaces by separate service/IAM boundaries—not merely by hidden navigation.
- Human beings make workload decisions. The system presents evidence and records follow-up; it does not make employment decisions.
- The demo contains synthetic data only.

---

## 2. Recommended demo format

Use a **7-minute main demo** and keep 2 minutes for questions.

| Time | Segment | Main idea |
| --- | --- | --- |
| 0:00–0:45 | Problem | Existing workload tools often create surveillance instead of trust. |
| 0:45–1:20 | Product idea | Personal reflection, deliberate sharing, safe aggregates. |
| 1:20–3:30 | Member login | Owner control: tasks, check-ins, private items, consent, frozen sharing. |
| 3:30–5:10 | Manager login | Only approved publications and privacy-thresholded team signals. |
| 5:10–5:50 | HR login | Organization-level numbers without person-level drill-down. |
| 5:50–6:30 | Admin login | Directory/policy administration without personal content. |
| 6:30–7:00 | Architecture and close | Privacy is enforced in data paths and IAM boundaries. |

If the event gives only 3 minutes, use the compressed script in Section 9.

---

## 3. Which logins to use

Use the four existing development-only Cognito identities in this order:

| Order | Account | Expected workspace | Why it appears here |
| --- | --- | --- | --- |
| 1 | `member@example.invalid` (`member`) | Overview, Tasks, Check-ins, Private items, My trends, Sharing center, Notifications, Privacy & consent, Settings | Establishes owner control before anyone else sees anything. |
| 2 | `manager@example.invalid` (`manager`) | Manager workspace only | Shows the difference between an explicit personal publication and a protected team aggregate. |
| 3 | `hr@example.invalid` (`hr`) | HR workspace only | Proves that HR receives organization releases, not individual employee records. |
| 4 | `admin@example.invalid` (`org_admin`) | Admin workspace only | Proves that administration is directory/policy control, not personal-content access. |

The current hackathon UI uses separate single-role demo identities so the access boundaries are unmistakable. The root requirements also preserve personal ownership rights for every real person; do not describe the separate demo accounts as proof that a manager permanently loses personal data rights.

### Find the exact demo emails

Usernames and email aliases are safe to inspect, but **never write passwords into this README or commit them**. In PowerShell:

```powershell
$poolId = "us-east-1_inlz9aPhn"
$usernames = aws cognito-idp list-users `
  --user-pool-id $poolId `
  --profile workmonitor-dev `
  --query "Users[].Username" `
  --output text

foreach ($username in $usernames.Split()) {
  $email = aws cognito-idp admin-get-user `
    --user-pool-id $poolId `
    --username $username `
    --profile workmonitor-dev `
    --query "UserAttributes[?Name=='email'].Value | [0]" `
    --output text
  $groups = aws cognito-idp admin-list-groups-for-user `
    --user-pool-id $poolId `
    --username $username `
    --profile workmonitor-dev `
    --query "Groups[].GroupName" `
    --output text
  Write-Output "$groups`t$email`t$username"
}
```

Copy the result into a private presenter note—not into Git:

| Role | Email | Password location |
| --- | --- | --- |
| Member | `member@example.invalid` | Password manager/private note |
| Manager | `manager@example.invalid` | Password manager/private note |
| HR | `hr@example.invalid` | Password manager/private note |
| Admin | `admin@example.invalid` | Password manager/private note |

The ungrouped `alice@example.invalid` Cognito identity is not part of the four-role walkthrough. The two `demo.contributor*.example.invalid` directory records exist only to satisfy the synthetic aggregate cohort; they are not Cognito login accounts. Do not use any of these three identities during the pitch.

### Avoid session confusion

Prepare four separate browser profiles or private windows and sign one role into each. Label the windows **MEMBER**, **MANAGER**, **HR**, and **ADMIN**. This is safer on stage than repeatedly fighting a cached Cognito session.

If using one browser, click **Sign out**, wait for Cognito logout to finish, then click **Continue with secure sign-in**. The app requests a fresh hosted sign-in, but separate windows remain the most reliable presentation setup.

---

## 4. Pre-demo setup — do this 15 minutes before presenting

### Terminal preparation

From the repository root in Git Bash:

```bash
export AWS_PROFILE="workmonitor-dev"
export AWS_DEFAULT_REGION="us-east-1"
node tools/seed-demo.mjs
pnpm dev:web
```

The seed command should report:

- table `WorkloadMonitor-WorkloadMonitorDevelopment`
- organization `org-demo`
- team `demo-team`
- at least 6 seeded directory members
- source `synthetic`

The seed is intentionally repeatable. It fills task/check-in/private-item screens, creates generic in-app notices, builds a team with at least five non-manager contributors, and publishes synthetic team and organization aggregate releases.

### Browser preparation

1. Open `http://localhost:5173/` and confirm the landing page renders.
2. Click **Get started** and confirm it reaches the secure sign-in flow.
3. Prepare the four role windows described above.
4. In the member window, verify that Tasks and Check-ins contain synthetic rows.
5. In the manager window, verify **Team Aggregates** shows `Synthetic Product Team` and a disclosed `5–9 members` cohort band.
6. In the HR window, verify an organization weekly release is visible.
7. In the admin window, verify the directory and `demo-team` render.
8. Return every window to its starting page and close DevTools.

### Create one manager publication before the pitch, if necessary

The seed builds aggregates but does not fabricate employee-to-manager publication consent. This is intentional: an explicit share should come from the member flow.

Either create the publication live during the demo, or prepare one immediately before presenting:

1. Sign in as the member.
2. Open **Sharing center**.
3. Select **New share**.
4. Choose the available manager.
5. Select one task and one check-in.
6. Click **Review snapshot**.
7. Confirm that no private note is present.
8. Click **Confirm and publish**.

Use dates already covered by the selected records. If the manager publication is empty on the manager screen, refresh after publishing and confirm that the same member is assigned to `demo-team`.

### Stage safety

- Use only the seeded synthetic titles and `.example.invalid` identities.
- Do not open AWS access keys, `.env` files, CloudWatch request details, or a terminal containing passwords on the projector.
- Increase browser zoom to about 110–125% if the projector is distant.
- Disable desktop notifications and unrelated browser extensions.
- Keep this README open on a second device or printed.

---

## 5. The opening pitch — exact words

### 45-second opening

> “Most tools that claim to understand workload start by watching employees. That creates a contradiction: the more insight management gets, the less safe the employee feels.
>
> We built Pulse around the opposite model. Nothing is collected passively. The employee enters only what helps them reflect on workload, keeps private context private, and decides exactly what—if anything—to share. Managers receive either a deliberately published snapshot or a team-level numeric signal that cannot be released below a strict privacy floor. HR gets organization-level aggregates, never a person-level drill-down.
>
> Pulse is not a productivity score and it does not diagnose burnout. It is a privacy-first way to turn workload evidence into a healthier human conversation.”

### Problem and differentiation

> “The hard problem is not drawing another dashboard. It is making the dashboard useful without quietly turning it into surveillance. We treat consent, purpose, audience, expiry, and data boundaries as product features. The result answers three questions: how is my workload changing; what do I want my manager to know; and is consenting work across the team becoming harder to sustain?”

Then say:

> “Let me show those three questions from four strictly separated perspectives.”

---

## 6. Live demo — exact sequence and narration

## Scene 1 — Member: “My data starts with me” (about 2 minutes)

**Login:** member account
**Start at:** Overview

Say:

> “I’m starting as a team member because every useful signal originates with the owner. This workspace contains only my own records. The synthetic data makes the demo readable, but the product does not collect it in the background.”

### A. Overview and tasks

1. On **Overview**, point to workload and recent check-in summaries.
2. Open **Tasks**.
3. Point to several synthetic planning items.
4. Optionally add a task:
   - Title: `Prepare hackathon feedback summary`
   - Work date: today
   - Effort: `3` hours
   - Status: `in progress`
   - Priority: `normal`

Say:

> “This is intentional self-reporting, not time tracking. A task belongs to the employee’s private partition and is not automatically sent to a manager.”

### B. Check-in and private context

1. Open **Check-ins**.
2. Point to manageability history or add a rating.
3. If adding a check-in, use clearly synthetic text such as `Synthetic demo note — competing priorities this week.`
4. Open **Private items** and point to the synthetic private planning note. Do not open or enter anything resembling real personal data.

Say:

> “A rating helps me notice change over time. A private note can preserve context for me, but there is no manager or HR API for private items. Private notes are not merely hidden by the interface; they have no approved publication path.”

### C. Consent

1. Open **Privacy & consent**.
2. Point to the independent controls for personal processing, team aggregation, organization/HR aggregation, and notifications.
3. Do not toggle them off during the main demo, because doing so can correctly invalidate downstream demo data.

Say:

> “A brand-new account begins with optional processing off. This synthetic account opted in during demo setup. Notice that team aggregation does not imply HR aggregation, notifications do not imply sharing, and an administrator cannot consent on the employee’s behalf.”

Point to data export, but do not start deletion.

> “The owner can request an export or deletion. The personal account and its data rights are designed to outlive organization membership.”

### D. Frozen manager share

1. Open **Sharing center**.
2. Click **New share**.
3. Choose the manager.
4. Select one task and one check-in.
5. Click **Review snapshot**.
6. Pause on the review screen.

Say:

> “This review step is the heart of the trust model. The member sees the exact frozen fields before publication. Check-ins expose only the selectable date and manageability value; private notes are not selectable. Confirming this does not grant the manager access to the underlying private workspace, and future tasks are not automatically added.”

7. Click **Confirm and publish**.
8. Point to the active grant and its expiry/revoke control.

Say:

> “The member can revoke future access. A share is an explicit, expiring publication—not a standing back door.”

## Scene 2 — Manager: “Useful without individual surveillance” (about 1 minute 40 seconds)

**Login/window:** manager account
**Expected navigation:** Manager workspace only

Say:

> “Now I’m the manager. The route changes because authorization comes from the current server-side membership and team assignment—not from a user-selected role.”

### A. Shared Publications

1. Open **Shared Publications**.
2. Open or point to the member’s publication.
3. Highlight that only the confirmed fields are visible.

Say:

> “I can see what the member deliberately published to me. I cannot browse their task list, private items, or full check-in history. Even an old role token must not preserve access after a reporting-line change.”

If the publication is empty, use this truthful fallback:

> “The empty inbox is itself the expected privacy behavior: without an active owner-confirmed publication addressed to this manager, there is nothing to see. I’ll show the independent aggregate path next.”

### B. Team Aggregates

1. Click **Team Aggregates**.
2. Select `Synthetic Product Team` if needed.
3. Point to the weekly window, evidence strength, mean effort/manageability, and `5–9 members` contributor band.

Say:

> “This is a different purpose and a different consent path. It is an equal-weight numeric team release built from at least five consenting contributors. The manager sees a safe cohort band, not a participation list or each person’s contribution. If the threshold is not met, the metric is suppressed—not shown with a warning beside unsafe data.”

### C. Human Decisions

1. Click **Human Decisions**.
2. Optionally record: `Review priorities and capacity at the next team planning session.`

Say:

> “The system does not decide what to do to an employee. It records a human response to an authorized signal without copying private evidence into the action.”

## Scene 3 — HR: “Organization patterns, no person drill-down” (about 40 seconds)

**Login/window:** HR account
**Expected navigation:** HR workspace only

1. Point to **Organization Weekly Release**.
2. Point to the evidence strength and contributor band.
3. Briefly show the organization action area.

Say:

> “HR receives a separately consented organization release. There are no names, individual task titles, ratings, participation lists, or links into an employee record. HR status does not make this account a manager or administrator. The view answers whether workload conditions may need an organizational response, not who should be inspected.”

## Scene 4 — Admin: “Administration without employee content” (about 40 seconds)

**Login/window:** administrator account
**Expected navigation:** Admin workspace only

1. On **Members & Invitations**, point to the synthetic directory and role badges.
2. On **Teams**, point to `Synthetic Product Team`.
3. On **Privacy Policy**, point to the minimum contributor floor of 5.
4. On **Audit Log**, explain what is—and is not—recorded.

Say:

> “The administrator can manage membership, teams, invitations, and policy. They cannot open tasks, check-ins, private notes, or consent participation details. They may raise the privacy floor, but the server refuses to lower it below five. The audit log records administrative changes without copying personal workload content.”

Do not deactivate a member, delete a team, or trigger account deletion on stage.

---

## 7. Architecture explanation — 30 seconds

Use this if a technical judge asks how the privacy promise is enforced:

> “Cognito authenticates the user and API Gateway validates the access token. From there, we split responsibilities: personal and sharing handlers operate on owner-controlled data; manager and HR handlers read only publication and aggregate namespaces; admin handlers read directory and policy data. DynamoDB uses separate `PRIVATE`, `SHARE`, `TEAMVIEW`, `ORGVIEW`, and `DIRECTORY` key namespaces. The manager, HR, and admin execution roles do not receive IAM permission to read private partitions. Durable outbox and queue jobs support invalidation, aggregates, export, and deletion, while workers recheck current consent and generation before publishing.”

Simple diagram to draw on a whiteboard:

```text
Member input ──> PRIVATE records ──> personal reflection
       │
       ├── explicit frozen selection ──> SHARE publication ──> current manager
       │
       └── separate consent + >=5 floor ──> TEAM/ORG release ──> manager or HR

Admin ──> DIRECTORY + POLICY only
```

Then add:

> “The browser navigation is convenience. The actual access boundary is rechecked by backend authorization and IAM.”

---

## 8. Closing pitch — exact words

> “Pulse proves that workload visibility does not have to come from surveillance. Employees get a useful mirror, managers get deliberate context and privacy-safe team evidence, HR gets organization patterns, and administrators manage policy without gaining access to personal content.
>
> The differentiator is not one chart. It is the chain of trust: off-by-default consent, explicit frozen publications, a hard five-person release floor, current-role reauthorization, and infrastructure-level separation of private data.
>
> We are building a system where asking for help does not require surrendering privacy—and where an organization can respond to unsustainable workload without turning people into scores.”

End with:

> “That is Pulse: understand your workload, share on your terms, and improve work without surveillance.”

---

## 9. Three-minute compressed version

### 0:00–0:35 — problem and answer

> “Most workload tools increase visibility by watching employees. Pulse takes the opposite approach: no passive collection, no productivity scoring, and no burnout diagnosis. Employees reflect using data they choose to enter, publish only exact fields they approve, and separately opt into privacy-thresholded team or HR statistics.”

### 0:35–1:35 — member

Show Tasks, Check-ins, Privacy & consent, then Sharing center review.

> “This is my private workspace. These choices are independent and start off. Here I select one task and one check-in, review the exact frozen publication, and confirm it. Private notes cannot be selected and future records are never added automatically.”

### 1:35–2:20 — manager

Show Shared Publications and Team Aggregates.

> “The manager can read only the publication addressed to them and a team aggregate released above the five-person consent floor. They cannot browse private records or identify contributors.”

### 2:20–2:40 — HR/admin

Quickly switch prepared windows.

> “HR gets organization numbers with no person-level drill-down. Admin manages members, teams, audit, and a privacy floor they may raise but cannot lower.”

### 2:40–3:00 — close

> “The same separation exists in the backend: Cognito and current memberships establish identity, handlers are split by purpose, and manager/HR/admin IAM roles cannot read private DynamoDB partitions. Pulse makes workload visible enough to act on, while keeping it private enough to trust.”

---

## 10. Honest status: what to claim and what not to claim

### Safe claims for the current demo

- The AWS development infrastructure is deployed and the browser authenticates through Cognito.
- The personal, sharing, manager, HR, and admin web experiences use live backend APIs in the synthetic development environment.
- The demo database contains synthetic tasks, check-ins, private items, notification records, a six-member directory, a team, and privacy-floor-qualified aggregate releases.
- Routes are restricted according to the active demo role, and backend handlers enforce authorization independently of the UI.
- Sharing supports exact-field preview, confirmed frozen publication, manager read, and revocation behavior.
- Aggregate and policy logic demonstrate the enforced minimum contributor floor of five.

### Do not claim

- Do not say Pulse passively “detects burnout” or diagnoses a health condition.
- Do not call this employee productivity monitoring, attendance tracking, or individual risk scoring.
- Do not say aggregates are mathematically anonymous under every possible external-data attack. Say they are privacy-thresholded, field-minimized releases.
- Do not say the product is legally compliant with every privacy regime; that requires legal review and operational controls beyond a demo.
- Do not say mobile push is complete. Mobile device push is deferred.
- Do not present external email delivery as the centerpiece of the live demo. Generic in-app notification records and preferences are demoable; complete production notification delivery/operations still require verification.
- Do not claim every release gate has been manually validated in production or that passing scaffold/unit tests proves the control exists.
- Do not claim AWS is permanently free.
- Do not enter or display real employee data.

---

## 11. Demo recovery playbook

| Problem | Immediate recovery | What to say |
| --- | --- | --- |
| Sign-in returns to the previous role | Use that role’s prepared browser window, or sign out and retry in a new private window. | “The identity provider preserves browser sessions; I’m switching to the prepared least-privilege identity.” |
| Page remains on “Completing sign-in” | Confirm the dev server is running, hard-refresh once, then use the prepared window. | Do not narrate CORS or OAuth debugging unless a technical judge asks. |
| API error/blank page | Check `/health`, refresh once, then use another prepared role view and continue the story. | “The live development API is reconnecting; the privacy rule is fail-closed, so unavailable authorization returns no data.” |
| Manager publication is empty | Show Team Aggregates, then return to the member and create an explicit share if time permits. | “Without a current owner-confirmed grant addressed to this manager, the correct result is an empty inbox.” |
| Team/HR metric says suppressed | Treat it as a feature, not a failure. | “The current eligible cohort fell below the privacy floor, so the service withheld the metric.” |
| Admin audit is empty | Explain its narrow purpose; optionally create a synthetic invitation before the pitch. | “This log records administrative changes only; it intentionally contains no workload content.” |
| Notifications show only the synthetic system notice | Show read/unread and preferences briefly, then move on. | “This demonstrates the generic in-app inbox. External delivery is outside today’s live claim.” |
| A live form fails | Preserve the entered value, state that writes fail closed, and move to seeded data. | “The interface does not show a false success; it keeps the retry state visible.” |

Never weaken or toggle off a privacy control merely to make data appear during a pitch.

---

## 12. Judge Q&A cheat sheet

### “Is this just another employee monitoring product?”

> “No. It has no passive activity collection and no productivity ranking. The employee owns the source records and deliberately chooses what is shared.”

### “Can a manager see an employee’s raw tasks?”

> “Only fields in a specific active publication that the employee previewed and confirmed for that current manager. There is no manager private-item endpoint or general employee task browser.”

### “What happens with a four-person team?”

> “The applicable metric is suppressed. Five is a hard minimum; administrators may raise it but cannot lower it.”

### “Can HR find who opted out?”

> “The HR contract exposes safe organization releases, not participation lists or individual records. Consent status is purpose-specific and not a person-level HR drill-down.”

### “Can the administrator override consent?”

> “No. Admin manages directory, teams, role assignment, invitations, policies, and admin audit. It cannot consent for an employee or read personal workload content.”

### “What prevents someone from typing the manager URL?”

> “The UI is not the security boundary. API handlers resolve current membership, role, team assignment, recipient, grant, expiry, and policy generation. Separate Lambda IAM roles also deny work/admin services access to private partitions.”

### “What happens after a manager is reassigned?”

> “New reads revalidate the current reporting relationship and assignment version. A stale token claim or stale inbox pointer must not preserve old access.”

### “Why frozen shares?”

> “Because consent to reveal one known snapshot is not consent to reveal future work. Frozen fields make the employee’s decision inspectable and reversible.”

### “How do you avoid a small cohort being inferred across repeated reports?”

> “The contract requires the contributor floor per metric, audience, and window, plus suppression for unsafe overlapping releases. Safe coverage bands are shown instead of exact participant lists.”

### “Does AI decide whether someone is burned out?”

> “No. The current rules are descriptive workload evidence, not clinical diagnosis. Human managers and HR record their own follow-up decisions.”

### “What survives when someone leaves the organization?”

> “Work access and organizational shares are revoked, while the owner retains personal-account rights to review, export, or delete their own archived records.”

### “What would you build next?”

> “Complete manual release-gate verification in the deployed environment, harden operational recovery and notification delivery, finish device-level mobile validation, and run a synthetic pilot before considering any real employee data.”

---

## 13. Final presenter checklist

- [ ] I can explain the three product questions without using the phrase “productivity tracking.”
- [ ] I know the private location of all four login credentials.
- [ ] Each role is signed into a separate prepared browser window.
- [ ] The member has synthetic tasks/check-ins and an available manager.
- [ ] A manager publication is prepared or I will create it live.
- [ ] `Synthetic Product Team` has an available team aggregate with a `5–9` band.
- [ ] HR has an available organization release.
- [ ] Admin shows members, `demo-team`, and a minimum floor of 5.
- [ ] I will not start deletion, deactivate members, or change team assignments on stage.
- [ ] I will call the data synthetic and avoid displaying secrets.
- [ ] I know the empty/suppressed-state fallback lines.
- [ ] I will close on trust and action—not feature count.

---

## The single best demo storyline

If you remember only one sequence, remember this:

```text
Member reflects privately
  → member previews and confirms one frozen share
    → manager sees only that share
      → manager separately sees a >=5-person team signal
        → HR sees only an organization signal
          → admin manages policy without seeing personal content
```

That sequence is the product. Everything else supports it.
