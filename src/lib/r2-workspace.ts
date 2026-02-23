/**
 * R2 Workspace Management for SoulPrint Users
 * 
 * Manages user workspaces in Cloudflare R2:
 * /users/{user_id}/
 *   ├── workspace/
 *   │   ├── SOUL.md
 *   │   ├── IDENTITY.md
 *   │   ├── USER.md
 *   │   ├── AGENTS.md
 *   │   ├── TOOLS.md
 *   │   ├── MEMORY.md
 *   │   └── memory/
 *   │       └── YYYY-MM-DD.md
 *   └── config.json
 */

export interface WorkspaceFile {
  path: string;
  content: string;
  lastModified?: Date;
}

export interface UserWorkspace {
  userId: string;
  files: WorkspaceFile[];
  config: UserConfig;
}

export interface UserConfig {
  botId?: string;          // Assigned Telegram bot from pool
  botUsername?: string;    // Bot username (e.g., @soulprint2bot)
  createdAt: string;       // ISO date
  updatedAt: string;       // ISO date
  preferences?: {
    timezone?: string;
    language?: string;
    model?: string;        // Preferred AI model
  };
}

export interface WorkspaceDefaults {
  soulMd?: string;
  identityMd?: string;
  userMd?: string;
  agentsMd?: string;
  toolsMd?: string;
  memoryMd?: string;
  config?: Partial<UserConfig>;
}

// Default content for workspace files
const DEFAULT_SOUL_MD = `# SOUL.md - Your Identity

This is who you are. Define your personality, values, and purpose here.

## Core Identity
- Name: [Your AI's name]
- Purpose: [What you're here to do]

## Values
- Be helpful and honest
- Respect privacy
- Learn and grow

## Voice
- Friendly but professional
- Clear and concise
- Empathetic
`;

const DEFAULT_IDENTITY_MD = `# IDENTITY.md - Extended Identity

Deeper aspects of your identity that inform your behavior.

## Background
[Your AI's backstory or context]

## Expertise
[Areas of knowledge or specialization]

## Limitations
[What you can't or won't do]
`;

const DEFAULT_USER_MD = `# USER.md - About Your Human

Notes about the person you're helping.

## Basic Info
- Name: 
- Timezone: 

## Preferences
- Communication style: 
- Topics of interest: 

## Notes
[Things to remember about them]
`;

const DEFAULT_AGENTS_MD = `# AGENTS.md - Operational Guidelines

How you operate day-to-day.

## Session Startup
1. Read SOUL.md for identity
2. Read USER.md for context
3. Check recent memory files

## Memory
- Daily notes: memory/YYYY-MM-DD.md
- Long-term: MEMORY.md

## Communication
- Be proactive but not annoying
- Ask before taking significant actions
- Keep the human informed
`;

const DEFAULT_TOOLS_MD = `# TOOLS.md - Local Configuration

Your specific setup and credentials.

## Connected Services
[List any connected services or APIs]

## Preferences
[Tool-specific settings]
`;

const DEFAULT_MEMORY_MD = `# MEMORY.md - Long-Term Memory

Curated memories and learnings. Updated periodically from daily notes.

## Key Learnings
[Important insights and patterns]

## Milestones
[Significant events or achievements]

## Preferences Discovered
[Things learned about your human]
`;

/**
 * Create a new user workspace with default files
 */
export async function createUserWorkspace(
  bucket: R2Bucket,
  userId: string,
  defaults: WorkspaceDefaults = {}
): Promise<UserWorkspace> {
  const now = new Date().toISOString();
  
  // Create config
  const config: UserConfig = {
    createdAt: now,
    updatedAt: now,
    ...defaults.config,
  };
  
  // Define workspace files
  const files: WorkspaceFile[] = [
    { path: 'workspace/SOUL.md', content: defaults.soulMd || DEFAULT_SOUL_MD },
    { path: 'workspace/IDENTITY.md', content: defaults.identityMd || DEFAULT_IDENTITY_MD },
    { path: 'workspace/USER.md', content: defaults.userMd || DEFAULT_USER_MD },
    { path: 'workspace/AGENTS.md', content: defaults.agentsMd || DEFAULT_AGENTS_MD },
    { path: 'workspace/TOOLS.md', content: defaults.toolsMd || DEFAULT_TOOLS_MD },
    { path: 'workspace/MEMORY.md', content: defaults.memoryMd || DEFAULT_MEMORY_MD },
  ];
  
  // Write all files to R2
  const writePromises = files.map(file => 
    bucket.put(`users/${userId}/${file.path}`, file.content, {
      httpMetadata: { contentType: 'text/markdown' }
    })
  );
  
  // Write config.json
  writePromises.push(
    bucket.put(`users/${userId}/config.json`, JSON.stringify(config, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    })
  );
  
  await Promise.all(writePromises);
  
  return { userId, files, config };
}

/**
 * Get all workspace files for a user
 */
