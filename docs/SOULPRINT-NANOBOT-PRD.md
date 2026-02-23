# SoulPrint v2 - Nanobot Fork PRD

**Version:** 1.0  
**Date:** 2026-02-22  
**Status:** Ready for Implementation  
**Base Repo:** https://github.com/HKUDS/nanobot

---

## Executive Summary

Fork Nanobot (~4,000 lines Python) to create SoulPrint v2 - a multi-tenant personal AI platform. Each user gets their own complete AI workspace with full tool access, running on Railway with no timeout limits.

**Why Nanobot over current SoulPrint (Cloudflare Workers):**
- Daemon architecture = NO TIMEOUTS
- 4,000 lines vs 430k (OpenClaw) = maintainable
- Python = easy AI tool integration
- Same workspace pattern (SOUL.md, MEMORY.md, etc.)
- Telegram, WhatsApp, Discord, Slack built in

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Railway                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SoulPrint Gateway                        │   │
│  │  (Single Nanobot instance with multi-tenant router)  │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ User 12345  │  │ User 67890  │  │ User 11111  │  │   │
│  │  │ workspace/  │  │ workspace/  │  │ workspace/  │  │   │
│  │  │ @sp2bot     │  │ @sp3bot     │  │ @sp4bot     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Supabase   │  │  AWS Bedrock │  │   Kie AI     │      │
│  │   (Users)    │  │  (Opus 4.6)  │  │  (Media)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Source Repository

**Fork from:** https://github.com/HKUDS/nanobot

```bash
git clone https://github.com/HKUDS/nanobot.git soulprint-v2
cd soulprint-v2
```

### Nanobot Structure (what we're working with)
```
nanobot/
├── agent/        # Core agent logic
├── bus/          # Event bus
├── channels/     # Telegram, Discord, WhatsApp, etc.
├── cli/          # Command line interface
├── config/       # Configuration schema
├── cron/         # Scheduled tasks
├── heartbeat/    # Heartbeat system
├── providers/    # LLM providers (OpenAI, Anthropic, etc.)
├── session/      # Session management
├── skills/       # Extensible skills
└── utils/        # Utilities

workspace/        # User workspace template
├── AGENTS.md
├── SOUL.md
├── USER.md
├── TOOLS.md
├── HEARTBEAT.md
└── memory/
```

---

## 2. What to REMOVE from Nanobot

```python
# Files/features to remove or simplify:

# 1. Unused providers (keep only Bedrock)
nanobot/providers/
├── anthropic.py      # REMOVE (using Bedrock)
├── openai.py         # REMOVE
├── openrouter.py     # REMOVE
├── deepseek.py       # REMOVE
├── moonshot.py       # REMOVE
├── qwen.py           # REMOVE
├── volcengine.py     # REMOVE
├── minimax.py        # REMOVE
├── vllm.py           # REMOVE
└── registry.py       # MODIFY (keep only Bedrock)

# 2. Unused channels (keep Telegram + Web)
nanobot/channels/
├── discord.py        # KEEP (future)
├── whatsapp.py       # KEEP (future)
├── feishu.py         # REMOVE
├── dingtalk.py       # REMOVE
├── email.py          # REMOVE
├── qq.py             # REMOVE
├── slack.py          # KEEP (future)
└── mochat.py         # REMOVE

# 3. CLI simplification
nanobot/cli/
└── onboard.py        # MODIFY (SoulPrint onboarding)
```

---

## 3. What to ADD to Nanobot

### 3.1 Multi-Tenant System

**New file:** `nanobot/tenants/`

