# Archived Cloudflare score API scaffold

This directory is a legacy, inactive Cloudflare D1/Workers experiment. It is not the production score API and is not used by the current website. Arcade Atlas currently serves scores through the Neon Function documented in [`SCORES_SETUP.md`](../SCORES_SETUP.md).

The files here are retained as historical implementation material. Do not deploy this Worker, migrate production scores, or change the browser API configuration based on this scaffold without first verifying current service ownership and planning a deliberate migration.

For the active production API, see [`SCORES_SETUP.md`](../SCORES_SETUP.md). The public Neon health endpoint is the source of truth for service availability.
