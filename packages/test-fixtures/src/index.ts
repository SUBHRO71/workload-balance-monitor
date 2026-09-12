import type { ConsentScopes } from "@workload/contracts";

// This fixture is synthetic and grants no processing or sharing consent.
export const consentDisabledFixture: ConsentScopes = {
  personalProcessing: false,
  teamAggregation: false,
  notifications: false,
};
