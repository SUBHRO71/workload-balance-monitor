import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { WorkloadApiClient } from "@workload/api-client";
import type {
  CheckInInput,
  CheckInRecord,
  ConsentScopes,
  EvidenceStrength,
  PrivateItemInput,
  PrivateItemRecord,
  TaskInput,
  TaskRecord,
  WorkloadPreferences,
  NotificationPreferences,
  NotificationRecord,
} from "@workload/contracts";
import {
  calculateWeeklyWorkload,
  generatePersonalInsights,
  type PersonalInsight,
  type WeeklyWorkloadPoint,
} from "@workload/domain";
import { useAuth } from "../auth";

interface WorkloadContextType {
  workspaceLoadError?: string;
  isDemoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  consent: ConsentScopes;
  updateConsent: (scopes: ConsentScopes) => Promise<void>;
  preferences: WorkloadPreferences;
  updatePreferences: (prefs: Partial<WorkloadPreferences>) => Promise<void>;
  tasks: TaskRecord[];
  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, update: Partial<TaskInput>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  checkIns: CheckInRecord[];
  addCheckIn: (input: CheckInInput) => Promise<void>;
  deleteCheckIn: (id: string) => Promise<void>;
  privateItems: PrivateItemRecord[];
  addPrivateItem: (input: PrivateItemInput) => Promise<void>;
  deletePrivateItem: (id: string) => Promise<void>;
  trends: WeeklyWorkloadPoint[];
  insights: PersonalInsight[];
  evidenceStrength: EvidenceStrength;
  dismissInsight: (title: string) => void;
  notifications: NotificationRecord[];
  notificationPreferences: NotificationPreferences;
  markNotificationRead: (id: string, read: boolean) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<void>;
}

const defaultConsent: ConsentScopes = {
  personalProcessing: false,
  teamAggregation: false,
  organizationAggregation: false,
  notifications: { inApp: false, managerEmail: false, devicePush: false },
};

const WorkloadContext = createContext<WorkloadContextType | null>(null);

