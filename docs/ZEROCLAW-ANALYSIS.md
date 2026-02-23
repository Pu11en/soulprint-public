# ZeroClaw Architecture Analysis

**Date:** 2025-02-22
**Purpose:** Analyze ZeroClaw for forking into SoulPrint

## Executive Summary

ZeroClaw is a **production-grade, single-binary Rust AI agent runtime**. It solves nearly all of SoulPrint's current pain points:

✅ **Single service architecture** (no CF → Railway handoff)  
✅ **Built-in AWS Bedrock support** with SigV4 signing (no SDK!)  
✅ **Robust Telegram implementation** (152KB of battle-tested code)  
✅ **Comprehensive retry/backoff logic** for all providers  
✅ **Daemon mode** with component supervisors  
✅ **Memory system** with multiple backends  

## 1. Core Architecture

### 1.1 Single Binary Daemon
```
zeroclaw daemon
├── Gateway (HTTP/WebSocket server)
├── Channels (Telegram, Discord, Slack, etc.)
├── Heartbeat (periodic health checks)
└── Scheduler (cron jobs)
```

Each component runs under a **supervisor** that:
- Auto-restarts on failure
- Exponential backoff between retries
- Independent lifecycle management

### 1.2 Key Source Files

| File | Size | Purpose |
|------|------|---------|
| `src/channels/telegram.rs` | 152KB | Complete Telegram implementation |
| `src/agent/loop_.rs` | 192KB | Agent tool-calling loop |
| `src/providers/reliable.rs` | 72KB | Retry/backoff wrapper |
| `src/providers/bedrock.rs` | 52KB | AWS Bedrock with SigV4 |
| `src/memory/sqlite.rs` | 66KB | SQLite memory backend |
| `src/config/schema.rs` | 241KB | Full config system |

### 1.3 Trait-Based Architecture

```rust
// Channels are swappable
#[async_trait]
pub trait Channel: Send + Sync {
    fn name(&self) -> &str;
    async fn send(&self, message: &SendMessage) -> Result<()>;
    async fn listen(&self, tx: Sender<ChannelMessage>) -> Result<()>;
    async fn health_check(&self) -> bool;
    // Draft/streaming support
    fn supports_draft_updates(&self) -> bool;
    async fn send_draft(&self, message: &SendMessage) -> Result<Option<String>>;
    async fn update_draft(&self, recipient: &str, id: &str, text: &str) -> Result<()>;
    async fn finalize_draft(&self, recipient: &str, id: &str, text: &str) -> Result<()>;
}

// Providers are swappable
#[async_trait]
pub trait Provider: Send + Sync {
    async fn chat(&self, request: &ChatRequest) -> Result<ChatResponse>;
    fn capabilities(&self) -> ProviderCapabilities;
}

// Memory backends are swappable
#[async_trait]
pub trait Memory: Send + Sync {
    async fn store(&self, key: &str, content: &str, category: MemoryCategory) -> Result<()>;
    async fn recall(&self, query: &str, limit: usize, cat: Option<MemoryCategory>) -> Result<Vec<MemoryEntry>>;
    async fn forget(&self, key: &str) -> Result<()>;
}
```

## 2. Telegram Implementation Deep Dive

### 2.1 What ZeroClaw Does Right

**Long Polling with Error Recovery:**
```rust
loop {
    let resp = match self.http_client().post(&url).json(&body).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Telegram poll error: {e}");
            tokio::time::sleep(Duration::from_secs(5)).await;
            continue;  // Don't crash, just retry
        }
    };
    // Handle 409 (conflict) gracefully
    if error_code == 409 {
        tracing::warn!("Telegram polling conflict (409)...");
        tokio::time::sleep(Duration::from_secs(2)).await;
        continue;
    }
}
```

**Rate-Limited Draft Updates:**
```rust
// Rate-limit edits per chat
let elapsed = last_time.elapsed().as_millis();
if elapsed < self.draft_update_interval_ms {
    return Ok(());  // Skip this update, don't flood
}
```

