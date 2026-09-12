# Repository guidance

- Use pnpm 10.30.0 from the repository root. Keep one workspace lockfile.
- Read README.md and docs/development.md before changing architecture or tooling.
- Keep client-safe packages independent from backend-core, services, and infra.
- Consent defaults to off. Do not add collection or sharing without server-side consent enforcement.
- Use only synthetic test data and never commit secrets or employee records.
- Mobile uses Expo SDK 57. Read the exact versioned documentation at https://docs.expo.dev/versions/v57.0.0/ before editing mobile code. Add Expo packages with expo install.
- Keep mobile source under apps/mobile/src. Reserve src/app for routes if Expo Router is introduced.
- Run checks appropriate to a change. Workspace validation is pnpm check; additional checks are pnpm mobile:check and pnpm infra:synth.
- Do not describe starter placeholders as implemented product features.
