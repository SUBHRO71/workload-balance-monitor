# Background workers

Unconfigured worker fails instead of silently acknowledging a job. Aggregation, insights, exports, deletion, and notification jobs will be separate handlers under `src/jobs/`. No queue is connected.