**Automatic Message Chunking:**
```rust
const TELEGRAM_MAX_MESSAGE_LENGTH: usize = 4096;
const TELEGRAM_CONTINUATION_OVERHEAD: usize = 30;

fn split_message_for_telegram(message: &str) -> Vec<String> {
    // Smart splitting at word/newline boundaries
    // Adds continuation markers
}
```

**Typing Indicators:**
```rust
async fn start_typing(&self, recipient: &str) -> Result<()> {
    // Spawns background task that sends typing every 4s
    // (Telegram typing expires after 5s)
}
```

**Voice Message Transcription:**
```rust
async fn try_parse_voice_message(&self, update: &Value) -> Option<ChannelMessage> {
    // Downloads voice, transcribes with configured provider
    // Returns transcribed text as message
}
```

**Attachment Handling:**
```rust
// Supports: images, documents, videos, audio, voice
// Both upload (file paths) and URL-based sending
// Inline markers: [IMAGE: /path/to/file.png]
```

### 2.2 User Authorization

```rust
// Three ways to authorize users:
// 1. Config allowlist: allowed_users = ["username", "12345678"]
// 2. Wildcard: allowed_users = ["*"]
// 3. Runtime pairing: /bind <code>
```

### 2.3 Group Chat Handling

```rust
// mention_only mode for groups
if Self::is_group_message(message) && self.mention_only {
    if !Self::contains_bot_mention(text, &bot_username) {
        return None;  // Ignore unless mentioned
    }
}
```

## 3. Provider System

### 3.1 Available Providers

| Provider | File | Notes |
|----------|------|-------|
| Anthropic | `anthropic.rs` | Direct Claude API |
| **AWS Bedrock** | `bedrock.rs` | SigV4 signing, no SDK |
| OpenAI | `openai.rs` | GPT models |
| OpenRouter | `openrouter.rs` | Multi-provider gateway |
| Gemini | `gemini.rs` | Google models |
| Ollama | `ollama.rs` | Local models |
| Compatible | `compatible.rs` | OpenAI-compatible endpoints |

### 3.2 Bedrock Implementation

**No AWS SDK required!** Uses manual SigV4 signing:
```rust
fn derive_signing_key(secret: &str, date: &str, region: &str, service: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{secret}").as_bytes(), date.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, service.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}
```

**Credential Resolution:**
```rust
// Priority: env vars → EC2 IMDSv2
async fn resolve() -> Result<Self> {
    if let Ok(creds) = Self::from_env() { return Ok(creds); }
    Self::from_imds().await
}
```

### 3.3 Reliable Provider Wrapper

The `reliable.rs` module wraps any provider with:

- **Retry with exponential backoff**
- **Rate limit detection** (429 → wait and retry)
- **Non-retryable error classification** (auth failures, model not found)
- **Retry-After header parsing**
- **Multi-provider fallback**

```rust
fn is_rate_limited(err: &anyhow::Error) -> bool {
    // Check for 429 status code
}

fn is_non_retryable(err: &anyhow::Error) -> bool {
    // 4xx errors (except 429, 408) are non-retryable
    // Auth failures by keyword
    // Model not found errors
}

fn is_non_retryable_rate_limit(err: &anyhow::Error) -> bool {
    // Business/quota errors that won't resolve with retries
    // "plan does not include", "insufficient balance", etc.
}
```

## 4. Memory System

### 4.1 Backends

| Backend | File | Use Case |
|---------|------|----------|
| SQLite | `sqlite.rs` | Default, embedded |
| PostgreSQL | `postgres.rs` | Multi-instance |
| Markdown | `markdown.rs` | Human-readable files |
| Lucid | `lucid.rs` | SQLite + cloud sync |
| None | `none.rs` | Stateless mode |

### 4.2 Memory Operations

```rust
// Store with category
await memory.store("user_preference", "dark mode", MemoryCategory::Preference)?;

// Recall with relevance scoring
let entries = memory.recall("theme settings", 5, Some(MemoryCategory::Preference)).await?;

// Auto-compaction when history exceeds threshold
auto_compact_history(&mut history, provider, model, max_history).await?;
```

