# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Local Tesla run-once

Runs one real Tesla-backed Gridly observe → decide → act cycle locally and prints a structured JSON summary. No scheduler, no persistence, no UI involvement.

### What it does

1. Reads Tesla credentials and optional tuning from environment variables.
2. Bootstraps a `TeslaHttpApiClient`, `TeslaChargingRealAdapter`, in-memory observed-state store, and command executor.
3. Fetches live charging telemetry from the Tesla Fleet API.
4. Runs the canonical control loop against the current optimizer plan.
5. Dispatches any resulting commands to the vehicle.
6. Prints a structured JSON summary and exits.

### Command

```sh
npm run tesla:single-run
```

### Required environment variables

| Variable | Description |
|---|---|
| `TESLA_ACCESS_TOKEN` | Valid Tesla Fleet API OAuth2 access token |
| `TESLA_VEHICLE_ID` | Tesla vehicle ID as returned by the Fleet API |

### Optional environment variables

| Variable | Default | Description |
|---|---|---|
| `TESLA_BASE_URL` | Tesla Fleet API default | Override the Fleet API base URL (useful for regional endpoints) |
| `TESLA_TIMEOUT_MS` | `10000` | HTTP request timeout in milliseconds |
| `GRIDLY_NOW_ISO` | Current system time | ISO-8601 timestamp to use as the control-loop clock |
| `GRIDLY_SITE_ID` | Simulator default | Gridly site identifier written into telemetry and journal entries |
| `GRIDLY_TIMEZONE` | Simulator default | IANA timezone for tariff window and deadline evaluation |
| `GRIDLY_OPTIMIZATION_MODE` | `balanced` | Optimisation objective: `cost`, `balanced`, `self_consumption`, or `carbon` (invalid values safely default to `balanced`) |
| `GRIDLY_OCTOPUS_EXPORT_PRODUCT` | import product | Optional Octopus export product code |
| `GRIDLY_OCTOPUS_EXPORT_TARIFF_CODE` | `G-1R-{product}-{region}` | Optional explicit Octopus export tariff code override |

### Example invocation

```sh
TESLA_ACCESS_TOKEN=ey... \
TESLA_VEHICLE_ID=1234567890 \
TESLA_BASE_URL=https://fleet-api.prd.eu.vn.cloud.tesla.com \
npm run tesla:single-run
```

### Output

On success, exits `0` and prints:

```json
{
  "status": "ok",
  "now": "2026-03-16T10:05:00.000Z",
  "config": { "vehicleId": "...", "timeoutMs": 10000 },
  "telemetryIngestionResult": { "ingestedCount": 1, "acceptedCount": 1, ... },
  "controlLoopResultSummary": { "commandCount": 1, "replanRequired": false, ... },
  "executionSummary": { "total": 1, "issued": 1, "skipped": 0, "failed": 0 }
}
```

On any failure (missing credentials, network error, invalid config), exits `1` and prints:

```json
{
  "status": "error",
  "now": "...",
  "error": { "stage": "bootstrap", "code": "MISSING_ACCESS_TOKEN", "message": "..." }
}
```

### Intentionally out of scope

This command runs exactly one cycle and exits. It does not poll, schedule, persist state, or interact with the UI. Retry logic, recurring scheduling, and production deployment are separate concerns.

---

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
