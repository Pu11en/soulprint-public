// Fly.io Per-User Container Provisioner
// Creates isolated OpenClaw/Clawdbot instances for each SoulPrint user
//
// Architecture:
// - Each user gets their own Fly.io app
// - App runs Clawdbot with user's workspace (SOUL.md, MEMORY.md, etc.)
// - Handles both Telegram and Web chat
// - Uses AWS Bedrock Opus 4.6 (we provide the AI, no user API keys)
// - Apps auto-stop when idle, auto-wake on request

const FLY_API = 'https://api.machines.dev/v1';
const FLY_ORG = 'personal'; // Change if using an org

// Template image - pre-built Clawdbot/OpenClaw image
const CLAWDBOT_IMAGE = 'ghcr.io/clawdbot/clawdbot:latest';

// AWS credentials (we provide these - users don't need API keys)
const AWS_ACCESS_KEY_ID = 'AKIA36MTOXRJID6CNDWN';
const AWS_SECRET_ACCESS_KEY = '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';
const AWS_REGION = 'us-east-1';

interface UserWorkspace {
  userId: string;
  email: string;
  botName: string;
  telegramBotToken?: string;
  soulMd?: string;
  identityMd?: string;
  agentsMd?: string;
  userMd?: string;
  toolsMd?: string;
  memoryMd?: string;
}

interface ProvisionResult {
  success: boolean;
  appName?: string;
  appUrl?: string;
  error?: string;
}

interface FlyEnv {
  FLY_API_TOKEN: string;
}

// Generate a unique app name for a user
function getUserAppName(userId: string): string {
  // Fly.io app names: lowercase, alphanumeric, hyphens only
  // Max 63 chars, must start with letter
  const shortId = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase();
  return `sp-${shortId}`;
}

// Make authenticated Fly.io API request
async function flyRequest(
  env: FlyEnv,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const response = await fetch(`${FLY_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.FLY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fly.io API error: ${response.status} - ${error}`);
  }

  // Some endpoints return empty response
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Check if app exists
export async function appExists(env: FlyEnv, appName: string): Promise<boolean> {
  try {
    await flyRequest(env, 'GET', `/apps/${appName}`);
    return true;
  } catch (e) {
    return false;
  }
}

// Get app status (running, stopped, etc.)
export async function getAppStatus(env: FlyEnv, appName: string): Promise<{
  exists: boolean;
  running: boolean;
  url?: string;
}> {
  try {
    const app = await flyRequest(env, 'GET', `/apps/${appName}`);
    const machines = await flyRequest(env, 'GET', `/apps/${appName}/machines`);
    
    const running = machines.some((m: any) => 
      m.state === 'started' || m.state === 'starting'
    );
    
    return {
      exists: true,
      running,
      url: `https://${appName}.fly.dev`,
    };
  } catch (e) {
    return { exists: false, running: false };
  }
}

