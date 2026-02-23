# SoulPrint: ZeroClaw Adaptation Plan

**Date:** 2025-02-22
**Status:** Planning

## Goal

Transform ZeroClaw (single-user Rust AI agent) into SoulPrint (multi-tenant AI platform with Telegram bot pool).

## Phase 1: Core Infrastructure (Days 1-3)

### 1.1 Multi-Bot Pool Architecture

Create `src/channels/telegram_pool.rs`:

```rust
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct TelegramBotPool {
    bots: Vec<BotInstance>,
    user_assignments: RwLock<HashMap<String, usize>>,  // user_id → bot_index
    webhook_mode: bool,
}

pub struct BotInstance {
    username: String,
    token: String,
    channel: TelegramChannel,
    assigned_users: AtomicUsize,
}

impl TelegramBotPool {
    pub fn new(tokens: Vec<(String, String)>) -> Self {
        let bots = tokens.into_iter()
            .map(|(username, token)| BotInstance {
                username,
                channel: TelegramChannel::new(token.clone(), vec!["*".into()], false),
                token,
                assigned_users: AtomicUsize::new(0),
            })
            .collect();
        
        Self { 
            bots, 
            user_assignments: RwLock::new(HashMap::new()),
            webhook_mode: false,
        }
    }

    /// Assign a user to the least-loaded bot
    pub async fn assign_user(&self, user_id: &str) -> &BotInstance {
        let mut assignments = self.user_assignments.write().await;
        
        if let Some(&bot_idx) = assignments.get(user_id) {
            return &self.bots[bot_idx];
        }

        // Find bot with fewest users
        let (idx, bot) = self.bots.iter().enumerate()
            .min_by_key(|(_, b)| b.assigned_users.load(Ordering::Relaxed))
            .unwrap();
        
        bot.assigned_users.fetch_add(1, Ordering::Relaxed);
        assignments.insert(user_id.to_string(), idx);
        bot
    }

    /// Get bot for a user (if assigned)
    pub async fn get_bot_for_user(&self, user_id: &str) -> Option<&BotInstance> {
        let assignments = self.user_assignments.read().await;
        assignments.get(user_id).map(|&idx| &self.bots[idx])
    }
}
```

### 1.2 Webhook Handler

Add to `src/gateway/mod.rs`:

```rust
pub async fn handle_telegram_webhook(
    Path((bot_username,)): Path<(String,)>,
    State(pool): State<Arc<TelegramBotPool>>,
    Json(update): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Find bot by username
    let bot = pool.bots.iter()
        .find(|b| b.username == bot_username)
        .ok_or(StatusCode::NOT_FOUND)?;

    // Extract user info from update
    let user_id = update["message"]["from"]["id"]
        .as_i64()
        .map(|id| id.to_string());

    if let Some(user_id) = user_id {
        // Process message through assigned bot's channel
        // ... (reuse existing TelegramChannel logic)
    }

    StatusCode::OK
}
```

### 1.3 Config Updates

```toml
[channels.telegram_pool]
enabled = true
webhook_base_url = "https://soulprintengine.ai/telegram/webhook"

[[channels.telegram_pool.bots]]
username = "soulprint2bot"
token = "8392392461:AAH..."

[[channels.telegram_pool.bots]]
username = "soulprint3bot"
token = "8569580868:AAE..."

# ... more bots
```

## Phase 2: User Management (Days 4-5)

### 2.1 Supabase Integration

Create `src/users/supabase.rs`:

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct SupabaseClient {
    url: String,
    service_key: String,
    client: Client,
}