```python
# nanobot/tenants/__init__.py

from .router import TenantRouter
from .bot_pool import BotPool
from .user_manager import UserManager

# nanobot/tenants/bot_pool.py

TELEGRAM_BOT_POOL = {
    "soulprint2bot": {
        "token": "8392392461:AAHUPcwcg6Ym4U3yxiZeBFe86S8vGFsWmdA",
        "webhook": "https://soulprintengine.ai/telegram/webhook/soulprint2bot",
        "assigned_users": []
    },
    "soulprint3bot": {
        "token": "8569580868:AAEgtf4rd8NlvHY_6nLkX1qDUKObxh-CfWo",
        "webhook": "https://soulprintengine.ai/telegram/webhook/soulprint3bot",
        "assigned_users": []
    },
    "soulprint4bot": {
        "token": "8455842623:AAEXmISfq0Z5WvhhpEGUEe70_X2j-AP2D30",
        "webhook": "https://soulprintengine.ai/telegram/webhook/soulprint4bot",
        "assigned_users": []
    },
    "soulprint5bot": {
        "token": "8569655066:AAElB70e9e_PbRUms0V0n4iQdZYWOrPc2TQ",
        "webhook": "https://soulprintengine.ai/telegram/webhook/soulprint5bot",
        "assigned_users": []
    },
    "soulprint6bot": {
        "token": "8564344025:AAGFoKo5NUOy6fUBFYJHF7fWgn3bLXr8au4",
        "webhook": "https://soulprintengine.ai/telegram/webhook/soulprint6bot",
        "assigned_users": []
    },
    "soulprint7bot": {
        "token": "8344606600:AAESg-WT00j0w0gplHRra-lPXnE3Smq-qu4",
        "webhook": "https://soulprintengine.ai/telegram/webhook/soulprint7bot",
        "assigned_users": []
    },
    "soulprint8bot": {
        "token": "8170707998:AAGkluS6Z2kjFsKtxAbGGt6qUgV6U8-_k_M",
        "webhook": "https://soulprintengine.ai/telegram/webhook/soulprint8bot",
        "assigned_users": []
    }
}

class BotPool:
    """Manages Telegram bot assignments to users."""
    
    async def assign_bot(self, user_id: str) -> str:
        """Assign least-loaded bot to new user."""
        # Find bot with fewest users
        # Return bot username
        pass
    
    async def get_user_bot(self, user_id: str) -> str:
        """Get bot assigned to user."""
        pass
    
    async def route_message(self, bot_username: str, message: dict) -> str:
        """Route incoming message to correct user workspace."""
        pass
```

```python
# nanobot/tenants/user_manager.py

from supabase import create_client
import os

class UserManager:
    """Manages user accounts via Supabase."""
    
    def __init__(self):
        self.supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"]
        )
    
    async def create_user(self, email: str, telegram_id: str) -> dict:
        """Create new user with workspace."""
        pass
    
    async def get_user(self, telegram_id: str) -> dict:
        """Get user by Telegram ID."""
        pass
    
    async def get_workspace_path(self, user_id: str) -> str:
        """Get user's workspace directory path."""
        return f"/data/workspaces/{user_id}/"
```

```python
# nanobot/tenants/router.py

class TenantRouter:
    """Routes requests to correct user context."""
    
    def __init__(self, bot_pool: BotPool, user_manager: UserManager):
        self.bot_pool = bot_pool
        self.user_manager = user_manager
    
    async def route(self, bot_username: str, telegram_user_id: str, message: str):
        """
        1. Look up user by telegram_id
        2. Get their workspace path
        3. Load their SOUL.md, MEMORY.md, etc.
        4. Execute agent with their context
        5. Return response
        """
        pass
```

### 3.2 AWS Bedrock Provider

**New file:** `nanobot/providers/bedrock.py`

```python
# nanobot/providers/bedrock.py

import boto3
import json
import hashlib
import hmac
from datetime import datetime
from typing import AsyncIterator

class BedrockProvider:
    """AWS Bedrock provider for Claude Opus 4.6."""
    
    MODEL_ID = "anthropic.claude-opus-4-6-20260220-v1:0"
    REGION = "us-east-1"
    
    def __init__(self, access_key: str, secret_key: str):
        self.access_key = access_key
        self.secret_key = secret_key
    
    def _sign_request(self, method: str, url: str, body: str) -> dict:
        """AWS SigV4 signing."""
        # Implementation from current SoulPrint
        pass
    
    async def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[dict] | None = None,
        stream: bool = False
    ) -> AsyncIterator[str] | str:
        """Send chat request to Bedrock."""
        
        endpoint = f"https://bedrock-runtime.{self.REGION}.amazonaws.com/model/{self.MODEL_ID}/converse"
        
        if stream:
            endpoint += "-stream"
        
        body = {
            "messages": messages,
            "system": [{"text": system}],
            "inferenceConfig": {
                "maxTokens": 8192,
                "temperature": 0.7
            }
        }
        
        if tools:
            body["toolConfig"] = {"tools": tools}
        
        # Sign and send request
        # Handle streaming or non-streaming response
        pass
```

