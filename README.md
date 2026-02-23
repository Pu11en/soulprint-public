# SoulPrint Engine 🧠

Personal AI that knows you. Full-stack platform with per-user AI agents.

**Live:** https://soulprintengine.ai

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           soulprintengine.ai (Cloudflare)           │
├─────────────────────────────────────────────────────┤
│  Frontend (React + Vite)                            │
│  ├── Landing Page                                   │
│  ├── Signup / Login                                 │
│  ├── Chat Interface                                 │
│  └── Dashboard                                      │
├─────────────────────────────────────────────────────┤
│  Backend API (Hono on Workers)                      │
│  ├── Auth (Supabase)                                │
│  ├── Payments (Stripe)                              │
│  ├── Telegram Bot Pool                              │
│  └── Container Provisioning → Railway               │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│           Per-User Container (Railway)              │
├─────────────────────────────────────────────────────┤
│  OpenClaw Runtime                                   │
│  ├── SOUL.md (AI personality)                       │
│  ├── USER.md (user context)                         │
│  ├── MEMORY.md (persistent memory)                  │
│  └── Full Tool Suite:                               │
│      • File read/write/edit                         │
│      • Shell command execution                      │
│      • Web browsing & screenshots                   │
│      • Web search (Brave API)                       │
│      • Cron jobs & reminders                        │
│      • Custom skills                                │
├─────────────────────────────────────────────────────┤
│  Workspace Backup → GitHub (hourly)                 │
└─────────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite 6 + TailwindCSS |
| **Backend** | Hono 4 on Cloudflare Workers |
| **Database** | Supabase (auth + user data) |
| **Payments** | Stripe |
| **AI Runtime** | OpenClaw on Railway |
| **AI Models** | Anthropic Claude (Sonnet/Opus) |
| **Storage** | Cloudflare R2 + GitHub |

## Project Structure

```
soulprint-public/
├── src/
│   ├── client/           # React frontend
│   │   ├── pages/        # Landing, Signup, Chat, Dashboard
│   │   └── components/   # Reusable UI components
│   ├── routes/           # API routes
│   ├── auth/             # Authentication
│   └── index.ts          # Main Hono app
├── railway-container/    # Per-user OpenClaw template
│   ├── Dockerfile
│   ├── src/              # Setup UI + gateway proxy
│   └── setup/            # Workspace templates
├── templates/            # User workspace templates
└── public/               # Static assets
```

## Setup

### Prerequisites
- Node.js 20+
- Cloudflare account
- Supabase project
- Stripe account
- Railway account
- Anthropic API key

### Local Development

```bash
# Clone
git clone https://github.com/Pu11en/soulprint-public.git
cd soulprint-public

# Install
npm install

# Configure
cp .env.example .dev.vars
# Edit .dev.vars with your keys

# Run
npm run dev
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Environment Variables

See `.env.example` for all required variables:

- **AI:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (for embeddings)
- **Auth:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- **Payments:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- **Container:** `RAILWAY_TOKEN`
- **Tools:** Various API keys for Kie AI, ElevenLabs, Cloudinary, etc.

## How It Works

1. **User signs up** on soulprintengine.ai
2. **Backend provisions** a Railway container with OpenClaw
3. **User gets assigned** a Telegram bot from the pool
4. **Bootstrap flow** runs - AI asks user about preferences
5. **AI learns** and stores context in SOUL.md, USER.md, MEMORY.md
6. **Workspace backs up** to GitHub hourly

## Related Repos

- [`soulprint-engine`](https://github.com/Pu11en/soulprint-engine) - Railway container template (fork-friendly)
- [`soulprint-workspace-template`](https://github.com/Pu11en/soulprint-workspace-template) - User workspace backup template

## License

MIT
