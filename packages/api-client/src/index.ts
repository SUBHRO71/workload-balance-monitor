import type {
  AcceptInvitationInput,
  AdminAuditRecord,
  AggregateResponse,
  CheckInInput,
  CheckInRecord,
  CheckInUpdate,
  ConsentRecord,
  ConsentScopes,
  CorrectionInput,
  CorrectionRecord,
  DateRange,
  DeletionRequest,
  ExportRequest,
  HumanActionInput,
  HumanActionRecord,
  HumanActionUpdate,
  InvitationInput,
  InvitationRecord,
  LifecycleJobRecord,
  Membership,
  MemberUpdate,
  NotificationPreferences,
  NotificationRecord,
  NotificationUpdate,
  Observation,
  OrganizationPolicy,
  OwnerExportData,
  PolicyPatch,
  PrivateItemInput,
  PrivateItemRecord,
  PrivateItemUpdate,
  Publication,
  SharingGrant,
  SharingGrantInput,
  TaskInput,
  TaskRecord,
  TaskUpdate,
  TeamAssignment,
  TeamInput,
  TeamRecord,
  WorkloadPreferences,
  WorkloadPreferencesUpdate,
} from "@workload/contracts";

export interface ApiClientConfiguration {
  baseUrl: string;
  getAccessToken: () => Promise<string | undefined>;
  orgId?: string;
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class WorkloadApiClient {
  constructor(private readonly config: ApiClientConfiguration) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.config.getAccessToken();
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (token) headers.authorization = `Bearer ${token}`;
    if (this.config.orgId) headers["x-org-id"] = this.config.orgId;

    const url = `${this.config.baseUrl.replace(/\/$/, "")}${path}`;
    const init: RequestInit = {
      method,
      headers,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);

    if (!response.ok) {
      let errPayload: { code?: string; message?: string } = {};
      try {
        errPayload = (await response.json()) as { code?: string; message?: string };
      } catch {
        // ignore json parse error on error response
      }
      throw new ApiError(
        response.status,
        errPayload.code ?? "REQUEST_FAILED",
        errPayload.message ?? `HTTP ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }

  // Profile & Identity
  async getMe(): Promise<{ userId: string; memberships: Membership[] }> {
    return this.request("GET", "/v1/me");
  }

  async updateProfile(displayName: string): Promise<Membership> {
    return this.request("PATCH", "/v1/me/profile", { displayName });
  }

  // Preferences
  async getPreferences(): Promise<WorkloadPreferences> {
    return this.request("GET", "/v1/me/preferences");
  }

  async updatePreferences(update: WorkloadPreferencesUpdate): Promise<WorkloadPreferences> {
    return this.request("PATCH", "/v1/me/preferences", update);
  }

  // Consent
  async getConsent(): Promise<ConsentRecord> {
    return this.request("GET", "/v1/me/consent");
  }

  async updateConsent(scopes: ConsentScopes): Promise<ConsentRecord> {
    return this.request("PUT", "/v1/me/consent", scopes);
  }

  // Dashboard
  async getDashboard(): Promise<{
    state: string;
    recentTasks: TaskRecord[];
    recentCheckIns: CheckInRecord[];
    points: Array<{ weekStart: string; effortValue: number; effortUnit: "hours" | "points"; meanManageability?: number }>;
    evidenceStrength: string;
    insights: Array<{ ruleVersion: string; category: string; title: string; explanation: string }>;
    preferences?: WorkloadPreferences;
  }> {
    return this.request("GET", "/v1/me/dashboard");
  }

  // Tasks
  async listTasks(options?: { limit?: number; cursor?: string }): Promise<{ items: TaskRecord[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/v1/me/tasks${query}`);
  }

  async createTask(input: TaskInput): Promise<TaskRecord> {
    return this.request("POST", "/v1/me/tasks", input);
  }

  async getTask(id: string): Promise<TaskRecord> {
    return this.request("GET", `/v1/me/tasks/${id}`);
  }

  async updateTask(id: string, update: TaskUpdate): Promise<TaskRecord> {
    return this.request("PATCH", `/v1/me/tasks/${id}`, update);
  }

  async deleteTask(id: string): Promise<{ ok: boolean }> {
    return this.request("DELETE", `/v1/me/tasks/${id}`);
  }

  // Check-ins
  async listCheckIns(options?: { limit?: number; cursor?: string }): Promise<{ items: CheckInRecord[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/v1/me/check-ins${query}`);
  }

  async createCheckIn(input: CheckInInput): Promise<CheckInRecord> {
    return this.request("POST", "/v1/me/check-ins", input);
  }

  async getCheckIn(id: string): Promise<CheckInRecord> {
    return this.request("GET", `/v1/me/check-ins/${id}`);
  }

  async updateCheckIn(id: string, update: CheckInUpdate): Promise<CheckInRecord> {
    return this.request("PATCH", `/v1/me/check-ins/${id}`, update);
  }

  async deleteCheckIn(id: string): Promise<{ ok: boolean }> {
    return this.request("DELETE", `/v1/me/check-ins/${id}`);
  }

  // Private Items
  async listPrivateItems(options?: { limit?: number; cursor?: string }): Promise<{ items: PrivateItemRecord[]; nextCursor?: string }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/v1/me/private-items${query}`);
  }

  async createPrivateItem(input: PrivateItemInput): Promise<PrivateItemRecord> {
    return this.request("POST", "/v1/me/private-items", input);
  }

  async getPrivateItem(id: string): Promise<PrivateItemRecord> {
    return this.request("GET", `/v1/me/private-items/${id}`);
  }

  async updatePrivateItem(id: string, update: PrivateItemUpdate): Promise<PrivateItemRecord> {
    return this.request("PATCH", `/v1/me/private-items/${id}`, update);
  }

  async deletePrivateItem(id: string): Promise<{ ok: boolean }> {
    return this.request("DELETE", `/v1/me/private-items/${id}`);
  }

  // Trends & Observations
  async getTrends(): Promise<{
    points: Array<{ weekStart: string; effortValue: number; effortUnit: "hours" | "points"; meanManageability?: number }>;
    evidenceStrength: string;
    insights: Array<{ ruleVersion: string; category: string; title: string; explanation: string }>;
    preferences: WorkloadPreferences;
  }> {
    return this.request("GET", "/v1/me/trends");
  }

  async listObservations(): Promise<{ items: Observation[] }> {
    return this.request("GET", "/v1/me/observations");
  }

  async updateObservationStatus(id: string, status: "active" | "dismissed" | "disputed"): Promise<Observation> {
    return this.request("PATCH", `/v1/me/observations/${id}`, { status });
  }

  async createCorrection(input: CorrectionInput): Promise<CorrectionRecord> {
    return this.request("POST", "/v1/me/corrections", input);
  }

  // Sharing Lifecycle (Owner)
  async createSharePreview(input: SharingGrantInput): Promise<Publication> {
    return this.request("POST", "/v1/me/shares/preview", input);
  }

  async createShare(input: SharingGrantInput): Promise<{ grant: SharingGrant; publication: Publication }> {
    return this.request("POST", "/v1/me/shares", input);
  }

  async listMyShares(): Promise<{ items: SharingGrant[] }> {
    return this.request("GET", "/v1/me/shares");
  }

  async getMyShare(id: string): Promise<{ grant: SharingGrant; publication: Publication }> {
    return this.request("GET", `/v1/me/shares/${id}`);
  }

  async revokeMyShare(id: string): Promise<SharingGrant> {
    return this.request("DELETE", `/v1/me/shares/${id}`);
  }

  // Sharing Lifecycle (Manager Review)
  async listManagerShares(): Promise<{ items: Array<{ grant: SharingGrant; publication: Publication }> }> {
    return this.request("GET", "/v1/manager/shares");
  }

  async getManagerShare(id: string): Promise<{ grant: SharingGrant; publication: Publication }> {
    return this.request("GET", `/v1/manager/shares/${id}`);
  }

  // Phase 4: Manager Team Aggregates & HR Releases
  async getManagerTeams(): Promise<{ items: Array<{ teamId: string }> }> {
    return this.request("GET", "/v1/manager/teams");
  }

  async getTeamTrends(teamId: string, range?: DateRange): Promise<AggregateResponse> {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/v1/manager/teams/${teamId}/trends${query}`);
  }

  async getTeamObservations(teamId: string): Promise<{ items: Array<{ category: string; title: string; explanation: string }> }> {
    return this.request("GET", `/v1/manager/teams/${teamId}/observations`);
  }

  async getOrgTrends(range?: DateRange): Promise<AggregateResponse> {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/v1/hr/trends${query}`);
  }