### 3.3 SoulPrint Skills (Tools)

**New directory:** `nanobot/skills/soulprint/`

```python
# nanobot/skills/soulprint/__init__.py

from .image_gen import ImageGenSkill
from .video_gen import VideoGenSkill
from .vercel_deploy import VercelDeploySkill
from .google_stitch import GoogleStitchSkill
from .web_browse import WebBrowseSkill
from .voice_tts import VoiceTTSSkill

SOULPRINT_SKILLS = [
    ImageGenSkill,
    VideoGenSkill,
    VercelDeploySkill,
    GoogleStitchSkill,
    WebBrowseSkill,
    VoiceTTSSkill,
]
```

```python
# nanobot/skills/soulprint/image_gen.py

KIE_AI_KEY = "6efc289cb78bed900085851c51be6b9a"

class ImageGenSkill:
    """Generate images via Kie AI."""
    
    name = "generate_image"
    description = "Generate an image using AI. Supports Flux, Ideogram, Imagen, Midjourney styles."
    
    parameters = {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Image description"
            },
            "model": {
                "type": "string",
                "enum": ["flux", "ideogram", "imagen", "midjourney"],
                "description": "Model to use (default: flux)"
            },
            "aspect_ratio": {
                "type": "string",
                "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
                "description": "Aspect ratio (default: 1:1)"
            }
        },
        "required": ["prompt"]
    }
    
    async def execute(self, prompt: str, model: str = "flux", aspect_ratio: str = "1:1") -> str:
        """Generate image and return URL."""
        
        # Map to Kie AI model IDs
        model_map = {
            "flux": "flux-pro",
            "ideogram": "ideogram-v2",
            "imagen": "imagen-3",
            "midjourney": "midjourney-v6"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.kie.ai/v1/images/generate",
                headers={
                    "Authorization": f"Bearer {KIE_AI_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model_map.get(model, "flux-pro"),
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio
                },
                timeout=120
            )
            
            data = response.json()
            return f"![Generated Image]({data['url']})"
```

```python
# nanobot/skills/soulprint/video_gen.py

class VideoGenSkill:
    """Generate videos via Kie AI."""
    
    name = "generate_video"
    description = "Generate a video using AI. Supports Veo3, Kling, Runway models."
    
    parameters = {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "Video description"
            },
            "model": {
                "type": "string",
                "enum": ["veo3", "kling", "runway"],
                "description": "Model to use (default: veo3)"
            },
            "duration": {
                "type": "integer",
                "description": "Duration in seconds (5-30)"
            }
        },
        "required": ["prompt"]
    }
    
    async def execute(self, prompt: str, model: str = "veo3", duration: int = 10) -> str:
        """Generate video and return URL."""
        # Similar to image gen but for video
        pass
```

```python
# nanobot/skills/soulprint/vercel_deploy.py

VERCEL_TOKEN = "e4KjsciLB0X1pH9MLBsqOhLW"

class VercelDeploySkill:
    """Deploy websites to Vercel."""
    
    name = "deploy_website"
    description = "Deploy HTML/CSS/JS code to Vercel and get a live URL."
    
    parameters = {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Project name (lowercase, no spaces)"
            },
            "files": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"}
                    }
                },
                "description": "Files to deploy"
            }
        },
        "required": ["name", "files"]
    }
    
    async def execute(self, name: str, files: list[dict]) -> str:
        """Deploy to Vercel and return URL."""
        pass
```

