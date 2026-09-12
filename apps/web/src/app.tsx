import { colors } from "@workload/design-tokens";

export function App() {
  return (
    <main style={{ color: colors.text }}>
      <p className="eyebrow">YOUR WORK. YOUR BOUNDARIES.</p>
      <h1>Workload Balance Monitor</h1>
      <p>A clearer view of workload, with privacy at its heart.</p>
      <section aria-labelledby="setup-title">
        <h2 id="setup-title">Your space is taking shape</h2>
        <p>Personal trends and voluntary check-ins are coming soon.</p>
        <p>No workload data is being collected or shared.</p>
      </section>
      <footer>Consent first. No rankings. Humans decide.</footer>
    </main>
  );
}