## 5. Tool System

### 5.1 Available Tools

| Tool | Purpose |
|------|---------|
| `shell` | Execute commands |
| `file_read` | Read files |
| `file_write` | Write files |
| `file_edit` | Edit files |
| `browser` | Web automation |
| `http_request` | HTTP calls |
| `web_search` | Search the web |
| `memory_store/recall/forget` | Memory ops |
| `cron_*` | Schedule management |
| `delegate` | Spawn sub-agents |

### 5.2 Tool Security

```rust
// Credential scrubbing before displaying output
pub(crate) fn scrub_credentials(input: &str) -> String {
    // Redacts: tokens, api_keys, passwords, secrets, credentials
    // Preserves 4-char prefix for debugging
}
```

## 6. What Needs Adaptation for SoulPrint

### 6.1 Multi-Tenant Architecture

**Current:** Single-user, single-bot
**Needed:** Bot pool serving multiple users

```rust
// Current
struct TelegramChannel {
    bot_token: String,  // One token
    allowed_users: Vec<String>,  // One allowlist
}

// SoulPrint needs
struct TelegramBotPool {
    bots: Vec<BotInstance>,
    user_assignments: HashMap<UserId, BotId>,
    db: PostgresPool,  // Persist assignments
}
```

### 6.2 User Session Management

**Current:** Config file-based
**Needed:** Database-driven

```rust
// Add Supabase integration
struct UserSession {
    user_id: String,
    bot_id: String,
    stripe_customer_id: Option<String>,
    created_at: DateTime,
    last_active: DateTime,
}
```

### 6.3 Webhook Mode

**Current:** Long polling only
**Needed:** Webhook mode for serverless/multi-bot

```rust
// Add webhook handler
async fn handle_telegram_webhook(
    bot_token: &str,
    update: Value,
) -> Result<()> {
    // Process update without polling loop
}
```

### 6.4 Custom Tools

**Add:**
- Vercel deployment tool
- Image generation (Flux, Midjourney)
- Video generation (Kling, Veo3)
- Stripe billing integration

## 7. Deployment Strategy

### 7.1 Current ZeroClaw
- Single binary
- Systemd/launchd service
- Local config file

### 7.2 SoulPrint Target
- Docker container on Railway
- PostgreSQL for state
- Supabase for auth/users
- Multiple bot tokens managed

### 7.3 Migration Path

1. **Phase 1:** Fork ZeroClaw, adapt for multi-bot
2. **Phase 2:** Add webhook mode alongside polling
3. **Phase 3:** Integrate Supabase for user management
4. **Phase 4:** Add SoulPrint-specific tools
5. **Phase 5:** Deploy to Railway as Docker container

## 8. Key Benefits of This Approach

1. **Battle-tested Telegram code** - 152KB of edge cases handled
2. **Retry/backoff built in** - No silent failures
3. **Single service** - No handoff complexity
4. **Rust performance** - Low memory, fast startup
5. **Clean architecture** - Traits make extension easy
6. **AWS Bedrock ready** - Just add credentials

## 9. Estimated Effort

| Task | Effort | Priority |
|------|--------|----------|
| Multi-bot pool | 2-3 days | P0 |
| Webhook handler | 1 day | P0 |
| Supabase user integration | 2 days | P1 |
| Vercel deploy tool | 1 day | P2 |
| Image gen tools | 2 days | P2 |
| Video gen tools | 2 days | P2 |
| Railway deployment | 1 day | P0 |

**Total:** ~10-12 days to production-ready SoulPrint

## 10. Files to Study Further

For implementation, focus on:

```
src/channels/telegram.rs      # Core Telegram logic
src/channels/mod.rs           # Channel orchestration
src/daemon/mod.rs             # Daemon supervisor
src/providers/bedrock.rs      # Bedrock auth
src/providers/reliable.rs     # Retry logic
src/config/schema.rs          # Config structure
```
