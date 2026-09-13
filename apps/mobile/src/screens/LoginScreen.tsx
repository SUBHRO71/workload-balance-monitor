import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing } from "@workload/design-tokens";

interface Props {
  onLogin: () => void;
  loading: boolean;
  error?: string;
}

export function LoginScreen({ onLogin, loading, error }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.icon}>⚖️</Text>
        <Text style={styles.title}>Workload Balance Monitor</Text>
        <Text style={styles.sub}>Personal workspace · Private by default</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={onLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Signing in…" : "Sign in with your organisation account"}</Text>
        </TouchableOpacity>
        <Text style={styles.note}>
          No keystroke logging, no screenshots, no upward sharing without your explicit grant.
        </Text>
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
  icon: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center" },
  sub: { fontSize: 13, color: colors.muted, textAlign: "center" },
  error: {
    backgroundColor: "#fff1f1",
    color: "#a33",
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    textAlign: "center",
    width: "100%",
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  note: { fontSize: 11, color: colors.muted, textAlign: "center", lineHeight: 16 },
});