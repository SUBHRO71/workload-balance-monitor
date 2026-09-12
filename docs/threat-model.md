# Initial threat model

Status: design checklist; controls are not yet implemented.

| Threat | Required mitigation |
| --- | --- |
| Cross-organization or unauthorized team access | Server-side membership and resource authorization |
| Stale consent or queued writes after revocation | Version checks, invalidation, fail-closed disclosure |
| Individual inference from aggregates | Contributor suppression, fixed windows, complementary-release review |
| Private notes leaking through telemetry or exports | Data minimization, redaction, export authorization |
| Duplicate jobs or retries | Idempotency and bounded recovery |
| Client bundle containing server credentials | Package boundaries and public-only frontend configuration |

Add concrete abuse cases and executable tests as endpoints are implemented.
