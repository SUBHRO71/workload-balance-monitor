# Data policy decisions

The authoritative policy is in [the README](../README.md#4-sharing-and-privacy-rules). This scaffold collects no workload data; the expanded policies below are requirements to implement.

Personal processing, manager-team aggregation, HR-organization aggregation, individual sharing, and notification choices are separate and default off. Real dashboards use user-entered data; synthetic fixtures/demo records remain isolated.

Users may explicitly share selected task/check-in fields or frozen summaries with their current named direct manager for a fixed date range and expiry. New records and revised source values are not automatically shared. Managers view publications inside the website only. HR receives organization aggregates only, with no individual sharing access. Private notes, goals, leave reasons/details and personal deadlines never enter work views or aggregates.

Ordinary personal records remain until the owner deletes them. Explicitly dated one-time private records expire 365 days after their relevant event/end date. Offboarding does not erase private records or remove owner access to their archive. Expiry/revocation gates act immediately on subsequent reads; cleanup is asynchronous.

The README labels proposed operational defaults separately: publication cleanup, generated export expiry, backup recovery window, the minimum contributor floor, 30-day notification/log retention, 7-day completed-job metadata, and 365-day content-free audits. Finalize these defaults before deployment. Backups must not resurrect user-deleted material into the serving application.
