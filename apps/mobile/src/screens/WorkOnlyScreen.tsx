import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing } from "@workload/design-tokens";
import type { OrganizationRole } from "@workload/contracts";

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  hr: "HR Staff",
  org_admin: "Organisation Administrator",
};

const ROLE_DESC: Record<string, string> = {
  manager: "Your team reviews and aggregate dashboards are available on the website.",
  hr: "Your organisation-level dashboards are available on the website.",
  org_admin: "Directory management and policy settings are available on the website.",
};

interface Props {
  roles: OrganizationRole[];
  onSignOut: () => void;
}

export function WorkOnlyScreen({ roles, onSignOut }: Props) {
  const primary = roles[0];
  const label = primary ? (ROLE_LABELS[primary] ?? primary) : "Work role";
  const desc = primary ? (ROLE_DESC[primary] ?? "Your work dashboard is available on the website.") : "";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.icon}>🖥️</Text>
        <Text style={styles.heading}>Use the web app</Text>
        <Text style={styles.role}>You are signed in as: {label}</Text>
        <Text style={styles.body}>
          {desc}
          {"\n\n"}
          This mobile app is for personal workload tracking only. It does not include work dashboards.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onSignOut}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.large ?? 32,
    gap: 16,
  },
  icon: { fontSize: 56 },
  heading: { fontSize: 24, fontWeight: "800", color: colors.text, textAlign: "center" },
  role: { fontSize: 14, fontWeight: "600", color: colors.accent, textAlign: "center" },
  body: { fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: "center" },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});