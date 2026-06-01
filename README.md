# Smart Factory Dashboard

An industrial monitoring and digital-twin dashboard for a smart manufacturing line.
It combines a real-time React frontend, a 3D factory digital twin, live PLC/IoT
telemetry over MQTT, OEE and predictive analytics, and an Express backend that
powers Dynamic Path Selection (DPS) and Video Analytics.

Built with React 19, TypeScript, Vite, and React Three Fiber, with AWS IoT Core,
IoT SiteWise, and Bedrock integrations.

## Features

- **Real-time dashboard** for machine status, energy consumption, emissions,
  noise, and KPIs across factory zones.
- **3D digital twin** of the factory floor (React Three Fiber / drei), including
  animated machinery, conveyors, robot arms, filling stations, and interactive
  sensor overlays.
- **Live PLC telemetry** ingested over MQTT and surfaced through PLC parameter
  widgets and a control room view.
- **OEE analytics** with gauges and trend panels.
- **Predictive maintenance** panels backed by a client-side prediction engine
  and SiteWise-derived signals.
- **KOS dispenser** monitoring and LoRaWAN sensor widgets with detail drawers.
- **Dynamic Path Selection (DPS)** for edge networking: live IPsec telemetry over
  AWS IoT Core, plus Force Fiber / Force 5G / Auto path control commands.
- **Video Analytics** that proxies MJPEG inference streams from NVIDIA and Hailo
  nodes.
- **AI insights** via the Anthropic SDK and Amazon Bedrock, including an AI chat
  panel and an AI insight card inside the DPS modal.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (rolldown-vite) for builds and dev server
- **React Three Fiber**, **drei**, and **postprocessing** for the 3D scene
- **Zustand** for state management
- **Recharts** for charts
- **Tailwind CSS** for styling
- **Express 5** backend (DPS + Video Analytics APIs)
- **MQTT** and **aws-iot-device-sdk-v2** for IoT telemetry
- **AWS SDK v3** (IoT SiteWise, Cognito, credential providers) and **Bedrock SDK**
- **Vitest** + Testing Library for tests
- **GitHub Actions** for CI and GitHub Pages deployment

## Project Structure

```
src/
  components/            Dashboard UI, widgets, modals, and panels
    factory3d/          React Three Fiber digital-twin scene and equipment
  integrations/         Integration UI (cards, sparklines, AI insight card)
  context/              React context providers (Filter, PLC)
  stores/               Zustand stores and client-side simulations
  services/             PLC, SiteWise, prediction, and LangGraph services
  hooks/                Data hooks (MQTT buffer, OEE, predictions, KOS, etc.)
  data/                 Mock data
  types/                Shared TypeScript types
  App.tsx               App shell and providers
  main.tsx              Entry point

server/                 Express backend (DPS IPsec, path control, video, LLM)
scripts/                MQTT bridge, AI proxy, SiteWise ingest, setup scripts
lambda/                 AWS Lambda functions (IoT policy, PLC command/transform,
                        SiteWise query, websocket connect)
integration/            Integration bundle and snippets
integration-bundle/     Self-contained integration package
deploy/                 EC2 setup notes and nginx config
.github/workflows/      CI and GitHub Pages deployment workflows
```

## Getting Started

### Prerequisites

- Node.js (with npm)

### Install

```bash
npm install
```

### Configure environment

Copy the example file and fill in your own values locally:

```bash
cp .env.example .env
```

The `.env` file is gitignored and must never be committed — it holds secrets such
as AWS credentials and API keys. See [Configuration](#configuration) for the
variables consumed by the backend.

### Run the frontend

```bash
npm run dev
```

### Run the frontend and backend together

```bash
npm run dev:full
```

This starts the Vite dev server and the Express backend (`tsx watch server/index.ts`)
concurrently. The backend listens on `http://127.0.0.1:3001` by default.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server (frontend only) |
| `npm run dev:server` | Start the Express backend with watch mode |
| `npm run dev:full` | Run the frontend and backend together |
| `npm run build` | Type-check and produce a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run mqtt-bridge` | Bridge AWS IoT MQTT messages to the dashboard |
| `npm run ai-proxy` | Run the local AI proxy |
| `npm run sitewise-ingest` | Ingest telemetry into AWS IoT SiteWise |

## Backend Server

The Express server in `server/` powers the Dynamic Path Selection and Video
Analytics features. Registered routes include:

- `GET  /api/health` — health check
- `GET  /api/ipsec/snapshot` — latest IPsec telemetry snapshot
- `GET  /api/ipsec/stream` — IPsec telemetry stream (SSE)
- `POST /api/gateway/path` — apply a path-control command (Fiber / 5G / Auto)
- `POST /api/ipsec/insight` — AI insight stream (SSE, Bedrock-powered)
- `GET  /api/video` — list available video streams
- `GET  /api/video/:id` — MJPEG passthrough for a single stream

## Configuration

Backend configuration is read from `.env` (see `.env.example` for the full,
documented template). Key variables include:

- `PORT` — backend port (default `3001`)
- `AWS_IOT_ENDPOINT`, `AWS_IOT_TOPIC` — AWS IoT Core endpoint and IPsec topic
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
  — AWS credentials for SigV4 MQTT auth (prefer temporary creds or an instance
  profile in production)
- `IOT_PATH_CONTROL_TOPIC` — topic for DPS path-control commands
- `AWS_BEARER_TOKEN_BEDROCK` — Bedrock key for the optional AI insight card
- `VIDEO_BASE_NVIDIA`, `VIDEO_BASE_HAILO` — base URLs of the MJPEG inference nodes

Do not commit real values. Keep all secrets in `.env`, which is gitignored.

## Testing and Linting

```bash
npm run lint
npm run test
```

## CI/CD and Deployment

### Continuous integration

Every push to `master` triggers the CI workflow on GitHub Actions, which runs
lint, build (including the TypeScript type-check), and tests. Results appear in
the **Actions** tab. CI is informational and does not block pushes.

### GitHub Pages

Deployment to GitHub Pages is manual:

1. Open the repository on GitHub and go to the **Actions** tab.
2. Select **Deploy to GitHub Pages** in the sidebar.
3. Click **Run workflow**.
4. When the run finishes, the live URL appears in the run summary.

Live site: `https://harishprk.github.io/smart-factory/`

### Server deployment

For deploying the backend on a VM, see `deploy/EC2_SETUP.md` and the reverse-proxy
configuration in `deploy/nginx.conf`.

## Security

- `.env` is gitignored and must never be committed.
- Rotate any credential that has ever been exposed; removing a file from history
  does not invalidate a leaked secret.
- Use temporary credentials or an instance profile instead of long-term access
  keys wherever possible.
