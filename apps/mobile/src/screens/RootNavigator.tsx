import React from "react";
import { ActivityIndicator, SafeAreaView } from "react-native";
import { colors } from "@workload/design-tokens";
import { useAuth } from "../auth";
import { LoginScreen } from "./LoginScreen";
import { WorkOnlyScreen } from "./WorkOnlyScreen";
import { HomeScreen } from "./home";

const WORK_ROLES = ["manager", "hr", "org_admin"] as const;

export function RootNavigator() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!auth.authenticated) {
    return <LoginScreen onLogin={auth.login} loading={false} error={auth.error} />;
  }

  const activeMembership = auth.memberships.find((membership) => membership.status === "active");
  const workRoles = (activeMembership?.roles ?? []).filter((role) => (WORK_ROLES as readonly string[]).includes(role));
  if (workRoles.length > 0) {
    return <WorkOnlyScreen roles={workRoles as ("manager" | "hr" | "org_admin")[]} onSignOut={auth.logout} />;
  }

  return <HomeScreen />;
}