```python
# nanobot/skills/soulprint/google_stitch.py

STITCH_API_KEY = "AQ.Ab8RN6LBoWbHEANK9gGYfVu6oSXxakhlazuDWiK68J6tFnAw8A"

class GoogleStitchSkill:
    """Generate UI designs with Google Stitch."""
    
    name = "stitch_generate_ui"
    description = "[GOOGLE STITCH] Generate a UI screen design using Google Stitch AI."
    
    parameters = {
        "type": "object",
        "properties": {
            "project_id": {
                "type": "string",
                "description": "Project ID (create one first if needed)"
            },
            "prompt": {
                "type": "string",
                "description": "Describe the UI you want"
            },
            "device_type": {
                "type": "string",
                "enum": ["MOBILE", "DESKTOP", "TABLET"],
                "description": "Device type"
            }
        },
        "required": ["prompt"]
    }
    
    async def execute(self, prompt: str, project_id: str = None, device_type: str = "MOBILE") -> str:
        """Generate UI design."""
        pass
```

```python
# nanobot/skills/soulprint/web_browse.py

class WebBrowseSkill:
    """Browse websites and extract content."""
    
    name = "web_browse"
    description = "Browse a website, click elements, fill forms, extract content."
    
    parameters = {
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "URL to browse"},
            "action": {
                "type": "string",
                "enum": ["get", "click", "type", "screenshot"],
                "description": "Action to perform"
            },
            "selector": {"type": "string", "description": "CSS selector for action"},
            "text": {"type": "string", "description": "Text to type"}
        },
        "required": ["url"]
    }
    
    async def execute(self, url: str, action: str = "get", selector: str = None, text: str = None) -> str:
        """Browse website using Playwright."""
        # Use Playwright for browser automation
        pass
```

```python
# nanobot/skills/soulprint/voice_tts.py

ELEVENLABS_KEY = "8bc289bf1c154985c213d8ab16301f8f547c6fe5d5b4d486aef8c31c6d0ff2f7"

class VoiceTTSSkill:
    """Text-to-speech using ElevenLabs."""
    
    name = "speak"
    description = "Convert text to speech audio."
    
    parameters = {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Text to speak"},
            "voice": {
                "type": "string",
                "description": "Voice ID or name"
            }
        },
        "required": ["text"]
    }
    
    async def execute(self, text: str, voice: str = "default") -> str:
        """Generate speech and return audio URL."""
        pass
```

### 3.4 Web UI

Keep existing Nanobot web UI pattern, add:

```python
# nanobot/web/routes.py

# Add these routes:

@app.post("/api/auth/signup")
async def signup(email: str, password: str):
    """Create new user account."""
    pass

@app.post("/api/auth/login")
async def login(email: str, password: str):
    """Login and get session token."""
    pass

@app.get("/api/chat/history")
async def get_history(user_id: str):
    """Get chat history for user."""
    pass

@app.post("/api/chat/message")
async def send_message(user_id: str, message: str):
    """Send message and get response."""
    pass

@app.post("/telegram/webhook/{bot_username}")
async def telegram_webhook(bot_username: str, update: dict):
    """Handle Telegram webhook for bot pool."""
    # Route to correct user via TenantRouter
    pass
```

---

## 4. Environment Variables

```bash
# Railway Environment Variables

# AWS Bedrock
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1

# Supabase
SUPABASE_URL=https://swvljsixpvvcirjmflze.supabase.co
SUPABASE_SERVICE_KEY=xxx

# Kie AI (images/video)
KIE_AI_KEY=6efc289cb78bed900085851c51be6b9a

# Vercel
VERCEL_TOKEN=e4KjsciLB0X1pH9MLBsqOhLW

# ElevenLabs (TTS)
ELEVENLABS_KEY=8bc289bf1c154985c213d8ab16301f8f547c6fe5d5b4d486aef8c31c6d0ff2f7

# Google Stitch
STITCH_API_KEY=AQ.Ab8RN6LBoWbHEANK9gGYfVu6oSXxakhlazuDWiK68J6tFnAw8A

# Cloudinary (media storage)
CLOUDINARY_CLOUD=djg0pqts6
CLOUDINARY_KEY=136843289897238
CLOUDINARY_SECRET=LfDHiB9FBR-fO2XgTnbEnmxZ9bg
```