#[derive(Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub telegram_user_id: Option<String>,
    pub assigned_bot: Option<String>,
    pub stripe_customer_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl SupabaseClient {
    pub async fn get_or_create_user(&self, telegram_id: &str) -> Result<User> {
        // Check if user exists
        let existing = self.get_user_by_telegram_id(telegram_id).await?;
        if let Some(user) = existing {
            return Ok(user);
        }

        // Create new user
        self.create_user(telegram_id).await
    }

    pub async fn assign_bot(&self, user_id: &str, bot_username: &str) -> Result<()> {
        self.client
            .patch(&format!("{}/rest/v1/users?id=eq.{}", self.url, user_id))
            .header("Authorization", format!("Bearer {}", self.service_key))
            .header("apikey", &self.service_key)
            .json(&serde_json::json!({ "assigned_bot": bot_username }))
            .send()
            .await?;
        Ok(())
    }
}
```

### 2.2 Session Context

```rust
pub struct SessionContext {
    pub user: User,
    pub bot: BotInstance,
    pub memory: Box<dyn Memory>,
    pub conversation_id: String,
}

impl SessionContext {
    pub async fn for_telegram_message(
        pool: &TelegramBotPool,
        supabase: &SupabaseClient,
        telegram_user_id: &str,
    ) -> Result<Self> {
        // Get or create user
        let user = supabase.get_or_create_user(telegram_user_id).await?;
        
        // Get assigned bot (or assign one)
        let bot = pool.assign_user(&user.id).await;
        
        // Create per-user memory
        let memory = create_user_memory(&user.id).await?;
        
        Ok(Self {
            user,
            bot: bot.clone(),
            memory,
            conversation_id: uuid::Uuid::new_v4().to_string(),
        })
    }
}
```

## Phase 3: AWS Bedrock Configuration (Day 6)

### 3.1 Multi-Model Routing

```toml
[providers.bedrock]
enabled = true
region = "us-east-1"

[[providers.bedrock.models]]
id = "claude-sonnet"
model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"
max_tokens = 8192
default = true

[[providers.bedrock.models]]
id = "claude-haiku"
model_id = "anthropic.claude-3-haiku-20240307-v1:0"
max_tokens = 4096
# Use for quick responses
```

### 3.2 Credential Management

```rust
// Support multiple credential sources
enum AwsCredentialSource {
    Environment,           // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    InstanceMetadata,      // EC2 IMDSv2
    ContainerCredentials,  // ECS task role
    SecretsManager,        // Fetch from AWS Secrets Manager
}
```

## Phase 4: SoulPrint-Specific Tools (Days 7-9)

### 4.1 Vercel Deploy Tool

```rust
pub struct VercelDeployTool {
    token: String,
    team_id: Option<String>,
}

#[async_trait]
impl Tool for VercelDeployTool {
    fn name(&self) -> &str { "vercel_deploy" }
    
    fn description(&self) -> &str {
        "Deploy a project to Vercel. Supports Next.js, static sites, and more."
    }
    
    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "project_name": { "type": "string" },
                "source_dir": { "type": "string" },
                "production": { "type": "boolean", "default": false }
            },
            "required": ["project_name", "source_dir"]
        })
    }
    
    async fn execute(&self, params: Value) -> Result<String> {
        // Create deployment via Vercel API
    }
}
```

### 4.2 Image Generation Tool

```rust
pub struct ImageGenTool {
    kie_api_key: String,
}

#[async_trait]
impl Tool for ImageGenTool {
    fn name(&self) -> &str { "generate_image" }
    
    fn description(&self) -> &str {
        "Generate images using AI models (Flux, Ideogram, Imagen)."
    }
    
    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "prompt": { "type": "string" },
                "model": { 
                    "type": "string",
                    "enum": ["flux-pro", "ideogram", "imagen"]
                },
                "width": { "type": "integer", "default": 1024 },
                "height": { "type": "integer", "default": 1024 }
            },
            "required": ["prompt"]
        })
    }
    
    async fn execute(&self, params: Value) -> Result<String> {
        // Call Kie AI API
        // Return URL to generated image
    }
}
```

### 4.3 Video Generation Tool

```rust
pub struct VideoGenTool {
    kie_api_key: String,
}

#[async_trait]
impl Tool for VideoGenTool {
    fn name(&self) -> &str { "generate_video" }
    
