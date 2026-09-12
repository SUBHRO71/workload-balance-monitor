import React, { createContext, useContext, useState } from "react";
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
} from "@workload/contracts";
import {
  calculateWeeklyWorkload,
  generatePersonalInsights,
  privateItemDeleteAfter,
  type PersonalInsight,
  type WeeklyWorkloadPoint,
} from "@workload/domain";
import { createSyntheticCohort } from "@workload/test-fixtures";

interface WorkloadContextType {
  isDemoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  consent: ConsentScopes;
  updateConsent: (scopes: ConsentScopes) => void;
  preferences: WorkloadPreferences;
  updatePreferences: (prefs: Partial<WorkloadPreferences>) => void;
  tasks: TaskRecord[];
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, update: Partial<TaskInput>) => void;
  deleteTask: (id: string) => void;
  checkIns: CheckInRecord[];
  addCheckIn: (input: CheckInInput) => void;
  deleteCheckIn: (id: string) => void;
  privateItems: PrivateItemRecord[];
  addPrivateItem: (input: PrivateItemInput) => void;
  deletePrivateItem: (id: string) => void;
  trends: WeeklyWorkloadPoint[];
  insights: PersonalInsight[];
  evidenceStrength: EvidenceStrength;
  dismissInsight: (title: string) => void;
  exportData: () => Promise<string>;
  deleteAccount: () => Promise<{ success: boolean; deletedCount: number }>;
}

const defaultConsent: ConsentScopes = {
  personalProcessing: false,
  teamAggregation: false,
  organizationAggregation: false,
  notifications: { inApp: false, managerEmail: false, devicePush: false },
};

const WorkloadContext = createContext<WorkloadContextType | null>(null);

export function WorkloadProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setDemoMode] = useState<boolean>(true);
  const [consent, setConsent] = useState<ConsentScopes>(defaultConsent);
  const [preferences, setPreferences] = useState<WorkloadPreferences>({
    timezone: "UTC",
    weeklyCapacity: { value: 40, unit: "hours" },
    workdays: [1, 2, 3, 4, 5],
  });

  const [tasks, setTasks] = useState<TaskRecord[]>(() => {
    const cohort = createSyntheticCohort(1, 101);
    return cohort.tasks.slice(0, 8);
  });

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(() => {
    const cohort = createSyntheticCohort(1, 101);
    return cohort.checkIns.slice(0, 6);
  });

  const [privateItems, setPrivateItems] = useState<PrivateItemRecord[]>([
    {
      entityType: "PRIVATE_ITEM",
      id: "item-init-1",
      orgId: "demo-org",
      ownerId: "demo-user",
      type: "personal_goal",
      title: "Complete AWS CDK Certification",
      lifecycle: "ongoing",
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      entityType: "PRIVATE_ITEM",
      id: "item-init-2",
      orgId: "demo-org",
      ownerId: "demo-user",
      type: "leave_detail",
      title: "Annual Leave Trip",
      lifecycle: "one_time",
      eventEndAt: "2026-08-15T00:00:00.000Z",
      deleteAfter: "2027-08-15T00:00:00.000Z",
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

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

  const addTask = (input: TaskInput) => {
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your Privacy settings.");
      return;
    }
    const now = new Date().toISOString();
    const newTask: TaskRecord = {
      ...input,
      entityType: "TASK",
      id: `task-${Date.now()}`,
      orgId: "demo-org",
      ownerId: "demo-user",
      source: "user",
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const updateTask = (id: string, update: Partial<TaskInput>) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...update, version: t.version + 1, updatedAt: new Date().toISOString() } : t,
      ),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const addCheckIn = (input: CheckInInput) => {
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your Privacy settings.");
      return;
    }
    const now = new Date().toISOString();
    const newCheckIn: CheckInRecord = {
      ...input,
      entityType: "CHECKIN",
      id: `checkin-${Date.now()}`,
      orgId: "demo-org",
      ownerId: "demo-user",
      source: "user",
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    setCheckIns((prev) => [newCheckIn, ...prev]);
  };

  const deleteCheckIn = (id: string) => {
    setCheckIns((prev) => prev.filter((c) => c.id !== id));
  };

  const addPrivateItem = (input: PrivateItemInput) => {
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your Privacy settings.");
      return;
    }
    const now = new Date().toISOString();
    const deleteAfter = privateItemDeleteAfter(input);
    const baseItem = {
      entityType: "PRIVATE_ITEM" as const,
      id: `item-${Date.now()}`,
      orgId: "demo-org",
      ownerId: "demo-user",
      type: input.type,
      title: input.title,
      schemaVersion: 1 as const,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...(input.content !== undefined ? { content: input.content } : {}),
    };
    const item: PrivateItemRecord = input.lifecycle === "one_time"
      ? {
          ...baseItem,
          lifecycle: "one_time",
          eventEndAt: input.eventEndAt,
          deleteAfter: deleteAfter ?? new Date(Date.now() + 365 * 86400000).toISOString(),
        }
      : {
          ...baseItem,
          lifecycle: "ongoing",
        };
    setPrivateItems((prev) => [item, ...prev]);
  };

  const deletePrivateItem = (id: string) => {
    setPrivateItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateConsent = (scopes: ConsentScopes) => {
    setConsent(scopes);
  };

  const updatePreferences = (prefs: Partial<WorkloadPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...prefs }));
  };

  const dismissInsight = (title: string) => {
    setDismissedInsightTitles((prev) => new Set([...prev, title]));
  };

  const exportData = async (): Promise<string> => {
    const payload = {
      exportId: `export_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      metadata: {
        version: 1,
        schemaVersion: 1,
        notice: "This archive contains strictly your personal workload records. In accordance with privacy architecture, no other employees' records or raw aggregate datasets are included.",
        downloadExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      preferences,
      consent,
      tasks,
      checkIns,
      privateItems,
      trends,
      insights,
    };
    return JSON.stringify(payload, null, 2);
  };

  const deleteAccount = async (): Promise<{ success: boolean; deletedCount: number }> => {
    const totalDeleted = tasks.length + checkIns.length + privateItems.length;
    setTasks([]);
    setCheckIns([]);
    setPrivateItems([]);
    setConsent({
      personalProcessing: false,
      teamAggregation: false,
      organizationAggregation: false,
      notifications: { inApp: false, managerEmail: false, devicePush: false },
    });
    return { success: true, deletedCount: totalDeleted };
  };

  return (
    <WorkloadContext.Provider
      value={{
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
        exportData,
        deleteAccount,
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