---

## 5. Supabase Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    telegram_id TEXT UNIQUE,
    assigned_bot TEXT,
    workspace_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot assignments table
CREATE TABLE bot_assignments (
    bot_username TEXT PRIMARY KEY,
    user_count INTEGER DEFAULT 0,
    max_users INTEGER DEFAULT 1000
);

-- Initialize bot pool
INSERT INTO bot_assignments (bot_username) VALUES
    ('soulprint2bot'),
    ('soulprint3bot'),
    ('soulprint4bot'),
    ('soulprint5bot'),
    ('soulprint6bot'),
    ('soulprint7bot'),
    ('soulprint8bot');
```

---

## 6. Railway Deployment

### 6.1 Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright deps for web browsing
RUN pip install playwright && playwright install chromium && playwright install-deps

# Copy and install
COPY pyproject.toml .
COPY nanobot/ nanobot/
COPY workspace/ /app/workspace-template/

RUN pip install -e .

# Create data directory for user workspaces
RUN mkdir -p /data/workspaces

# Expose port
EXPOSE 8080

# Run gateway
CMD ["python", "-m", "nanobot", "gateway", "--port", "8080"]
```

### 6.2 railway.json

```json
{
    "build": {
        "builder": "DOCKERFILE"
    },
    "deploy": {
        "startCommand": "python -m nanobot gateway --port $PORT",
        "healthcheckPath": "/health",
        "restartPolicyType": "ON_FAILURE"
    }
}
```

---

## 7. User Workspace Template

When a new user signs up, copy this template to their workspace:

```
/data/workspaces/{user_id}/
├── SOUL.md          # Default AI personality
├── USER.md          # User info (filled during onboarding)
├── AGENTS.md        # Behavior rules
├── TOOLS.md         # Tool notes
├── HEARTBEAT.md     # Active tasks
├── MEMORY.md        # Long-term memory
├── IDENTITY.md      # AI identity
└── memory/          # Daily memory files
```

### Default SOUL.md
```markdown
# SOUL.md - Who I Am

I am your personal AI assistant powered by SoulPrint.

## Core Traits
- Direct and helpful
- Resourceful - I try to figure things out
- I have access to powerful tools (image gen, video gen, web browsing, code, deployment)
- I remember our conversations and learn about you over time

## Boundaries
- I keep your data private
- I ask before taking major external actions
- I'm here to help, not to lecture

## Tools I Have
- 🎨 Image generation (Flux, Ideogram, Midjourney, Imagen)
- 🎬 Video generation (Veo3, Kling, Runway)
- 🌐 Web browsing and research
- 💻 Code execution and deployment
- 🎙️ Voice/Text-to-speech
- 📁 File management
- 🚀 Deploy websites to Vercel
- 🎯 UI design with Google Stitch

Ask me anything. I'm here to help you get things done.
```

---

## 8. Implementation Order

### Phase 1: Core Fork (Day 1)
1. [ ] Fork nanobot repo
2. [ ] Remove unused providers (keep only Bedrock)
3. [ ] Remove unused channels (keep Telegram, Web)
4. [ ] Add Bedrock provider with SigV4 signing
5. [ ] Test basic chat works

### Phase 2: Multi-Tenant (Day 2)
1. [ ] Create tenants/ module
2. [ ] Implement BotPool with 7 bots
3. [ ] Implement UserManager with Supabase
4. [ ] Implement TenantRouter
5. [ ] Set up Telegram webhooks for all bots
6. [ ] Test multi-user routing

### Phase 3: Tools (Day 3)
1. [ ] Add ImageGenSkill (Kie AI)
2. [ ] Add VideoGenSkill (Kie AI)
3. [ ] Add VercelDeploySkill
4. [ ] Add GoogleStitchSkill
5. [ ] Add WebBrowseSkill (Playwright)
6. [ ] Add VoiceTTSSkill (ElevenLabs)
7. [ ] Test all tools work

