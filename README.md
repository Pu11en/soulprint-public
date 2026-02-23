# SoulPrint Engine 🧠

Personal AI that knows you. Full-stack platform with per-user AI agents.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           soulprintengine.ai (Cloudflare)           │
├─────────────────────────────────────────────────────┤
│  Frontend (React + Vite)                            │
│  ├── Landing, Signup, Login                         │
│  ├── Chat UI                                        │
│  └── Dashboard                                      │
├─────────────────────────────────────────────────────┤
│  API (Hono on Workers)                              │
│  ├── Auth (Supabase)                                │
│  ├── Payments (Stripe)                              │
│  └── Container Provisioning (Railway)               │
├─────────────────────────────────────────────────────┤
│  Per-User Agent (Railway)                           │
│  └── OpenClaw Runtime                               │
│      ├── SOUL.md (user identity)                    │
│      ├── MEMORY.md (persistent memory)              │
│      └── AI Provider (Anthropic/OpenAI)             │
└─────────────────────────────────────────────────────┘
```

## Stack

- **Frontend**: React 19 + Vite 6
- **Backend**: Hono 4 on Cloudflare Workers
- **Database**: Supabase (auth + user data)
- **Payments**: Stripe
- **AI Runtime**: OpenClaw on Railway (per-user containers)
- **Storage**: Cloudflare R2 + GitHub (workspace backups)

## Setup

1. Clone this repo
2. Copy `.env.example` to `.dev.vars`
3. Fill in your API keys
4. `npm install`
5. `npm run dev`

## Deployment

```bash
npm run deploy  # Deploys to Cloudflare Workers
```

## Related Repos

- [soulprint-engine](https://github.com/Pu11en/soulprint-engine) - Railway container template
- [soulprint-workspace-template](https://github.com/Pu11en/soulprint-workspace-template) - User workspace backup template

## License

MIT