  async getOrgObservations(): Promise<{ items: Array<{ category: string; title: string; explanation: string }> }> {
    return this.request("GET", "/v1/hr/observations");
  }

  // Phase 5: Human Actions (Manager & HR)
  async listManagerTeamActions(teamId: string): Promise<{ items: HumanActionRecord[] }> {
    return this.request("GET", `/v1/manager/teams/${teamId}/actions`);
  }

  async createManagerTeamAction(teamId: string, input: HumanActionInput): Promise<HumanActionRecord> {
    return this.request("POST", `/v1/manager/teams/${teamId}/actions`, input);
  }

  async getManagerTeamAction(teamId: string, actionId: string): Promise<HumanActionRecord> {
    return this.request("GET", `/v1/manager/teams/${teamId}/actions/${actionId}`);
  }

  async updateManagerTeamAction(teamId: string, actionId: string, update: HumanActionUpdate): Promise<HumanActionRecord> {
    return this.request("PATCH", `/v1/manager/teams/${teamId}/actions/${actionId}`, update);
  }

  async listHrActions(): Promise<{ items: HumanActionRecord[] }> {
    return this.request("GET", "/v1/hr/actions");
  }

  async createHrAction(input: HumanActionInput): Promise<HumanActionRecord> {
    return this.request("POST", "/v1/hr/actions", input);
  }