### Phase 4: Web UI (Day 4)
1. [ ] Add auth routes (signup/login)
2. [ ] Add chat routes
3. [ ] Connect frontend to backend
4. [ ] Test web UI flow

### Phase 5: Deploy (Day 5)
1. [ ] Set up Railway project
2. [ ] Configure environment variables
3. [ ] Deploy and test
4. [ ] Set up Telegram webhooks to Railway URL
5. [ ] Test end-to-end

---

## 9. Testing Checklist

```
[ ] User can sign up via web
[ ] User gets assigned a Telegram bot
[ ] User can chat via Telegram
[ ] User can chat via web
[ ] Image generation works
[ ] Video generation works
[ ] Web browsing works
[ ] Vercel deployment works
[ ] Google Stitch works
[ ] Voice TTS works
[ ] Memory persists between sessions
[ ] SOUL.md personality is applied
[ ] Each user's data is isolated
[ ] No cross-user data leaks
```

---

## 10. API Keys Reference

| Service | Key Location |
|---------|--------------|
| AWS Bedrock | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Supabase | TOOLS.md |
| Kie AI | `6efc289cb78bed900085851c51be6b9a` |
| Vercel | `e4KjsciLB0X1pH9MLBsqOhLW` |
| ElevenLabs | `8bc289bf1c154985c213d8ab16301f8f547c6fe5d5b4d486aef8c31c6d0ff2f7` |
| Google Stitch | `AQ.Ab8RN6LBoWbHEANK9gGYfVu6oSXxakhlazuDWiK68J6tFnAw8A` |
| Cloudinary | Cloud: `djg0pqts6`, Key: `136843289897238` |

---

## 11. Success Criteria

1. **No Timeouts:** Complex tasks complete without timing out
2. **Isolation:** User A cannot access User B's data
3. **Full Tools:** All tools work for all users
4. **Memory:** AI remembers context across sessions
5. **Personality:** Each user can customize their AI's personality
6. **Scale:** Can handle 100+ concurrent users on one Railway instance

---

## Appendix: File Changes Summary

| Action | File/Directory |
|--------|---------------|
| REMOVE | `nanobot/providers/anthropic.py` |
| REMOVE | `nanobot/providers/openai.py` |
| REMOVE | `nanobot/providers/openrouter.py` |
| REMOVE | `nanobot/providers/deepseek.py` |
| REMOVE | `nanobot/providers/moonshot.py` |
| REMOVE | `nanobot/providers/qwen.py` |
| REMOVE | `nanobot/providers/volcengine.py` |
| REMOVE | `nanobot/providers/minimax.py` |
| REMOVE | `nanobot/providers/vllm.py` |
| REMOVE | `nanobot/channels/feishu.py` |
| REMOVE | `nanobot/channels/dingtalk.py` |
| REMOVE | `nanobot/channels/email.py` |
| REMOVE | `nanobot/channels/qq.py` |
| REMOVE | `nanobot/channels/mochat.py` |
| ADD | `nanobot/providers/bedrock.py` |
| ADD | `nanobot/tenants/__init__.py` |
| ADD | `nanobot/tenants/bot_pool.py` |
| ADD | `nanobot/tenants/user_manager.py` |
| ADD | `nanobot/tenants/router.py` |
| ADD | `nanobot/skills/soulprint/__init__.py` |
| ADD | `nanobot/skills/soulprint/image_gen.py` |
| ADD | `nanobot/skills/soulprint/video_gen.py` |
| ADD | `nanobot/skills/soulprint/vercel_deploy.py` |
| ADD | `nanobot/skills/soulprint/google_stitch.py` |
| ADD | `nanobot/skills/soulprint/web_browse.py` |
| ADD | `nanobot/skills/soulprint/voice_tts.py` |
| MODIFY | `nanobot/providers/registry.py` |
| MODIFY | `nanobot/channels/telegram.py` |
| MODIFY | `nanobot/config/schema.py` |
| ADD | `Dockerfile` |
| ADD | `railway.json` |

---

*PRD Version 1.0 - Ready for implementation*
