import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, spacing } from "@workload/design-tokens";
import type { CheckInRecord, ConsentScopes, PrivateItemRecord, TaskRecord } from "@workload/contracts";
import { privateItemDeleteAfter } from "@workload/domain";

type Tab = "dashboard" | "tasks" | "checkin" | "private" | "consent";

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  // Consent scopes (default off per policy, interactive in app)
  const [consent, setConsent] = useState<ConsentScopes>({
    personalProcessing: true,
    teamAggregation: false,
    organizationAggregation: false,
    notifications: { inApp: false, managerEmail: false, devicePush: false },
  });

  // State
  const [tasks, setTasks] = useState<TaskRecord[]>([
    {
      entityType: "TASK",
      id: "m-task-1",
      orgId: "demo-org",
      ownerId: "demo-user",
      title: "Mobile Architecture Review",
      workDate: "2026-02-16",
      effort: { value: 6, unit: "hours" },
      status: "done",
      source: "user",
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      entityType: "TASK",
      id: "m-task-2",
      orgId: "demo-org",
      ownerId: "demo-user",
      title: "Sync with Product Lead",
      workDate: "2026-02-17",
      effort: { value: 3, unit: "hours" },
      status: "in_progress",
      source: "user",
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([
    {
      entityType: "CHECKIN",
      id: "m-checkin-1",
      orgId: "demo-org",
      ownerId: "demo-user",
      checkInDate: "2026-02-16",
      manageability: 4,
      privateNote: "Sprint pacing is sustainable",
      source: "user",
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [privateItems, setPrivateItems] = useState<PrivateItemRecord[]>([
    {
      entityType: "PRIVATE_ITEM",
      id: "m-item-1",
      orgId: "demo-org",
      ownerId: "demo-user",
      type: "personal_goal",
      title: "Learn Rust async patterns",
      lifecycle: "ongoing",
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskHours, setTaskHours] = useState("4");

  // Check-in form state
  const [selectedRating, setSelectedRating] = useState<number>(3);
  const [checkInNote, setCheckInNote] = useState("");

  // Private item form state
  const [privateTitle, setPrivateTitle] = useState("");
  const [isOneTime, setIsOneTime] = useState(false);

  const handleAddTask = () => {
    if (!taskTitle.trim()) return;
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your consent settings.");
      return;
    }
    const now = new Date().toISOString();
    const newTask: TaskRecord = {
      entityType: "TASK",
      id: `task-${Date.now()}`,
      orgId: "demo-org",
      ownerId: "demo-user",
      title: taskTitle.trim(),
      workDate: now.slice(0, 10),
      effort: { value: Number(taskHours) || 1, unit: "hours" },
      status: "planned",
      source: "user",
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    setTasks([newTask, ...tasks]);
    setTaskTitle("");
  };

  const handleAddCheckIn = () => {
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your consent settings.");
      return;
    }
    const now = new Date().toISOString();
    const newCheckIn: CheckInRecord = {
      entityType: "CHECKIN",
      id: `checkin-${Date.now()}`,
      orgId: "demo-org",
      ownerId: "demo-user",
      checkInDate: now.slice(0, 10),
      manageability: selectedRating,
      privateNote: checkInNote.trim() || undefined,
      source: "user",
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    setCheckIns([newCheckIn, ...checkIns]);
    setCheckInNote("");
    alert("Voluntary check-in saved privately.");
  };

  const handleAddPrivateItem = () => {
    if (!privateTitle.trim()) return;
    if (!consent.personalProcessing) {
      alert("Personal processing is disabled in your consent settings.");
      return;
    }
    const now = new Date().toISOString();
    const deleteAfter = isOneTime
      ? privateItemDeleteAfter({
          type: "note",
          title: privateTitle.trim(),
          lifecycle: "one_time",
          eventEndAt: now,
        })
      : undefined;

    const baseItem = {
      entityType: "PRIVATE_ITEM" as const,
      id: `item-${Date.now()}`,
      orgId: "demo-org",
      ownerId: "demo-user",
      type: "note" as const,
      title: privateTitle.trim(),
      schemaVersion: 1 as const,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const newItem: PrivateItemRecord = isOneTime
      ? {
          ...baseItem,
          lifecycle: "one_time",
          eventEndAt: now,
          deleteAfter: deleteAfter ?? new Date(Date.now() + 365 * 86400000).toISOString(),
        }
      : {
          ...baseItem,
          lifecycle: "ongoing",
        };
    setPrivateItems([newItem, ...privateItems]);
    setPrivateTitle("");
  };

  const totalHours = tasks.reduce((sum, t) => sum + t.effort.value, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          Workload Monitor
        </Text>
        <Text style={styles.headerSub}>Personal Mobile Workspace</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(["dashboard", "tasks", "checkin", "private", "consent"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Workload Overview</Text>

            <View style={styles.cardRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricNumber}>{totalHours}h</Text>
                <Text style={styles.metricLabel}>Logged Effort</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricNumber}>
                  {checkIns[0] ? `${checkIns[0].manageability}/5` : "N/A"}
                </Text>
                <Text style={styles.metricLabel}>Latest Manageability</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>💡 Personal Observation</Text>
              <Text style={styles.cardBody}>
                {tasks.length > 0
                  ? "Your workload entries are within steady limits. Remember that entries represent logged effort, not productivity scores."
                  : "Start logging tasks and voluntary check-ins to build your private workload trends."}
              </Text>
              <Text style={styles.badge}>EVIDENCE: DEVELOPING</Text>
            </View>

            <View style={styles.privacyBanner}>
              <Text style={styles.privacyText}>
                🛡️ Private to you. Zero keystroke logging, no screenshots, and no upward sharing without your explicit grant.
              </Text>
            </View>
          </View>
        )}

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Log Task Effort</Text>

            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Task title (e.g. Code review)"
                placeholderTextColor={colors.muted}
                value={taskTitle}
                onChangeText={setTaskTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Hours (e.g. 4)"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={taskHours}
                onChangeText={setTaskHours}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={handleAddTask}>
                <Text style={styles.primaryButtonText}>+ Add Task</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: spacing.medium }]}>Recent Tasks</Text>
            {tasks.map((task) => (
              <View key={task.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>{task.title}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {task.workDate} · {task.effort.value} {task.effort.unit}
                  </Text>
                </View>
                <Text style={styles.statusPill}>{task.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CHECK-IN TAB */}
        {activeTab === "checkin" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voluntary Check-in</Text>
            <Text style={styles.sectionSubtitle}>
              How manageable does your workload feel today?
            </Text>

            <View style={styles.card}>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((val) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setSelectedRating(val)}
                    style={[styles.ratingButton, selectedRating === val && styles.ratingButtonActive]}
                  >
                    <Text
                      style={[
                        styles.ratingButtonText,
                        selectedRating === val && styles.ratingButtonTextActive,
                      ]}
                    >
                      {val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Private reflection note (never shared)..."
                placeholderTextColor={colors.muted}
                multiline
                value={checkInNote}
                onChangeText={setCheckInNote}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleAddCheckIn}>
                <Text style={styles.primaryButtonText}>Save Check-in</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: spacing.medium }]}>Check-in History</Text>
            {checkIns.map((ci) => (
              <View key={ci.id} style={styles.listItem}>
                <View>
                  <Text style={styles.listItemTitle}>{ci.checkInDate}</Text>
                  <Text style={styles.listItemSubtitle}>{ci.privateNote || "No note"}</Text>
                </View>
                <Text style={styles.ratingBadge}>{ci.manageability} / 5</Text>
              </View>
            ))}
          </View>
        )}

        {/* PRIVATE ITEMS TAB */}
        {activeTab === "private" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔒 Private Items</Text>
            <Text style={styles.sectionSubtitle}>
              Notes, goals, and leave reasons. Excluded from work views and aggregates.
            </Text>

            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Item title (e.g. Doctor appointment)"
                placeholderTextColor={colors.muted}
                value={privateTitle}
                onChangeText={setPrivateTitle}
              />
              <TouchableOpacity
                onPress={() => setIsOneTime(!isOneTime)}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.medium }}
              >
                <Text style={{ color: colors.text, fontSize: 15 }}>
                  {isOneTime ? "☑️ One-time item (365-day expiry)" : "⬜ Ongoing (Retained until deleted)"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleAddPrivateItem}>
                <Text style={styles.primaryButtonText}>+ Save Private Item</Text>
              </TouchableOpacity>
            </View>

            {privateItems.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>{item.title}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {item.lifecycle === "one_time"
                      ? `Auto-deletes: ${item.deleteAfter?.slice(0, 10)}`
                      : "Ongoing goal/note"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPrivateItems(privateItems.filter((i) => i.id !== item.id))}
                >
                  <Text style={{ color: "#c5221f", fontWeight: "600" }}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* CONSENT TAB */}
        {activeTab === "consent" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛡️ Privacy Controls</Text>
            <Text style={styles.sectionSubtitle}>
              All consent defaults to off. You control each scope independently.
            </Text>

            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                setConsent({ ...consent, personalProcessing: !consent.personalProcessing })
              }
            >
              <Text style={styles.cardTitle}>
                {consent.personalProcessing ? "✅ Personal Processing: ON" : "❌ Personal Processing: OFF"}
              </Text>
              <Text style={styles.cardBody}>
                Allows saving workload entries and calculating trends for your private use.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => setConsent({ ...consent, teamAggregation: !consent.teamAggregation })}
            >
              <Text style={styles.cardTitle}>
                {consent.teamAggregation ? "✅ Team Aggregation: ON" : "❌ Team Aggregation: OFF"}
              </Text>
              <Text style={styles.cardBody}>
                Allows numeric values to contribute to manager team totals. Minimum 5 contributors floor.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                setConsent({ ...consent, organizationAggregation: !consent.organizationAggregation })
              }
            >
              <Text style={styles.cardTitle}>
                {consent.organizationAggregation
                  ? "✅ Organization Aggregation: ON"
                  : "❌ Organization Aggregation: OFF"}
              </Text>
              <Text style={styles.cardBody}>
                Allows numeric values to contribute to HR org-wide trends. Zero employee drill-down.
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.medium, paddingTop: spacing.medium, paddingBottom: spacing.small },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: "700" },
  headerSub: { color: colors.muted, fontSize: 14 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#dbe6df",
    paddingHorizontal: spacing.small,
  },
  tabButton: { paddingVertical: 10, paddingHorizontal: 12 },
  tabButtonActive: { borderBottomWidth: 3, borderBottomColor: colors.accent },
  tabButtonText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  tabButtonTextActive: { color: colors.accent, fontWeight: "700" },
  content: { padding: spacing.medium, paddingBottom: 40 },
  section: { gap: spacing.small },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 2 },
  sectionSubtitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.small },
  cardRow: { flexDirection: "row", gap: spacing.small, marginVertical: spacing.small },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.medium,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe6df",
  },
  metricNumber: { fontSize: 24, fontWeight: "700", color: colors.text },
  metricLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.medium,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe6df",
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  badge: { fontSize: 11, fontWeight: "700", color: colors.accent, alignSelf: "flex-start", marginTop: 4 },
  privacyBanner: {
    backgroundColor: "#eaf2ee",
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c9d8d0",
    marginTop: spacing.small,
  },
  privacyText: { fontSize: 12, color: colors.text, lineHeight: 17 },
  input: {
    backgroundColor: "#f8faf9",
    borderWidth: 1,
    borderColor: "#c9d8d0",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eef3f0",
  },
  listItemTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  listItemSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statusPill: {
    backgroundColor: "#e6f4ea",
    color: "#137333",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "600",
  },
  ratingRow: { flexDirection: "row", gap: 8, marginVertical: spacing.small },
  ratingButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#c9d8d0",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  ratingButtonActive: { backgroundColor: "#eaf2ee", borderColor: colors.accent, borderWidth: 2 },
  ratingButtonText: { fontSize: 16, fontWeight: "600", color: colors.text },
  ratingButtonTextActive: { fontWeight: "800", color: colors.accent },
  ratingBadge: { fontSize: 15, fontWeight: "700", color: colors.accent },
});
