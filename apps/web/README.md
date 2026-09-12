# Web app

React/Vite starter. Run `pnpm dev:web` from the root. The setup page makes no API requests and collects no workload data. Authentication, charts and consent controls remain to be implemented.

The root `amplify.yml` provides a hosting build specification. No Amplify app is connected or deployed. When connecting hosting, select `apps/web` as the monorepo app root and configure `AMPLIFY_MONOREPO_APP_ROOT` accordingly.