export function WorkloadProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const activeMembership = auth.memberships.find((membership) => membership.status === "active");
  const orgId = activeMembership?.orgId;
  const roleWorkspaceOnly = (activeMembership?.roles ?? []).some((role) => ["manager", "hr", "org_admin"].includes(role));
  const api = useMemo(() => new WorkloadApiClient({
    baseUrl: import.meta.env.VITE_API_URL as string,
    getAccessToken: async () => auth.accessToken,
    ...(orgId ? { orgId } : {}),
  }), [auth.accessToken, orgId]);
  const [isDemoMode, setDemoMode] = useState<boolean>(false);
  const [consent, setConsent] = useState<ConsentScopes>(defaultConsent);
  const [preferences, setPreferences] = useState<WorkloadPreferences>({
    timezone: "UTC",
    weeklyCapacity: { value: 40, unit: "hours" },
    workdays: [1, 2, 3, 4, 5],
  });

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);

  const [privateItems, setPrivateItems] = useState<PrivateItemRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    inAppEnabled: true,
    emailEnabled: false,
    weeklyDigestEnabled: false,
  });
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string>();

  useEffect(() => {
    if (!auth.accessToken || !orgId || roleWorkspaceOnly) return;
    let cancelled = false;
    setWorkspaceLoadError(undefined);
    const failures: string[] = [];
    const load = async <T,>(label: string, request: Promise<T>, apply: (value: T) => void) => {
      try {
        const value = await request;
        if (!cancelled) apply(value);
      } catch (error) {
        failures.push(label);
        console.error(`workspace_${label}_load_failed`, error instanceof Error ? error.message : "Unknown");
      }
    };
    void Promise.all([
      load("consent", api.getConsent(), setConsent),
      load("preferences", api.getPreferences(), setPreferences),
      load("tasks", api.listTasks({ limit: 100 }), (page) => setTasks(page.items)),
      load("check-ins", api.listCheckIns({ limit: 100 }), (page) => setCheckIns(page.items)),
      load("private-items", api.listPrivateItems({ limit: 100 }), (page) => setPrivateItems(page.items)),
    ]).then(() => {
      if (!cancelled && failures.length > 0) {
        setWorkspaceLoadError(`Some workspace data could not be loaded: ${failures.join(", ")}. Refresh and try again.`);
      }
    });
    return () => { cancelled = true; };
  }, [api, auth.accessToken, orgId, roleWorkspaceOnly]);

  useEffect(() => {
    if (!auth.accessToken || !orgId || roleWorkspaceOnly) return;
    void Promise.all([api.listNotifications(), api.getNotificationPreferences()])
      .then(([notificationPage, nextPreferences]) => {
        setNotifications(notificationPage.items);
        setNotificationPreferences(nextPreferences);
      })
      .catch(() => {
        // An empty inbox is an honest state when notification delivery is unavailable.
        setNotifications([]);
      });
  }, [api, auth.accessToken, orgId, roleWorkspaceOnly]);

  const [dismissedInsightTitles, setDismissedInsightTitles] = useState<Set<string>>(new Set());

  // Derive trends using pure domain logic
  const trends = React.useMemo(() => {
    if (!consent.personalProcessing) return [];
    try {
      return calculateWeeklyWorkload(tasks, checkIns);
    } catch {
      return [];
    }
  }, [tasks, checkIns, consent.personalProcessing]);

  const rawInsights = React.useMemo(() => {
    if (!consent.personalProcessing) return [];
    return generatePersonalInsights(trends, preferences.weeklyCapacity?.value);
  }, [trends, preferences.weeklyCapacity?.value, consent.personalProcessing]);

  const insights = React.useMemo(() => {
    return rawInsights.filter((ins: PersonalInsight) => !dismissedInsightTitles.has(ins.title));
  }, [rawInsights, dismissedInsightTitles]);

  const strength: EvidenceStrength =
    trends.length >= 6 ? "consistent" : trends.length >= 3 ? "developing" : "limited";

  const addTask = async (input: TaskInput) => {
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your Privacy settings.");
      return;
    }
    const newTask = await api.createTask(input, crypto.randomUUID());
    setTasks((prev) => [newTask, ...prev]);
  };

  const updateTask = async (id: string, update: Partial<TaskInput>) => {
    const existing = tasks.find((task) => task.id === id);
    const updated = await api.updateTask(id, { ...update, ...(existing ? { expectedVersion: existing.version } : {}) });
    setTasks((prev) => prev.map((task) => task.id === id ? updated : task));
  };

  const deleteTask = async (id: string) => {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const addCheckIn = async (input: CheckInInput) => {
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your Privacy settings.");
      return;
    }
    const newCheckIn = await api.createCheckIn(input, crypto.randomUUID());
    setCheckIns((prev) => [newCheckIn, ...prev]);
  };

  const deleteCheckIn = async (id: string) => {
    await api.deleteCheckIn(id);
    setCheckIns((prev) => prev.filter((c) => c.id !== id));
  };

  const addPrivateItem = async (input: PrivateItemInput) => {
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your Privacy settings.");
      return;
    }
    const newItem = await api.createPrivateItem(input);
    setPrivateItems((prev) => [newItem, ...prev]);
  };

  const deletePrivateItem = async (id: string) => {
    await api.deletePrivateItem(id);
    setPrivateItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateConsent = async (scopes: ConsentScopes) => {
    const updated = await api.updateConsent(scopes);
    setConsent(updated);
  };

  const updatePreferences = async (prefs: Partial<WorkloadPreferences>) => {
    const updated = await api.updatePreferences(prefs);
    setPreferences(updated);
  };

  const dismissInsight = (title: string) => {
    setDismissedInsightTitles((prev) => new Set([...prev, title]));
  };

  const markNotificationRead = async (id: string, read: boolean) => {
    const updated = await api.updateNotification(id, { read });
    setNotifications((prev) => prev.map((notification) => notification.id === id ? updated : notification));
  };

  const markAllNotificationsRead = async () => {
    const unread = notifications.filter((notification) => !notification.read);
    await Promise.all(unread.map((notification) => api.updateNotification(notification.id, { read: true })));
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  };

  const updateNotificationPreferences = async (prefs: NotificationPreferences) => {
    const updated = await api.updateNotificationPreferences(prefs);
    setNotificationPreferences(updated);
  };

  return (
    <WorkloadContext.Provider
      value={{
        ...(workspaceLoadError ? { workspaceLoadError } : {}),
        isDemoMode,
        setDemoMode,
        consent,
        updateConsent,
        preferences,
        updatePreferences,
        tasks,
        addTask,
        updateTask,
        deleteTask,
        checkIns,
        addCheckIn,
        deleteCheckIn,
        privateItems,
        addPrivateItem,
        deletePrivateItem,
        trends,
        insights,
        evidenceStrength: strength,
        dismissInsight,
        notifications,
        notificationPreferences,
        markNotificationRead,
        markAllNotificationsRead,
        updateNotificationPreferences,
      }}
    >
      {children}
    </WorkloadContext.Provider>
  );
}

export function useWorkload() {
  const context = useContext(WorkloadContext);
  if (!context) throw new Error("useWorkload must be used within WorkloadProvider");
  return context;
}