    fn description(&self) -> &str {
        "Generate videos using AI models (Veo3, Kling, Runway)."
    }
    
    async fn execute(&self, params: Value) -> Result<String> {
        // Start generation job
        // Poll for completion
        // Return URL to video
    }
}
```

## Phase 5: Deployment (Days 10-11)

### 5.1 Dockerfile

```dockerfile
FROM rust:1.75-bookworm as builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/soulprint /usr/local/bin/

ENV RUST_LOG=info
EXPOSE 8080

CMD ["soulprint", "daemon", "--host", "0.0.0.0", "--port", "8080"]
```

### 5.2 Railway Configuration

```toml
# railway.toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "soulprint daemon --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30

[variables]
AWS_REGION = "us-east-1"
SUPABASE_URL = "https://swvljsixpvvcirjmflze.supabase.co"
```

### 5.3 Webhook Setup Script

```bash
#!/bin/bash
# setup_webhooks.sh

BASE_URL="https://soulprintengine.ai"

BOTS=(
    "soulprint2bot:8392392461:AAHUPcwcg6Ym4U3yxiZeBFe86S8vGFsWmdA"
    "soulprint3bot:8569580868:AAEgtf4rd8NlvHY_6nLkX1qDUKObxh-CfWo"
    "soulprint4bot:8455842623:AAEXmISfq0Z5WvhhpEGUEe70_X2j-AP2D30"
    # ... more bots
)

for bot in "${BOTS[@]}"; do
    IFS=':' read -r username token_part1 token_part2 <<< "$bot"
    token="${token_part1}:${token_part2}"
    
    webhook_url="${BASE_URL}/telegram/webhook/${username}"
    
    curl -X POST "https://api.telegram.org/bot${token}/setWebhook" \
        -d "url=${webhook_url}" \
        -d "allowed_updates=[\"message\"]"
    
    echo "Set webhook for ${username}: ${webhook_url}"
done
```

## Phase 6: Testing & Rollout (Days 11-12)

### 6.1 Integration Tests

```rust
#[tokio::test]
async fn test_bot_pool_assignment() {
    let pool = TelegramBotPool::new(vec![
        ("bot1".into(), "token1".into()),
        ("bot2".into(), "token2".into()),
    ]);

    // First user gets bot1
    let bot1 = pool.assign_user("user1").await;
    assert_eq!(bot1.username, "bot1");

    // Second user gets bot2 (load balancing)
    let bot2 = pool.assign_user("user2").await;
    assert_eq!(bot2.username, "bot2");

    // Same user gets same bot
    let bot1_again = pool.assign_user("user1").await;
    assert_eq!(bot1_again.username, "bot1");
}

#[tokio::test]
async fn test_webhook_handling() {
    let update = json!({
        "update_id": 123,
        "message": {
            "message_id": 456,
            "from": { "id": 789, "username": "testuser" },
            "chat": { "id": 789, "type": "private" },
            "text": "Hello bot!"
        }
    });

    // Simulate webhook call
    // Assert message is processed correctly
}
```

### 6.2 Rollout Plan

1. **Day 1:** Deploy to Railway staging
2. **Day 2:** Test with @soulprint2bot (single bot)
3. **Day 3:** Enable full bot pool
4. **Day 4:** Monitor and fix issues
5. **Day 5:** Go live, deprecate old CF+Railway architecture

## Success Criteria

- [ ] All 7 bots serving users reliably
- [ ] No message delivery failures
- [ ] Rate limiting working correctly
- [ ] User assignments persisted in Supabase
- [ ] Memory working per-user
- [ ] Bedrock integration working
- [ ] Image/video generation working
- [ ] < 500ms response latency (excluding LLM)

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Rust learning curve | ZeroClaw is well-documented; core logic stays unchanged |
| Railway resource limits | Start with 2GB RAM, scale as needed |
| Telegram rate limits | Built-in backoff already in ZeroClaw |
| AWS credential rotation | Use IAM roles with auto-rotation |
