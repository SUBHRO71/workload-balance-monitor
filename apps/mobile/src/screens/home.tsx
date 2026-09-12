import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@workload/design-tokens";

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Workload Balance Monitor</Text>
      <Text style={styles.text}>Your space is taking shape.</Text>
      <Text style={styles.text}>No workload data is being collected or shared.</Text>
      <Text style={styles.text}>Consent first. No rankings. Humans decide.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.large, gap: spacing.medium },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  text: { color: colors.muted, fontSize: 17, lineHeight: 26 },
});
