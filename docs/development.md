# Local development

Use Node.js 24 LTS (Node 22.13+ is also supported) and pnpm 10.30.0. The mobile starter uses Expo SDK 57 and its template-selected React/React Native versions.

```sh
corepack enable
corepack prepare pnpm@10.30.0 --activate
pnpm install --frozen-lockfile
pnpm dev:web
pnpm dev:mobile
```

Run the two development commands in separate terminals. On Windows PowerShell with script execution restricted, use `pnpm.cmd` and `npm.cmd`. If Corepack is unavailable, install the pinned pnpm version with your Node package tooling.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm mobile:check
pnpm infra:synth
```

`build` builds the web application and bundles backend entry points. It does not build native binaries. Use `pnpm --filter @workload/mobile exec expo export --platform android --platform ios` for a JavaScript bundle check. Device tests and store builds remain separate.

AWS credentials are not needed for the starter screens or unit tests. CDK synthesis can use explicit test account/region context; diff and deployment require authorized AWS credentials. Environment examples contain only public configuration names, are unused by the starter screens, and must never contain secrets.

Shared packages export TypeScript source, which Vite, Metro and backend bundlers consume. Their current check is TypeScript validation. Add packages with `pnpm --filter <workspace-name> add <package>`; add Expo runtime libraries using `pnpm --filter @workload/mobile exec expo install <package>`.

Mobile uses the official blank TypeScript template and a screen under `src/screens/`. Add Expo Router only when routes are introduced; then reserve `src/app/` for routes. Generated native folders are ignored. Preserve the Expo template license.