// Create a new Fly.io app for a user
export async function createUserApp(
  env: FlyEnv,
  workspace: UserWorkspace
): Promise<ProvisionResult> {
  const appName = getUserAppName(workspace.userId);
  
  try {
    // Check if app already exists
    const exists = await appExists(env, appName);
    if (exists) {
      console.log(`[FLY] App ${appName} already exists`);
      return {
        success: true,
        appName,
        appUrl: `https://${appName}.fly.dev`,
      };
    }

    // 1. Create the app
    console.log(`[FLY] Creating app: ${appName}`);
    await flyRequest(env, 'POST', '/apps', {
      app_name: appName,
      org_slug: FLY_ORG,
    });

    // 2. Create a machine with the Clawdbot image
    const machineConfig = {
      name: 'main',
      config: {
        image: CLAWDBOT_IMAGE,
        env: {
          // AWS Bedrock credentials (we provide)
          AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY,
          AWS_REGION,
          ANTHROPIC_MODEL: 'anthropic.claude-opus-4-5',
          
          // User workspace identity
          SOULPRINT_USER_ID: workspace.userId,
          SOULPRINT_USER_EMAIL: workspace.email,
          
          // Telegram bot config (if assigned)
          ...(workspace.telegramBotToken && {
            TELEGRAM_BOT_TOKEN: workspace.telegramBotToken,
          }),
          
          // Workspace files as env vars (base64 encoded for safety)
          SOUL_MD_B64: workspace.soulMd ? btoa(workspace.soulMd) : '',
          IDENTITY_MD_B64: workspace.identityMd ? btoa(workspace.identityMd) : '',
          AGENTS_MD_B64: workspace.agentsMd ? btoa(workspace.agentsMd) : '',
          USER_MD_B64: workspace.userMd ? btoa(workspace.userMd) : '',
          TOOLS_MD_B64: workspace.toolsMd ? btoa(workspace.toolsMd) : '',
          MEMORY_MD_B64: workspace.memoryMd ? btoa(workspace.memoryMd) : '',
        },
        services: [
          {
            protocol: 'tcp',
            internal_port: 8080,
            ports: [
              { port: 80, handlers: ['http'] },
              { port: 443, handlers: ['http', 'tls'] },
            ],
          },
        ],
        guest: {
          cpu_kind: 'shared',
          cpus: 1,
          memory_mb: 512,
        },
        auto_destroy: false,
        restart: {
          policy: 'on-failure',
          max_retries: 3,
        },
        // Auto-stop after 5 minutes of inactivity
        // Auto-start on HTTP request
        checks: {
          httpget: {
            type: 'http',
            port: 8080,
            path: '/health',
            interval: '30s',
            timeout: '5s',
          },
        },
      },
    };

    console.log(`[FLY] Creating machine for ${appName}`);
    await flyRequest(env, 'POST', `/apps/${appName}/machines`, machineConfig);

    // 3. Allocate IP addresses
    console.log(`[FLY] Allocating IPs for ${appName}`);
    // Note: Fly.io auto-allocates shared IPs, dedicated IPs require fly CLI
    
    const appUrl = `https://${appName}.fly.dev`;
    console.log(`[FLY] App created: ${appUrl}`);

    return {
      success: true,
      appName,
      appUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[FLY] Provision error:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Update workspace files for an existing app
export async function updateUserWorkspace(
  env: FlyEnv,
  userId: string,
  workspace: Partial<UserWorkspace>
): Promise<ProvisionResult> {
  const appName = getUserAppName(userId);
  
  try {
    // Get current machines
    const machines = await flyRequest(env, 'GET', `/apps/${appName}/machines`);
    
    if (!machines || machines.length === 0) {
      return { success: false, error: 'No machines found' };
    }

    const machine = machines[0];
    const currentEnv = machine.config?.env || {};

    // Update env vars with new workspace content
    const updatedEnv = {
      ...currentEnv,
      ...(workspace.soulMd !== undefined && { SOUL_MD_B64: btoa(workspace.soulMd) }),
      ...(workspace.identityMd !== undefined && { IDENTITY_MD_B64: btoa(workspace.identityMd) }),
      ...(workspace.agentsMd !== undefined && { AGENTS_MD_B64: btoa(workspace.agentsMd) }),
      ...(workspace.userMd !== undefined && { USER_MD_B64: btoa(workspace.userMd) }),
      ...(workspace.toolsMd !== undefined && { TOOLS_MD_B64: btoa(workspace.toolsMd) }),
      ...(workspace.memoryMd !== undefined && { MEMORY_MD_B64: btoa(workspace.memoryMd) }),
      ...(workspace.telegramBotToken && { TELEGRAM_BOT_TOKEN: workspace.telegramBotToken }),
    };

    // Update the machine config
    await flyRequest(env, 'POST', `/apps/${appName}/machines/${machine.id}`, {
      config: {
        ...machine.config,
        env: updatedEnv,
      },
    });

    // Restart to pick up new config
    await flyRequest(env, 'POST', `/apps/${appName}/machines/${machine.id}/restart`);

    return {
      success: true,
      appName,
      appUrl: `https://${appName}.fly.dev`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Wake up a stopped app
export async function wakeApp(env: FlyEnv, userId: string): Promise<boolean> {
  const appName = getUserAppName(userId);
  
  try {
    const machines = await flyRequest(env, 'GET', `/apps/${appName}/machines`);
    
    for (const machine of machines) {
      if (machine.state === 'stopped') {
        await flyRequest(env, 'POST', `/apps/${appName}/machines/${machine.id}/start`);
      }
    }
    
    return true;
  } catch (e) {
    console.error(`[FLY] Failed to wake ${appName}:`, e);
    return false;
  }
}

// Delete a user's app
export async function deleteUserApp(env: FlyEnv, userId: string): Promise<boolean> {
  const appName = getUserAppName(userId);
  
  try {
    // Stop all machines first
    const machines = await flyRequest(env, 'GET', `/apps/${appName}/machines`);
    for (const machine of machines) {
      await flyRequest(env, 'DELETE', `/apps/${appName}/machines/${machine.id}?force=true`);
    }
    
    // Delete the app
    await flyRequest(env, 'DELETE', `/apps/${appName}`);
    
    return true;
  } catch (e) {
    console.error(`[FLY] Failed to delete ${appName}:`, e);
    return false;
  }
}

// Forward a chat message to user's Fly.io app
export async function forwardToFlyApp(
  env: FlyEnv,
  userId: string,
  message: string,
  channel: 'web' | 'telegram' = 'web'
): Promise<{ response?: string; error?: string }> {
  const appName = getUserAppName(userId);
  const appUrl = `https://${appName}.fly.dev`;
  
  try {
    // Wake app if needed (Fly.io auto-starts on HTTP but let's be explicit)
    await wakeApp(env, userId);
    
    // Send message to the app's chat endpoint
    const response = await fetch(`${appUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SoulPrint-Channel': channel,
      },
      body: JSON.stringify({
        message,
        channel,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Chat endpoint returned ${response.status}`);
    }
    
    const data = await response.json() as { response?: string };
    return { response: data.response };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}

// Stream chat from Fly.io app (for web UI)
export async function streamFromFlyApp(
  env: FlyEnv,
  userId: string,
  message: string
): Promise<ReadableStream | null> {
  const appName = getUserAppName(userId);
  const appUrl = `https://${appName}.fly.dev`;
  
  try {
    await wakeApp(env, userId);
    
    const response = await fetch(`${appUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.body;
  } catch (e) {
    console.error(`[FLY] Stream error:`, e);
    return null;
  }
}

export { getUserAppName };
