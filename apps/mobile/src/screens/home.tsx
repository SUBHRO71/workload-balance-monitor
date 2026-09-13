import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, spacing } from "@workload/design-tokens";
import type { CheckInRecord, ConsentRecord, PrivateItemRecord, TaskRecord } from "@workload/contracts";
import { privateItemDeleteAfter } from "@workload/domain";
import { WorkloadApiClient } from "@workload/api-client";
import { useAuth } from "../auth";

type Tab = "dashboard" | "tasks" | "checkin" | "private" | "consent";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export function HomeScreen() {
  const auth = useAuth();
  const activeMembership = auth.memberships.find((m) => m.status === "active");
  const orgId = activeMembership?.orgId;

  const api = useMemo(
    () =>
      new WorkloadApiClient({
        baseUrl: API_URL,
        getAccessToken: async () => auth.accessToken,
        ...(orgId ? { orgId } : {}),
      }),
    [auth.accessToken, orgId],
  );

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [privateItems, setPrivateItems] = useState<PrivateItemRecord[]>([]);
  const [consent, setConsentState] = useState<ConsentRecord | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskHours, setTaskHours] = useState("4");
  const [selectedRating, setSelectedRating] = useState(3);
  const [checkInNote, setCheckInNote] = useState("");
  const [privateTitle, setPrivateTitle] = useState("");
  const [isOneTime, setIsOneTime] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    setDataError("");
    try {
      const [t, c, p, con] = await Promise.all([
        api.listTasks({ limit: 20 }),
        api.listCheckIns({ limit: 20 }),
        api.listPrivateItems({ limit: 20 }),
        api.getConsent(),
      ]);
      setTasks(t.items);
      setCheckIns(c.items);
      setPrivateItems(p.items);
      setConsentState(con);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoadingData(false);
    }
  }, [api]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    const parsedHours = Number(taskHours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      Alert.alert("Check the effort", "Enter an effort value greater than zero.");
      return;
    }
    if (!consent?.personalProcessing) {
      Alert.alert("Processing disabled", "Enable personal processing in Privacy Controls first.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createTask(
        { title: taskTitle.trim(), workDate: localDate(), effort: { value: parsedHours, unit: "hours" }, status: "planned" },
        `task-${Date.now()}`,
      );
      setTasks((prev) => [created, ...prev]);
      setTaskTitle("");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCheckIn = async () => {
    if (!consent?.personalProcessing) {
      Alert.alert("Processing disabled", "Enable personal processing in Privacy Controls first.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createCheckIn(
        { checkInDate: localDate(), manageability: selectedRating, ...(checkInNote.trim() ? { privateNote: checkInNote.trim() } : {}) },
        `checkin-${Date.now()}`,
      );
      setCheckIns((prev) => [created, ...prev]);
      setCheckInNote("");
      Alert.alert("Saved", "Voluntary check-in saved privately.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save check-in");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPrivateItem = async () => {
    if (!privateTitle.trim()) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const deleteAfter = isOneTime
        ? privateItemDeleteAfter({ type: "note", title: privateTitle.trim(), lifecycle: "one_time", eventEndAt: now })
        : undefined;
      const input = isOneTime
        ? { type: "note" as const, title: privateTitle.trim(), lifecycle: "one_time" as const, eventEndAt: now, deleteAfter: deleteAfter ?? new Date(Date.now() + 365 * 86400000).toISOString() }
        : { type: "note" as const, title: privateTitle.trim(), lifecycle: "ongoing" as const };
      const created = await api.createPrivateItem(input);
      setPrivateItems((prev) => [created, ...prev]);
      setPrivateTitle("");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrivateItem = async (id: string) => {
    try {
      await api.deletePrivateItem(id);
      setPrivateItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleToggleConsent = async (field: "personalProcessing" | "teamAggregation" | "organizationAggregation") => {
    if (!consent) return;
    const updated = { ...consent, [field]: !consent[field] };
    try {
      const saved = await api.updateConsent(updated);
      setConsentState(saved);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update consent");
    }
  };

  const totalHours = tasks.reduce((s, t) => s + t.effort.value, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text accessibilityRole="header" style={styles.headerTitle}>Workload Monitor</Text>
          <Text style={styles.headerSub}>Personal Mobile Workspace</Text>
        </View>
        <TouchableOpacity onPress={auth.logout}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {(["dashboard", "tasks", "checkin", "private", "consent"] as Tab[]).map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}>
            <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
              {tab === "checkin" ? "Check-in" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loadingData ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : dataError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: "#a33", textAlign: "center", marginBottom: 16 }}>{dataError}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={fetchAll}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === "dashboard" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Workload Overview</Text>
              <View style={styles.cardRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricNumber}>{totalHours}h</Text>
                  <Text style={styles.metricLabel}>Logged Effort</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricNumber}>{checkIns[0] ? `${checkIns[0].manageability}/5` : "N/A"}</Text>
                  <Text style={styles.metricLabel}>Latest Manageability</Text>
                </View>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Personal Observation</Text>
                <Text style={styles.cardBody}>
                  {tasks.length > 0
                    ? "Your workload entries are within steady limits. These represent logged effort, not productivity scores."
                    : "Start logging tasks and voluntary check-ins to build your private workload trends."}
                </Text>
                <Text style={styles.badge}>EVIDENCE: DEVELOPING</Text>
              </View>
              <View style={styles.privacyBanner}>
                <Text style={styles.privacyText}>Private to you. Zero keystroke logging, no screenshots, and no upward sharing without your explicit grant.</Text>
              </View>
            </View>
          )}

          {activeTab === "tasks" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Log Task Effort</Text>
              <View style={styles.card}>
                <TextInput style={styles.input} placeholder="Task title" placeholderTextColor={colors.muted} value={taskTitle} onChangeText={setTaskTitle} />
                <TextInput style={styles.input} placeholder="Hours (e.g. 4)" placeholderTextColor={colors.muted} keyboardType="numeric" value={taskHours} onChangeText={setTaskHours} />
                <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.6 }]} onPress={handleAddTask} disabled={submitting}>
                  <Text style={styles.primaryButtonText}>{submitting ? "Saving..." : "+ Add Task"}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sectionTitle, { marginTop: spacing.medium }]}>Recent Tasks</Text>
              {tasks.length === 0 && <Text style={styles.empty}>No tasks yet.</Text>}
              {tasks.map((task) => (
                <View key={task.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemTitle}>{task.title}</Text>
                    <Text style={styles.listItemSubtitle}>{task.workDate} - {task.effort.value} {task.effort.unit}</Text>
                  </View>
                  <Text style={styles.statusPill}>{task.status}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === "checkin" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Voluntary Check-in</Text>
              <Text style={styles.sectionSubtitle}>How manageable does your workload feel today?</Text>
              <View style={styles.card}>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((val) => (
                    <TouchableOpacity key={val} onPress={() => setSelectedRating(val)} style={[styles.ratingButton, selectedRating === val && styles.ratingButtonActive]}>
                      <Text style={[styles.ratingButtonText, selectedRating === val && styles.ratingButtonTextActive]}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[styles.input, { height: 80 }]} placeholder="Private reflection note (never shared)..." placeholderTextColor={colors.muted} multiline value={checkInNote} onChangeText={setCheckInNote} />
                <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.6 }]} onPress={handleAddCheckIn} disabled={submitting}>
                  <Text style={styles.primaryButtonText}>{submitting ? "Saving..." : "Save Check-in"}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sectionTitle, { marginTop: spacing.medium }]}>Check-in History</Text>
              {checkIns.length === 0 && <Text style={styles.empty}>No check-ins yet.</Text>}
              {checkIns.map((ci) => (
                <View key={ci.id} style={styles.listItem}>
                  <View>
                    <Text style={styles.listItemTitle}>{ci.checkInDate}</Text>
                    <Text style={styles.listItemSubtitle}>{ci.privateNote ?? "No note"}</Text>
                  </View>
                  <Text style={styles.ratingBadge}>{ci.manageability} / 5</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === "private" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Private Items</Text>
              <Text style={styles.sectionSubtitle}>Notes, goals, and leave reasons. Excluded from all work views and aggregates.</Text>
              <View style={styles.card}>
                <TextInput style={styles.input} placeholder="Item title" placeholderTextColor={colors.muted} value={privateTitle} onChangeText={setPrivateTitle} />
                <TouchableOpacity onPress={() => setIsOneTime(!isOneTime)} style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.medium }}>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{isOneTime ? "One-time (365-day expiry)" : "Ongoing (kept until you delete)"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.6 }]} onPress={handleAddPrivateItem} disabled={submitting}>
                  <Text style={styles.primaryButtonText}>{submitting ? "Saving..." : "+ Save Private Item"}</Text>
                </TouchableOpacity>
              </View>
              {privateItems.length === 0 && <Text style={styles.empty}>No private items yet.</Text>}
              {privateItems.map((item) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listItemTitle}>{item.title}</Text>
                    <Text style={styles.listItemSubtitle}>{item.lifecycle === "one_time" ? `Auto-deletes: ${item.deleteAfter?.slice(0, 10) ?? ""}` : "Ongoing"}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeletePrivateItem(item.id)}>
                    <Text style={{ color: "#c5221f", fontWeight: "600" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {activeTab === "consent" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy Controls</Text>
              <Text style={styles.sectionSubtitle}>All consent defaults to off. You control each scope independently.</Text>
              {(["personalProcessing", "teamAggregation", "organizationAggregation"] as const).map((field) => {
                const labels: Record<typeof field, [string, string]> = {
                  personalProcessing: ["Personal Processing", "Allows saving workload entries and calculating trends for your private use."],
                  teamAggregation: ["Team Aggregation", "Allows numeric values to contribute to manager team totals. Minimum 5 contributors floor."],
                  organizationAggregation: ["Organisation Aggregation", "Allows numeric values to contribute to HR org-wide trends. Zero employee drill-down."],
                };
                const on = consent ? Boolean(consent[field]) : false;
                return (
                  <TouchableOpacity key={field} style={styles.card} onPress={() => handleToggleConsent(field)}>
                    <Text style={styles.cardTitle}>{on ? "ON" : "OFF"} - {labels[field][0]}</Text>
                    <Text style={styles.cardBody}>{labels[field][1]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.medium, paddingTop: spacing.medium, paddingBottom: spacing.small, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: "700" },
  headerSub: { color: colors.muted, fontSize: 13 },
  signOut: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  tabBar: { flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: "#dbe6df", paddingHorizontal: spacing.small },
  tabButton: { paddingVertical: 10, paddingHorizontal: 10 },
  tabButtonActive: { borderBottomWidth: 3, borderBottomColor: colors.accent },
  tabButtonText: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  tabButtonTextActive: { color: colors.accent, fontWeight: "700" },
  content: { padding: spacing.medium, paddingBottom: 40 },
  section: { gap: spacing.small },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 2 },
  sectionSubtitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.small },
  cardRow: { flexDirection: "row", gap: spacing.small, marginVertical: spacing.small },
  metricCard: { flex: 1, backgroundColor: colors.surface, padding: spacing.medium, borderRadius: 10, borderWidth: 1, borderColor: "#dbe6df" },
  metricNumber: { fontSize: 24, fontWeight: "700", color: colors.text },
  metricLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  card: { backgroundColor: colors.surface, padding: spacing.medium, borderRadius: 10, borderWidth: 1, borderColor: "#dbe6df", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardBody: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  badge: { fontSize: 11, fontWeight: "700", color: colors.accent, alignSelf: "flex-start", marginTop: 4 },
  privacyBanner: { backgroundColor: "#eaf2ee", padding: spacing.medium, borderRadius: 8, borderWidth: 1, borderColor: "#c9d8d0", marginTop: spacing.small },
  privacyText: { fontSize: 12, color: colors.text, lineHeight: 17 },
  input: { backgroundColor: "#f8faf9", borderWidth: 1, borderColor: "#c9d8d0", borderRadius: 6, padding: 10, fontSize: 14, color: colors.text },
  primaryButton: { backgroundColor: colors.accent, paddingVertical: 10, borderRadius: 6, alignItems: "center" },
  primaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  listItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, padding: spacing.medium, borderRadius: 8, borderWidth: 1, borderColor: "#eef3f0" },
  listItemTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  listItemSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statusPill: { backgroundColor: "#e6f4ea", color: "#137333", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontSize: 11, fontWeight: "600" },
  ratingRow: { flexDirection: "row", gap: 8, marginVertical: spacing.small },
  ratingButton: { flex: 1, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: "#c9d8d0", alignItems: "center", backgroundColor: "#ffffff" },
  ratingButtonActive: { backgroundColor: "#eaf2ee", borderColor: colors.accent, borderWidth: 2 },
  ratingButtonText: { fontSize: 16, fontWeight: "600", color: colors.text },
  ratingButtonTextActive: { fontWeight: "800", color: colors.accent },
  ratingBadge: { fontSize: 15, fontWeight: "700", color: colors.accent },
  empty: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 20 },
});
