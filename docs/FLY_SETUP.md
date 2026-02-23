# Fly.io Per-User Container Setup

SoulPrint can optionally provision dedicated Clawdbot instances on Fly.io for each user.

## Why Fly.io?

**Current Setup (Direct Bedrock):**
- Web + Telegram chat via AWS Bedrock direct calls
- Fast, serverless, no containers needed
- Good for basic chat, limited tool capabilities

**Fly.io Upgrade:**
- Each user gets their own Clawdbot container
- Full agent capabilities (tools, skills, memory, cron)
- Background tasks, persistent sessions
- Same AWS Bedrock Opus 4.6 underneath
- Apps auto-stop when idle (saves money), auto-wake on request

## Setup Steps

### 1. Create Fly.io Account & Get API Token

```bash
# Install fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Get API token
fly tokens create personal-access -x 99999h
# Save this token!
```

### 2. Add FLY_API_TOKEN to Cloudflare

```bash
# Add as secret to Cloudflare Workers
wrangler secret put FLY_API_TOKEN
# Paste your token when prompted
```

Or in `.dev.vars` for local development:
```
FLY_API_TOKEN=your-token-here
```

### 3. Build & Push Clawdbot Image

The Fly.io provisioner uses `ghcr.io/clawdbot/clawdbot:latest` by default.

For a custom image:
1. Update `CLAWDBOT_IMAGE` in `src/fly-provisioner.ts`
2. Ensure the image exposes port 8080
3. Ensure it accepts these env vars:
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - `TELEGRAM_BOT_TOKEN` (optional)
   - `SOUL_MD_B64`, `IDENTITY_MD_B64`, etc. (base64 encoded workspace files)

### 4. Deploy

```bash
cd soul-home
npm run build
wrangler deploy
```

## API Endpoints

### Check Status
```bash
curl -H "Authorization: Email user@example.com" \
  https://soulprintengine.ai/api/fly/status
```

### Provision App
```bash
curl -X POST -H "Authorization: Email user@example.com" \
  https://soulprintengine.ai/api/fly/provision
```

### Sync Workspace
```bash
curl -X POST -H "Authorization: Email user@example.com" \
  https://soulprintengine.ai/api/fly/sync
```

### Delete App
```bash
curl -X DELETE -H "Authorization: Email user@example.com" \
  https://soulprintengine.ai/api/fly/app
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     soulprintengine.ai                          │
│                  (Cloudflare Workers)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User Signs Up                                                 │
│        ↓                                                        │
│   Direct Bedrock (Default)                                      │
│   - Chat works immediately                                      │
│   - Basic tools (image gen, memory)                            │
│        ↓                                                        │
│   Claims Telegram Bot                                           │
│        ↓                                                        │
│   Fly.io App Provisioned (Optional)                            │
│   - Full Clawdbot instance                                      │
│   - All tools & skills                                         │
│   - Background tasks                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Fly.io                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   sp-{user-id-1}.fly.dev  ────┐                                │
│   sp-{user-id-2}.fly.dev  ────┼── Clawdbot containers          │
│   sp-{user-id-3}.fly.dev  ────┘   (auto-sleep when idle)       │
│                                                                 │
│   Each container:                                               │
│   - AWS Bedrock Opus 4.6                                       │
│   - User's workspace (SOUL.md, MEMORY.md, etc.)                │
│   - Telegram bot integration                                    │
│   - Full tool/skill access                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     AWS Bedrock                                 │
│              (Claude Opus 4.6 - We Provide)                    │
│                                                                 │
│   Users don't need API keys - we handle billing                │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Estimates

**Fly.io (per user app):**
- Shared CPU (1 core, 512MB): ~$0/mo when idle (auto-stop)
- Active usage: ~$3-5/mo for moderate use
- Auto-scales up to 3 replicas if needed

**AWS Bedrock:**
- Opus 4.6: ~$15-75/1M tokens
- Typical user: $5-20/mo depending on usage

## Hybrid Mode

You don't have to use Fly.io for all users:

1. **Free tier users**: Direct Bedrock only (no container)
2. **Paid users**: Fly.io container (full features)
3. **Telegram-only**: Could use direct Bedrock or Fly.io

The system supports both modes simultaneously.
