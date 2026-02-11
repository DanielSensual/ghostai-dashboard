# GhostAI Command Center

Modern React/Next.js control plane for your `ghostai-x-bot` operations.

## What This Gives You

- Secure login with `DASHBOARD_SECRET`
- Real-time command runner from UI
- Live command logs / run history
- One place to run:
  - X engagement batches
  - Instagram engagement batches
  - Cross-platform video posting
  - Connection tests
  - Dashboard sync
- Existing analytics panels (platform health, queue, timeline, daily activity)

## Prerequisites

- `ghostai-dashboard` and `ghostai-x-bot` in the same parent folder (current setup)
- Node 20+
- Valid `.env` in `/Users/danielcastillo/Projects/Websites/Bots/ghostai-x-bot`

## Environment

In `/Users/danielcastillo/Projects/Websites/Bots/ghostai-dashboard/.env.local`:

```bash
DASHBOARD_SECRET=your-strong-secret
# Optional override if bot folder is elsewhere:
# BOT_COMMAND_ROOT=/absolute/path/to/ghostai-x-bot
# Optional (recommended for deployed dashboard):
# COMMAND_AGENT_URL=https://your-agent-host
# COMMAND_AGENT_TOKEN=your-agent-token
```

## Run

```bash
cd /Users/danielcastillo/Projects/Websites/Bots/ghostai-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter `DASHBOARD_SECRET`, then run commands from the Operations panel.

## Notes

- Command API endpoint: `/api/commands`
- Analytics API endpoint: `/api/sync`
- Both endpoints require `Authorization: Bearer <DASHBOARD_SECRET>`
- `post-all-video` now supports split captions:
  - `--x-caption` (for X, <=280)
  - `--main-caption` (LinkedIn/Facebook/Instagram)

## Deployed Dashboard + Live Commands

For Vercel-hosted command execution, run a local command agent in `ghostai-x-bot`:

```bash
cd /Users/danielcastillo/Projects/Websites/Bots/ghostai-x-bot
COMMAND_AGENT_TOKEN=your-agent-token npm run command:agent
```

Expose it via tunnel (example):

```bash
ngrok http 8787
```

Then set on Vercel:

- `COMMAND_AGENT_URL=https://<ngrok-or-public-url>`
- `COMMAND_AGENT_TOKEN=your-agent-token`

The dashboard `/api/commands` will proxy to this worker and keep full run history/output.