  async getHrAction(actionId: string): Promise<HumanActionRecord> {
    return this.request("GET", `/v1/hr/actions/${actionId}`);
  }

  async updateHrAction(actionId: string, update: HumanActionUpdate): Promise<HumanActionRecord> {
    return this.request("PATCH", `/v1/hr/actions/${actionId}`, update);
  }

  // Phase 5: Notifications & Preferences
  async listNotifications(): Promise<{ items: NotificationRecord[] }> {
    return this.request("GET", "/v1/me/notifications");
  }

  async updateNotification(id: string, update: NotificationUpdate): Promise<NotificationRecord> {
    return this.request("PATCH", `/v1/me/notifications/${id}`, update);
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.request("GET", "/v1/me/notification-preferences");
  }

  async updateNotificationPreferences(prefs: NotificationPreferences): Promise<NotificationPreferences> {
    return this.request("PUT", "/v1/me/notification-preferences", prefs);
  }

  // Phase 5: Invitations & Administration
  async acceptInvitation(input: AcceptInvitationInput): Promise<Membership> {
    return this.request("POST", "/v1/invitations/accept", input);
  }

  async listAdminMembers(): Promise<{ items: Membership[] }> {
    return this.request("GET", "/v1/admin/members");
  }

  async updateAdminMember(userId: string, update: MemberUpdate): Promise<Membership> {
    return this.request("PATCH", `/v1/admin/members/${userId}`, update);
  }

  async listAdminInvitations(): Promise<{ items: InvitationRecord[] }> {
    return this.request("GET", "/v1/admin/invitations");
  }

  async createAdminInvitation(input: InvitationInput): Promise<InvitationRecord> {
    return this.request("POST", "/v1/admin/invitations", input);
  }

  async listAdminTeams(): Promise<{ items: TeamRecord[] }> {
    return this.request("GET", "/v1/admin/teams");
  }

  async createAdminTeam(input: TeamInput): Promise<TeamRecord> {
    return this.request("POST", "/v1/admin/teams", input);
  }

  async updateAdminTeam(teamId: string, update: { teamName?: string; status?: "active" | "archived" }): Promise<TeamRecord> {
    return this.request("PATCH", `/v1/admin/teams/${teamId}`, update);
  }

  async assignAdminTeamMember(
    teamId: string,
    userId: string,
    assignment: { directManagerId?: string; effectiveFrom?: string; effectiveTo?: string },
  ): Promise<TeamAssignment> {
    return this.request("PUT", `/v1/admin/teams/${teamId}/members/${userId}`, assignment);
  }

  async removeAdminTeamMember(teamId: string, userId: string): Promise<{ success: boolean }> {
    return this.request("DELETE", `/v1/admin/teams/${teamId}/members/${userId}`);
  }

  async getAdminPolicy(): Promise<OrganizationPolicy> {
    return this.request("GET", "/v1/admin/policies");
  }

  async patchAdminPolicy(patch: PolicyPatch): Promise<OrganizationPolicy> {
    return this.request("PATCH", "/v1/admin/policies", patch);
  }

  async listAdminAuditEvents(): Promise<{ items: AdminAuditRecord[] }> {
    return this.request("GET", "/v1/admin/audit");
  }

  // Exports & Deletion Lifecycle
  async createExport(input?: ExportRequest): Promise<LifecycleJobRecord> {
    return this.request("POST", "/v1/me/exports", input ?? { scope: "all" });
  }

  async getExportDownload(exportId: string): Promise<{ job: LifecycleJobRecord; data: OwnerExportData }> {
    return this.request("GET", `/v1/me/exports/${exportId}/download`);
  }

  async createDeletionRequest(input: DeletionRequest): Promise<LifecycleJobRecord> {
    return this.request("POST", "/v1/me/deletion-requests", input);
  }

  async getJob(jobId: string): Promise<LifecycleJobRecord> {
    return this.request("GET", `/v1/me/jobs/${jobId}`);
  }
}