export async function getUserWorkspace(
  bucket: R2Bucket,
  userId: string
): Promise<UserWorkspace | null> {
  const prefix = `users/${userId}/`;
  
  // List all objects in user's workspace
  const listed = await bucket.list({ prefix });
  
  if (listed.objects.length === 0) {
    return null;
  }
  
  // Fetch all files
  const files: WorkspaceFile[] = [];
  let config: UserConfig | null = null;
  
  const fetchPromises = listed.objects.map(async (obj) => {
    const object = await bucket.get(obj.key);
    if (!object) return;
    
    const content = await object.text();
    const relativePath = obj.key.replace(prefix, '');
    
    if (relativePath === 'config.json') {
      config = JSON.parse(content);
    } else {
      files.push({
        path: relativePath,
        content,
        lastModified: obj.uploaded,
      });
    }
  });
  
  await Promise.all(fetchPromises);
  
  if (!config) {
    // Create default config if missing
    config = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  return { userId, files, config };
}

/**
 * Save a single file to user's workspace
 */
export async function saveFile(
  bucket: R2Bucket,
  userId: string,
  path: string,
  content: string
): Promise<void> {
  // Normalize path (remove leading slash if present)
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const key = `users/${userId}/${normalizedPath}`;
  
  // Determine content type
  const contentType = path.endsWith('.json') 
    ? 'application/json' 
    : 'text/markdown';
  
  await bucket.put(key, content, {
    httpMetadata: { contentType }
  });
  
  // Update config.json's updatedAt timestamp
  await updateConfigTimestamp(bucket, userId);
}

/**
 * Get a single file from user's workspace
 */
export async function getFile(
  bucket: R2Bucket,
  userId: string,
  path: string
): Promise<string | null> {
  // Normalize path
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const key = `users/${userId}/${normalizedPath}`;
  
  const object = await bucket.get(key);
  if (!object) {
    return null;
  }
  
  return object.text();
}

/**
 * Append content to a daily memory file
 */
export async function appendToMemory(
  bucket: R2Bucket,
  userId: string,
  date: string, // Format: YYYY-MM-DD
  content: string
): Promise<void> {
  const path = `workspace/memory/${date}.md`;
  const key = `users/${userId}/${path}`;
  
  // Get existing content
  const existing = await bucket.get(key);
  let newContent: string;
  
  if (existing) {
    const existingContent = await existing.text();
    // Append with timestamp
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    newContent = `${existingContent}\n\n## ${timestamp}\n${content}`;
  } else {
    // Create new file with header
    newContent = `# Memory Log - ${date}\n\n## ${new Date().toISOString().split('T')[1].split('.')[0]}\n${content}`;
  }
  
  await bucket.put(key, newContent, {
    httpMetadata: { contentType: 'text/markdown' }
  });
  
  await updateConfigTimestamp(bucket, userId);
}

/**
 * Delete a user's entire workspace
 */
export async function deleteUserWorkspace(
  bucket: R2Bucket,
  userId: string
): Promise<number> {
  const prefix = `users/${userId}/`;
  const listed = await bucket.list({ prefix });
  
  if (listed.objects.length === 0) {
    return 0;
  }
  
  // Delete all objects
  await Promise.all(
    listed.objects.map(obj => bucket.delete(obj.key))
  );
  
  return listed.objects.length;
}

/**
 * Check if a user workspace exists
 */
export async function workspaceExists(
  bucket: R2Bucket,
  userId: string
): Promise<boolean> {
  const key = `users/${userId}/config.json`;
  const object = await bucket.head(key);
  return object !== null;
}

/**
 * List all memory files for a user
 */
export async function listMemoryFiles(
  bucket: R2Bucket,
  userId: string
): Promise<{ date: string; lastModified: Date }[]> {
  const prefix = `users/${userId}/workspace/memory/`;
  const listed = await bucket.list({ prefix });
  
  return listed.objects
    .filter(obj => obj.key.endsWith('.md'))
    .map(obj => ({
      date: obj.key.replace(prefix, '').replace('.md', ''),
      lastModified: obj.uploaded,
    }))
    .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
}

/**
 * Get user config
 */
export async function getUserConfig(
  bucket: R2Bucket,
  userId: string
): Promise<UserConfig | null> {
  const content = await getFile(bucket, userId, 'config.json');
  if (!content) return null;
  return JSON.parse(content);
}

/**
 * Update user config
 */
export async function updateUserConfig(
  bucket: R2Bucket,
  userId: string,
  updates: Partial<UserConfig>
): Promise<UserConfig> {
  const existing = await getUserConfig(bucket, userId);
  const config: UserConfig = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  
  await bucket.put(
    `users/${userId}/config.json`,
    JSON.stringify(config, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );
  
  return config;
}

// Helper: Update config timestamp
async function updateConfigTimestamp(
  bucket: R2Bucket,
  userId: string
): Promise<void> {
  const config = await getUserConfig(bucket, userId);
  if (config) {
    config.updatedAt = new Date().toISOString();
    await bucket.put(
      `users/${userId}/config.json`,
      JSON.stringify(config, null, 2),
      { httpMetadata: { contentType: 'application/json' } }
    );
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(timezone?: string): string {
  const date = new Date();
  if (timezone) {
    return date.toLocaleDateString('en-CA', { timeZone: timezone });
  }
  return date.toISOString().split('T')[0];
}
