/**
 * Soul Home - Personal AI that knows you
 * 
 * ZeroClaw-style lightweight personal AI.
 * Each user gets their own workspace with SOUL.md + MEMORY.md
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import puppeteer from '@cloudflare/puppeteer';
import { registerProvisionRoutes } from './routes/api-provision';
import { flyApi } from './routes/api-fly';

// ============================================================================
// API KEYS & CONSTANTS - Single source of truth
// ============================================================================
const API_KEYS = {
  KIE_AI: env.KIE_AI_API_KEY || "",
  ELEVENLABS: env.ELEVENLABS_API_KEY || "",
  VERCEL: env.VERCEL_TOKEN || "",
  CLOUDINARY: {
    CLOUD: env.CLOUDINARY_CLOUD_NAME || "",
    KEY: env.CLOUDINARY_API_KEY || "",
    SECRET: env.CLOUDINARY_API_SECRET || ""
  },
  PERPLEXITY: env.PERPLEXITY_API_KEY || ""
} as const;

const COMPUTE_URL = 'https://soulprint-compute-production.up.railway.app';

// ============================================================================
// OPIK TRACING - LLM Observability via REST API
// ============================================================================
const OPIK_API_URL = 'https://www.comet.com/opik/api';
const OPIK_API_KEY = ''; // Set via env.OPIK_API_KEY
const OPIK_WORKSPACE = 'default';
const OPIK_PROJECT = 'soulprint';

interface OpikTrace {
  id: string;
  name: string;
  projectName: string;
  startTime: string;
  endTime?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface OpikSpan {
  id: string;
  traceId: string;
  name: string;
  type: 'llm' | 'tool' | 'general';
  startTime: string;
  endTime?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  model?: string;
  provider?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Generate UUID v7 (required by Opik)
 */
function generateUUIDv7(): string {
  const now = BigInt(Date.now());
  const timeHex = now.toString(16).padStart(12, '0');
  const randBytes = new Uint8Array(10);
  crypto.getRandomValues(randBytes);
  const rand = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return timeHex.slice(0,8) + '-' + timeHex.slice(8,12) + '-7' + rand.slice(0,3) + '-' + 
         ((parseInt(rand.slice(3,4), 16) & 0x3) | 0x8).toString(16) + rand.slice(4,7) + '-' + rand.slice(7,19);
}

/**
 * Create an Opik trace for a conversation
 */
async function createOpikTrace(
  userId: string,
  userMessage: string,
  channel: 'telegram' | 'web'
): Promise<string> {
  const traceId = generateUUIDv7();
  
  try {
    // Use snake_case for Opik API
    const traceData = {
      id: traceId,
      name: `${channel}-chat`,
      project_name: OPIK_PROJECT,
      start_time: new Date().toISOString(),
      input: { 
        user_message: userMessage.slice(0, 1000),
        user_id: userId,
        channel
      },
      tags: [channel, userId.slice(0, 8)],
      metadata: { channel, user_id: userId }
    };

    await fetch(`${OPIK_API_URL}/v1/private/traces/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': OPIK_API_KEY,
        'Comet-Workspace': OPIK_WORKSPACE
      },
      body: JSON.stringify({ traces: [traceData] })
    });
    
    console.log(`[OPIK] Created trace: ${traceId}`);
    return traceId;
  } catch (err: any) {
    console.error('[OPIK] Failed to create trace:', err.message);
    return traceId; // Return ID anyway so we can still use it locally
  }
}

/**
 * Log an LLM span to Opik
 */
async function logOpikLLMSpan(
  traceId: string,
  model: string,
  input: string,
  output: string,
  usage: { inputTokens: number; outputTokens: number },
  durationMs: number
): Promise<void> {
  const spanId = generateUUIDv7();
  
  try {
    // Use snake_case for Opik API
    const spanData = {
      id: spanId,
      trace_id: traceId,
      name: 'llm-call',
      type: 'llm',
      start_time: new Date(Date.now() - durationMs).toISOString(),
      end_time: new Date().toISOString(),
      input: { prompt: input.slice(0, 2000) },
      output: { response: output.slice(0, 2000) },
      model,
      provider: 'aws-bedrock',
      usage: {
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens,
        total_tokens: usage.inputTokens + usage.outputTokens
      },
      metadata: { duration_ms: durationMs }
    };

    await fetch(`${OPIK_API_URL}/v1/private/spans/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': OPIK_API_KEY,
        'Comet-Workspace': OPIK_WORKSPACE
      },
      body: JSON.stringify({ spans: [spanData] })
    });
    
    console.log(`[OPIK] Logged LLM span: ${spanId} (${usage.inputTokens}+${usage.outputTokens} tokens)`);
  } catch (err: any) {
    console.error('[OPIK] Failed to log span:', err.message);
  }
}

/**
 * Log a tool use span to Opik
 */
async function logOpikToolSpan(
  traceId: string,
  toolName: string,
  input: Record<string, any>,
  output: string,
  success: boolean,
  durationMs: number
): Promise<void> {
  const spanId = generateUUIDv7();
  
  try {
    // Use snake_case for Opik API
    const spanData = {
      id: spanId,
      trace_id: traceId,
      name: `tool:${toolName}`,
      type: 'tool',
      start_time: new Date(Date.now() - durationMs).toISOString(),
      end_time: new Date().toISOString(),
      input,
      output: { result: output.slice(0, 2000), success },
      metadata: { tool_name: toolName, success, duration_ms: durationMs }
    };

    await fetch(`${OPIK_API_URL}/v1/private/spans/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': OPIK_API_KEY,
        'Comet-Workspace': OPIK_WORKSPACE
      },
      body: JSON.stringify({ spans: [spanData] })
    });
    
    console.log(`[OPIK] Logged tool span: ${toolName} (${success ? 'success' : 'failed'})`);
  } catch (err: any) {
    console.error('[OPIK] Failed to log tool span:', err.message);
  }
}

/**
 * Complete an Opik trace with final output
 */
async function completeOpikTrace(
  traceId: string,
  output: string,
  error?: string
): Promise<void> {
  try {
    await fetch(`${OPIK_API_URL}/v1/private/traces/batch`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': OPIK_API_KEY,
        'Comet-Workspace': OPIK_WORKSPACE
      },
      body: JSON.stringify({
        traces: [{
          id: traceId,
          end_time: new Date().toISOString(),
          output: error ? { error } : { response: output.slice(0, 2000) }
        }]
      })
    });
    
    console.log(`[OPIK] Completed trace: ${traceId}`);
  } catch (err: any) {
    console.error('[OPIK] Failed to complete trace:', err.message);
  }
}

// ============================================================================
// PASSWORD HASHING - Using PBKDF2 with Web Crypto API
// ============================================================================
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  // Combine salt + hash and encode as base64
  const combined = new Uint8Array(salt.length + hash.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(hash), salt.length);
  return btoa(String.fromCharCode(...combined));
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Check if it's an old btoa() hash (for migration)
    if (storedHash === btoa(password)) {
      return true; // Legacy hash matches
    }
    
    // Decode the stored hash
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHashBytes = combined.slice(16);
    
    // Hash the input password with the same salt
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const hash = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    // Compare
    const hashBytes = new Uint8Array(hash);
    if (hashBytes.length !== storedHashBytes.length) return false;
    for (let i = 0; i < hashBytes.length; i++) {
      if (hashBytes[i] !== storedHashBytes[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// CONVERSATION COMPACTION - ZeroClaw-style context management
// ============================================================================
const COMPACTION_THRESHOLD = 30;  // Trigger compaction when messages exceed this
const KEEP_RECENT = 10;           // Keep this many recent messages intact
const COMPACTION_MAX_CHARS = 4000; // Max chars in compaction summary

interface CompactedHistory {
  summary: string | null;  // Compacted summary of older messages
  messages: any[];         // Recent messages kept intact
}

/**
 * Build a transcript from messages for compaction
 */
function buildCompactionTranscript(messages: any[]): string {
  let transcript = '';
  for (const msg of messages) {
    const role = msg.role.toUpperCase();
    const content = msg.content?.[0]?.text || '';
    transcript += `${role}: ${content.trim()}\n\n`;
  }
  return transcript.slice(0, 8000); // Cap input to summarizer
}

/**
 * Compact conversation history - summarize old messages, keep recent intact
 * Returns: { summary, messages } where messages are the recent ones to send
 */
async function compactConversationHistory(
  history: any[],
  env: any,
  awsAccessKey: string,
  awsSecretKey: string
): Promise<CompactedHistory> {
  // If not enough messages, no compaction needed
  if (history.length <= COMPACTION_THRESHOLD) {
    return { summary: null, messages: history };
  }

  // Split: older messages to compact, recent to keep
  const compactCount = history.length - KEEP_RECENT;
  const toCompact = history.slice(0, compactCount);
  const toKeep = history.slice(compactCount);

  // Build transcript of messages to compact
  const transcript = buildCompactionTranscript(toCompact);

  // Use Haiku for fast, cheap summarization
  const region = 'us-east-1';
  const modelId = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';
  const converseUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;

  const summarizerSystem = `You are a conversation compaction engine. Summarize older chat history into concise context for future turns.
PRESERVE: user preferences, commitments, decisions, unresolved tasks, key facts, names, dates, specific details.
OMIT: filler, repeated greetings, verbose tool outputs, redundant info.
Output ONLY plain text bullet points. Be concise but comprehensive. Max 10-12 bullets.`;

  const summarizerUser = `Summarize this conversation history for context preservation:\n\n${transcript}`;

  try {
    const requestBody = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: summarizerUser }] }],
      system: [{ text: summarizerSystem }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.2 }
    });

    const headers = await signAWSRequest('POST', converseUrl, requestBody, 'bedrock', region, awsAccessKey, awsSecretKey);
    const response = await fetch(converseUrl, { method: 'POST', headers, body: requestBody });

    if (!response.ok) {
      console.error('[COMPACTION] Summarization failed, keeping recent only');
      return { summary: null, messages: toKeep };
    }

    const data = await response.json() as any;
    let summary = data.output?.message?.content?.[0]?.text || '';
    
    // Truncate if too long
    if (summary.length > COMPACTION_MAX_CHARS) {
      summary = summary.slice(0, COMPACTION_MAX_CHARS) + '...';
    }

    console.log(`[COMPACTION] Compacted ${toCompact.length} messages into ${summary.length} char summary`);
    return { summary, messages: toKeep };
  } catch (err: any) {
    console.error('[COMPACTION] Error:', err.message);
    return { summary: null, messages: toKeep };
  }
}

// ============================================================================
// CORE MEMORY - ZeroClaw-style permanent facts (never compacted)
// ============================================================================
interface CoreMemoryEntry {
  id: string;
  fact: string;
  category: 'preference' | 'relationship' | 'decision' | 'milestone' | 'status';
  timestamp: string;
  source: 'extraction' | 'explicit';
}

/**
 * Extract core facts from a conversation using Claude
 * Returns array of new facts to store permanently
 */
async function extractCoreFacts(
  userMessage: string,
  assistantResponse: string,
  existingFacts: CoreMemoryEntry[],
  env: any,
  awsAccessKey: string,
  awsSecretKey: string
): Promise<CoreMemoryEntry[]> {
  const region = 'us-east-1';
  const modelId = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';
  const converseUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;

  const existingFactsList = existingFacts.map(f => `- ${f.fact}`).join('\n') || 'None yet';

  const extractorSystem = `You are a fact extraction engine. Extract DURABLE facts from conversations that should be remembered permanently.

EXTRACT:
- Preferences: "prefers dark mode", "likes coffee", "hates meetings"
- Relationships: "works with Sarah at Acme", "wife is named Lisa"
- Decisions: "decided to use React for the project", "chose premium plan"
- Milestones: "got promoted", "started new job", "launched product"
- Status: "currently working on X", "lives in Austin"

DO NOT EXTRACT:
- Temporary info (weather, today's schedule)
- Conversational filler
- Things already in existing facts
- Uncertain or speculative info

EXISTING FACTS (don't duplicate):
${existingFactsList}

Output JSON array of new facts only. Empty array [] if nothing new.
Format: [{"fact": "string", "category": "preference|relationship|decision|milestone|status"}]`;

  const extractorUser = `USER: ${userMessage.slice(0, 2000)}\n\nASSISTANT: ${assistantResponse.slice(0, 2000)}`;

  try {
    const requestBody = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: extractorUser }] }],
      system: [{ text: extractorSystem }],
      inferenceConfig: { maxTokens: 512, temperature: 0.1 }
    });

    const headers = await signAWSRequest('POST', converseUrl, requestBody, 'bedrock', region, awsAccessKey, awsSecretKey);
    const response = await fetch(converseUrl, { method: 'POST', headers, body: requestBody });

    if (!response.ok) {
      console.error('[FACT_EXTRACTION] Failed');
      return [];
    }

    const data = await response.json() as any;
    const text = data.output?.message?.content?.[0]?.text || '[]';
    
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const parsed = JSON.parse(jsonMatch[0]);
    const timestamp = new Date().toISOString();
    
    return parsed.map((f: any) => ({
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fact: f.fact,
      category: f.category || 'preference',
      timestamp,
      source: 'extraction' as const
    }));
  } catch (err: any) {
    console.error('[FACT_EXTRACTION] Error:', err.message);
    return [];
  }
}

/**
 * Store core memory facts (permanent, never compacted)
 */
async function storeCoreFacts(env: any, userId: string, newFacts: CoreMemoryEntry[]): Promise<void> {
  if (newFacts.length === 0) return;
  
  const key = `core:${userId}`;
  const existingJson = await env.SESSIONS.get(key);
  let existing: CoreMemoryEntry[] = [];
  try {
    existing = existingJson ? JSON.parse(existingJson) : [];
  } catch { existing = []; }
  
  const updated = [...existing, ...newFacts].slice(-100); // Cap at 100 facts
  await env.SESSIONS.put(key, JSON.stringify(updated), {
    expirationTtl: 86400 * 365 // 1 year
  });
  console.log(`[CORE_MEMORY] Stored ${newFacts.length} new facts for user ${userId}. Total: ${updated.length}`);
}

/**
 * Load core memory facts for a user
 */
async function loadCoreFacts(env: any, userId: string): Promise<CoreMemoryEntry[]> {
  const key = `core:${userId}`;
  const json = await env.SESSIONS.get(key);
  try {
    return json ? JSON.parse(json) : [];
  } catch { return []; }
}

/**
 * Format core facts for system prompt injection
 */
function formatCoreFactsForPrompt(facts: CoreMemoryEntry[]): string {
  if (facts.length === 0) return '';
  
  const grouped: Record<string, string[]> = {};
  for (const f of facts) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f.fact);
  }
  
  let output = '## Core Knowledge About This User\n';
  for (const [category, items] of Object.entries(grouped)) {
    output += `\n### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
    for (const item of items) {
      output += `- ${item}\n`;
    }
  }
  return output;
}

// ============================================================================
// VECTOR EMBEDDINGS - Semantic search for relevant memories
// ============================================================================
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Get embedding for text using OpenAI
 */
async function getEmbedding(text: string, openaiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: text.slice(0, 8000) // Truncate to max
      })
    });
    
    if (!response.ok) {
      console.error('[EMBEDDING] Failed:', response.status);
      return null;
    }
    
    const data = await response.json() as any;
    return data.data?.[0]?.embedding || null;
  } catch (err: any) {
    console.error('[EMBEDDING] Error:', err.message);
    return null;
  }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom < 1e-10) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

// ============================================================================
// MEMORY HYGIENE - Auto-cleanup of stale/duplicate memories
// ============================================================================

/**
 * Clean up duplicate or near-duplicate facts
 * Run periodically (e.g., after every 10 conversations)
 */
async function cleanupDuplicateFacts(env: any, userId: string, openaiKey: string): Promise<number> {
  const facts = await loadCoreFacts(env, userId);
  if (facts.length < 10) return 0; // Not enough to worry about
  
  const kept: CoreMemoryEntry[] = [];
  const removed: string[] = [];
  
  // Simple dedup: if fact text is very similar (>90% overlap), keep newer one
  for (const fact of facts) {
    let isDuplicate = false;
    for (const existing of kept) {
      // Simple Jaccard-ish check
      const words1 = new Set(fact.fact.toLowerCase().split(/\s+/));
      const words2 = new Set(existing.fact.toLowerCase().split(/\s+/));
      const intersection = [...words1].filter(w => words2.has(w)).length;
      const union = new Set([...words1, ...words2]).size;
      const similarity = union > 0 ? intersection / union : 0;
      
      if (similarity > 0.8) {
        isDuplicate = true;
        removed.push(fact.fact);
        break;
      }
    }
    if (!isDuplicate) {
      kept.push(fact);
    }
  }
  
  if (removed.length > 0) {
    await env.SESSIONS.put(`core:${userId}`, JSON.stringify(kept), {
      expirationTtl: 86400 * 365
    });
    console.log(`[MEMORY_HYGIENE] Removed ${removed.length} duplicate facts`);
  }
  
  return removed.length;
}

// ============================================================================
// SKILLS SYSTEM - ZeroClaw-style skill loading
// ============================================================================

interface Skill {
  name: string;
  description: string;
  content: string;
  enabled: boolean;
}

// ZeroClaw-style skills with instructions (loaded into system prompt)
const ZEROCLAW_SKILLS: { name: string; description: string; path: string; fallback: string }[] = [
  {
    name: 'design-taste',
    description: 'High-agency frontend design - prevents generic AI slop, enforces premium aesthetics',
    path: 'skills/design-taste/SKILL.md',
    fallback: `# High-Agency Frontend Skill

## ACTIVE BASELINE
* DESIGN_VARIANCE: 8 (1=Symmetric, 10=Artsy Chaos)
* MOTION_INTENSITY: 6 (1=Static, 10=Cinematic)
* VISUAL_DENSITY: 4 (1=Art Gallery, 10=Cockpit)

## BANNED PATTERNS (AI Slop)
- NO Inter font → Use Geist, Satoshi, Outfit
- NO purple/blue AI glow
- NO centered hero sections (use asymmetric)
- NO 3-column card layouts
- NO "John Doe" placeholder names
- NO #000000 pure black → Use Zinc-950
- NO emojis in code

## REQUIRED
- Spring physics on animations
- Liquid glass refraction on blur
- Staggered orchestration on lists
- min-h-[100dvh] not h-screen
- Grid over flexbox math
- Loading/empty/error states`
  },
  {
    name: 'website-builder',
    description: 'Build and deploy professional websites',
    path: 'skills/website-builder/SKILL.md',
    fallback: `# Website Builder

Build and deploy professional websites for users.

## When to Use
- User asks to build a website, landing page, or web app
- User wants to deploy HTML/CSS/JavaScript

## Steps
1. Ask user for purpose, style, and color preferences
2. Generate mobile-first responsive HTML/CSS
3. Preview with user and iterate
4. Deploy to Vercel when approved using deploy_website tool

## Best Practices
- Mobile-first design
- Semantic HTML with accessibility
- Fast loading (minimal JS)
- Modern design (gradients, cards, smooth transitions)
- Clear visual hierarchy`
  },
  {
    name: 'image-generator', 
    description: 'Generate images with AI (Midjourney, Flux, Nano Banana)',
    path: 'skills/image-generator/SKILL.md',
    fallback: `# Image Generator

Generate images using AI models.

## When to Use
- User asks for an image, picture, or visual
- User describes something they want to see

## Models Available
- nano-banana (fast, good quality)
- midjourney (highest quality, slower)
- flux (good for realistic)

## Best Practices
- Ask for style preference if not specified
- Use descriptive prompts (lighting, mood, style)
- Default to 1:1 aspect ratio unless specified
- Use generate_image tool`
  },
  {
    name: 'code-runner',
    description: 'Execute Python, JavaScript, or Bash code',
    path: 'skills/code-runner/SKILL.md',
    fallback: `# Code Runner

Execute code to solve problems or demonstrate concepts.

## When to Use
- User asks to run, execute, or test code
- User needs calculations or data processing
- User wants to see code output

## Languages
- Python (default for data/math)
- JavaScript (web/async)
- Bash (system tasks)

## Best Practices
- Show code before running
- Handle errors gracefully
- Keep code concise
- Use run_code tool`
  }
];

/**
 * Load skills from R2 storage (with fallback to built-in content)
 */
async function loadSkills(env: Env): Promise<Skill[]> {
  const skills: Skill[] = [];
  
  for (const skillDef of ZEROCLAW_SKILLS) {
    try {
      const obj = await env.SOUL_DATA.get(skillDef.path);
      const content = obj ? await obj.text() : skillDef.fallback;
      
      skills.push({
        name: skillDef.name,
        description: skillDef.description,
        content: content,
        enabled: true
      });
    } catch (e) {
      // Use fallback on error
      skills.push({
        name: skillDef.name,
        description: skillDef.description,
        content: skillDef.fallback,
        enabled: true
      });
    }
  }
  
  return skills;
}

/**
 * Format skills for system prompt injection (ZeroClaw XML format)
 */
function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';
  
  let output = '## Available Skills\n\n';
  output += 'These skills provide specialized instructions. Follow them when the task matches.\n\n';
  output += '<available_skills>\n';
  
  for (const skill of skills.filter(s => s.enabled)) {
    output += `  <skill>\n`;
    output += `    <name>${skill.name}</name>\n`;
    output += `    <description>${skill.description}</description>\n`;
    output += `    <instructions>\n${skill.content}\n    </instructions>\n`;
    output += `  </skill>\n`;
  }
  
  output += '</available_skills>\n';
  return output;
}

// Voice ID mappings for ElevenLabs
const VOICE_MAP: Record<string, string> = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',
  'adam': 'pNInz6obpgDQGcFmaJgB',
  'antoni': 'ErXwobaYiN019PkySvjV',
  'josh': 'TxGEqnHWrfWFTfGW9XjX',
  'sam': 'yoZ06aMxZJJ28mfd3POQ',
  'bella': 'EXAVITQu4vr4xnSDxMaL'
};

// ============================================================================
// TOOL DEFINITIONS - Single source of truth
// Both Telegram and Web Chat use this array (converted to their format)
// ============================================================================
interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

const TOOL_DEFINITIONS: ToolDef[] = [
  {
    name: 'web_search',
    description: 'Search the web for current information.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] }
  },
  {
    name: 'run_code',
    description: 'Execute Python, JavaScript, or Bash code.',
    parameters: { type: 'object', properties: { language: { type: 'string', enum: ['python', 'javascript', 'bash'] }, code: { type: 'string' } }, required: ['language', 'code'] }
  },
  {
    name: 'shell_command',
    description: 'Run any shell command.',
    parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] }
  },
  {
    name: 'install_packages',
    description: 'Install Python (pip) or Node.js (npm) packages.',
    parameters: { type: 'object', properties: { packages: { type: 'array', items: { type: 'string' } }, manager: { type: 'string', enum: ['pip', 'npm'] } }, required: ['packages'] }
  },
  {
    name: 'save_file',
    description: 'Save content to a file in user storage.',
    parameters: { type: 'object', properties: { filename: { type: 'string' }, content: { type: 'string' } }, required: ['filename', 'content'] }
  },
  {
    name: 'read_file',
    description: 'Read a file from user storage.',
    parameters: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] }
  },
  {
    name: 'list_files',
    description: 'List all files in user storage.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'delete_file',
    description: 'Delete a file from user storage.',
    parameters: { type: 'object', properties: { filename: { type: 'string' } }, required: ['filename'] }
  },
  {
    name: 'update_memory',
    description: 'Save important information to long-term memory. (Legacy - prefer save_fact for V2)',
    parameters: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] }
  },
  // V2 Memory Tools - Append-only structured memory
  {
    name: 'save_fact',
    description: 'Save a core fact about the user to permanent memory. Use for: preferences, personal info, work details, relationships. Facts are append-only and never lost.',
    parameters: { type: 'object', properties: { 
      fact: { type: 'string', description: 'The fact to remember' },
      category: { type: 'string', enum: ['personal', 'work', 'preference', 'relationship', 'general'], description: 'Category of the fact' }
    }, required: ['fact'] }
  },
  {
    name: 'log_experience',
    description: 'Log a significant experience or moment. Use for: achievements, milestones, memorable events. Include emotional weight (1-10).',
    parameters: { type: 'object', properties: { 
      event: { type: 'string', description: 'What happened' },
      weight: { type: 'number', description: 'Emotional significance 1-10' },
      emotion: { type: 'string', description: 'Primary emotion (excited, proud, frustrated, etc.)' }
    }, required: ['event', 'weight'] }
  },
  {
    name: 'log_decision',
    description: 'Log an important decision with reasoning. Use for: career choices, project decisions, strategy changes. Helps the AI learn how the user thinks.',
    parameters: { type: 'object', properties: { 
      decision: { type: 'string', description: 'The decision made' },
      reasoning: { type: 'string', description: 'Why this decision was made' },
      alternatives: { type: 'array', items: { type: 'string' }, description: 'Other options considered' }
    }, required: ['decision', 'reasoning'] }
  },
  {
    name: 'recall_memory',
    description: 'Search through saved memories (facts, experiences, decisions). Use when user asks about something you should remember.',
    parameters: { type: 'object', properties: { 
      query: { type: 'string', description: 'What to search for' },
      type: { type: 'string', enum: ['facts', 'experiences', 'decisions', 'all'], description: 'Type of memory to search' }
    }, required: ['query'] }
  },
  {
    name: 'get_weather',
    description: 'Get current weather for a location.',
    parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] }
  },
  {
    name: 'browse_website',
    description: 'Browse a website with Puppeteer - screenshots, extract text, click, type. WARNING: Slow and heavy. For YouTube videos or article summaries, use analyze_url instead.',
    parameters: { type: 'object', properties: { url: { type: 'string' }, action: { type: 'string', enum: ['screenshot', 'extract_text', 'click', 'type', 'navigate'] }, selector: { type: 'string' }, text: { type: 'string' } }, required: ['url', 'action'] }
  },
  {
    name: 'analyze_url',
    description: 'ALWAYS use this for YouTube videos and articles. Uses Perplexity AI to get video transcripts, summaries, and key points. Much faster and more reliable than browse_website for content analysis. DO NOT use browse_website for YouTube - use this instead.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL to analyze (YouTube, article, etc)' }, question: { type: 'string', description: 'Specific question about the content (optional)' } }, required: ['url'] }
  },
  {
    name: 'generate_image',
    description: 'Generate an AI image from a text prompt.',
    parameters: { type: 'object', properties: { prompt: { type: 'string' }, model: { type: 'string', enum: ['nano-banana', 'midjourney'] }, aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:3'] } }, required: ['prompt'] }
  },
  {
    name: 'generate_video',
    description: 'Generate an AI video from a text prompt. No text in videos.',
    parameters: { type: 'object', properties: { prompt: { type: 'string' }, model: { type: 'string', enum: ['veo3_fast', 'veo3', 'runway'] }, aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'] } }, required: ['prompt'] }
  },
  {
    name: 'text_to_speech',
    description: 'Convert text to speech audio using ElevenLabs.',
    parameters: { type: 'object', properties: { text: { type: 'string' }, voice: { type: 'string' } }, required: ['text'] }
  },
  {
    name: 'analyze_image',
    description: 'Analyze an image using AI vision.',
    parameters: { type: 'object', properties: { image_url: { type: 'string' } }, required: ['image_url'] }
  },
  {
    name: 'deploy_website',
    description: 'Deploy a website to Vercel and get a live URL.',
    parameters: { type: 'object', properties: { name: { type: 'string' }, files: { type: 'array' } }, required: ['name', 'files'] }
  },
  {
    name: 'send_email',
    description: 'Send an email.',
    parameters: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] }
  },
  // Google Stitch - AI UI Design (stitch.withgoogle.com)
  // IMPORTANT: When user asks for "Google Stitch" or "Stitch designs", use these tools - DO NOT web search!
  {
    name: 'stitch_create_project',
    description: '[GOOGLE STITCH] Create a new Google Stitch design project. Use this when user wants to use Google Stitch for UI/design generation. Always create a project first before generating designs.',
    parameters: { type: 'object', properties: { title: { type: 'string', description: 'Project title' } }, required: [] }
  },
  {
    name: 'stitch_list_projects',
    description: '[GOOGLE STITCH] List all Google Stitch design projects for the user.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'stitch_generate_ui',
    description: '[GOOGLE STITCH] Generate a UI screen design using Google Stitch AI (stitch.withgoogle.com). Use this when user asks for "Google Stitch designs" or "Stitch UI". Returns HTML code for the design. Requires a project_id - create one first with stitch_create_project if needed.',
    parameters: { type: 'object', properties: { project_id: { type: 'string', description: 'Project ID (create one first with stitch_create_project if needed)' }, prompt: { type: 'string', description: 'Describe the UI you want to create' }, device_type: { type: 'string', enum: ['MOBILE', 'DESKTOP', 'TABLET'], description: 'Device type for the design (default: MOBILE)' } }, required: ['project_id', 'prompt'] }
  },
  {
    name: 'stitch_get_screen_code',
    description: '[GOOGLE STITCH] Get the HTML/code for a generated Stitch screen design.',
    parameters: { type: 'object', properties: { project_id: { type: 'string' }, screen_id: { type: 'string' } }, required: ['project_id', 'screen_id'] }
  },
  {
    name: 'stitch_list_screens',
    description: '[GOOGLE STITCH] List all screen designs in a Google Stitch project.',
    parameters: { type: 'object', properties: { project_id: { type: 'string' } }, required: ['project_id'] }
  }
];

// Convert to Bedrock format (for web chat)
const TOOLS_BEDROCK = TOOL_DEFINITIONS.map(t => ({
  toolSpec: {
    name: t.name,
    description: t.description,
    inputSchema: { json: t.parameters }
  }
}));

// Convert to Anthropic format (for Telegram)
const TOOLS_ANTHROPIC = TOOL_DEFINITIONS.map(t => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters
}));

// ============================================================================
// TYPES
// ============================================================================
type Env = {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string; // For Whisper voice transcription
  AWS_ACCESS_KEY_ID?: string; // For Bedrock, Rekognition, SES
  AWS_SECRET_ACCESS_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string;
  STITCH_API_KEY?: string; // For Google Stitch AI UI design
  FLY_API_TOKEN?: string; // For Fly.io per-user container provisioning
  SESSIONS: KVNamespace;
  SOUL_DATA: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT?: string;
  BROWSER?: any; // Cloudflare Browser Rendering
};

// Available models - ALL via AWS Bedrock inference profiles
const MODELS = {
  'claude-sonnet-4.6': {
    id: 'global.anthropic.claude-sonnet-4-6',
    provider: 'bedrock',
    name: 'Claude Sonnet 4.6'
  },
  'claude-sonnet-4.5': {
    id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    provider: 'bedrock',
    name: 'Claude Sonnet 4.5'
  },
  'claude-sonnet-4': {
    id: 'global.anthropic.claude-sonnet-4-20250514-v1:0',
    provider: 'bedrock',
    name: 'Claude Sonnet 4'
  },
  'claude-opus-4.6': {
    id: 'global.anthropic.claude-opus-4-6-v1',
    provider: 'bedrock',
    name: 'Claude Opus 4.6'
  },
  'claude-opus-4.5': {
    id: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
    provider: 'bedrock',
    name: 'Claude Opus 4.5'
  },
  'claude-haiku-4.5': {
    id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
    provider: 'bedrock',
    name: 'Claude Haiku 4.5 (Fast)'
  }
} as const;

type ModelKey = keyof typeof MODELS;

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// Tool definitions for Bedrock

// ============================================================================
// AUDIT LOGGING - Track all tool executions
// ============================================================================
interface AuditEvent {
  timestamp: string;
  eventId: string;
  userId: string;
  toolName: string;
  toolInput: Record<string, any>;
  channel: 'web' | 'telegram' | 'api';
  result: {
    success: boolean;
    summary: string;
    durationMs: number;
  };
}

// Redact sensitive fields from tool input for logging
function redactSensitiveInput(input: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'api_key', 'apiKey', 'credential'];
  const redacted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(input)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 500) {
      redacted[key] = value.substring(0, 500) + '...[truncated]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// Store audit log entry to R2
async function logAuditEvent(env: Env, event: AuditEvent): Promise<void> {
  try {
    const date = event.timestamp.split('T')[0]; // YYYY-MM-DD
    const key = `audit/${event.userId}/${date}.jsonl`;
    
    // Get existing log file or create new
    const existing = await env.SOUL_DATA.get(key);
    const existingText = existing ? await existing.text() : '';
    
    // Append new event as JSONL
    const newLine = JSON.stringify(event) + '\n';
    await env.SOUL_DATA.put(key, existingText + newLine);
    
    console.log(`[AUDIT] Logged: ${event.toolName} for user ${event.userId}`);
  } catch (err) {
    console.error('[AUDIT] Failed to log:', err);
    // Don't throw - audit logging should never break the main flow
  }
}

// Wrapper that executes tool AND logs audit event
async function executeToolWithAudit(
  toolName: string,
  toolInput: Record<string, any>,
  env: Env,
  userId: string,
  channel: 'web' | 'telegram' | 'api' = 'web'
): Promise<string> {
  const startTime = Date.now();
  let success = true;
  let result: string;
  
  try {
    result = await executeTool(toolName, toolInput, env, userId);
    // Check if result indicates an error
    if (result.startsWith('Error:') || result.startsWith('Tool error:') || result.includes('failed')) {
      success = false;
    }
  } catch (error) {
    success = false;
    result = `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
  
  // Audit logging - fire and forget
  const durationMs = Date.now() - startTime;
  logAuditEvent(env, {
    timestamp: new Date().toISOString(),
    eventId: `evt_${crypto.randomUUID().substring(0, 8)}`,
    userId,
    toolName,
    toolInput: redactSensitiveInput(toolInput),
    channel,
    result: {
      success,
      summary: result.substring(0, 200) + (result.length > 200 ? '...' : ''),
      durationMs
    }
  }).catch(() => {}); // Swallow errors
  
  return result;
}

// Tool execution function (internal - use executeToolWithAudit for audited calls)
async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  env: Env,
  userId: string
): Promise<string> {
  console.log(`[TOOL] Executing ${toolName}:`, toolInput);
  
  try {
    switch (toolName) {
      case 'web_search': {
        // Use a simple search API
        const query = encodeURIComponent(toolInput.query);
        const res = await fetch(`https://api.duckduckgo.com/?q=${query}&format=json&no_html=1`);
        const data = await res.json() as any;
        const results = data.RelatedTopics?.slice(0, 5).map((t: any) => t.Text).filter(Boolean).join('\n\n') || 'No results found';
        return `Search results for "${toolInput.query}":\n\n${results}`;
      }
      
      case 'run_code': {
        // Use Railway compute service v2
        const computeUrl = `${COMPUTE_URL}/execute`;
        const res = await fetch(computeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: toolInput.language,
            code: toolInput.code,
            userId
          })
        });
        const result = await res.json() as any;
        if (result.error) return `Error: ${result.error}`;
        return `Output:\n${result.output || '(no output)'}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`;
      }
      
      case 'shell_command': {
        // Full shell access via Railway
        const computeUrl = `${COMPUTE_URL}/shell`;
        const res = await fetch(computeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: toolInput.command,
            userId,
            cwd: toolInput.cwd
          })
        });
        const result = await res.json() as any;
        if (result.error) return `Error: ${result.error}`;
        return `${result.output || ''}${result.stderr ? `\nStderr: ${result.stderr}` : ''}`;
      }
      
      case 'install_packages': {
        // Install packages via Railway
        const computeUrl = `${COMPUTE_URL}/install`;
        const res = await fetch(computeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packages: toolInput.packages,
            manager: toolInput.manager || 'pip',
            userId
          })
        });
        const result = await res.json() as any;
        if (result.error) return `Error: ${result.error}`;
        return `Installed: ${toolInput.packages.join(', ')}`;
      }
      
      case 'save_file': {
        const key = `users/${userId}/files/${toolInput.filename}`;
        await env.SOUL_DATA.put(key, toolInput.content);
        return `Saved file: ${toolInput.filename}`;
      }
      
      case 'read_file': {
        const key = `users/${userId}/files/${toolInput.filename}`;
        const obj = await env.SOUL_DATA.get(key);
        if (!obj) return `File not found: ${toolInput.filename}`;
        return await obj.text();
      }
      
      case 'update_memory': {
        // Legacy V1 - also save to V2 if available
        const currentMemory = await getUserMemory(env, userId);
        const timestamp = new Date().toISOString().split('T')[0];
        const newMemory = currentMemory + `\n- ${toolInput.fact} (${timestamp})`;
        await saveUserMemory(env, userId, newMemory);
        // Also save to V2 facts.jsonl if V2 workspace exists
        if (await hasV2Workspace(env, userId)) {
          await appendFact(env, userId, toolInput.fact, 'general');
        }
        return `Saved to memory: ${toolInput.fact}`;
      }
      
      // V2 Memory Tools
      case 'save_fact': {
        const hasV2 = await hasV2Workspace(env, userId);
        if (!hasV2) {
          // Fall back to V1 memory
          const currentMemory = await getUserMemory(env, userId);
          const timestamp = new Date().toISOString().split('T')[0];
          const newMemory = currentMemory + `\n- ${toolInput.fact} (${timestamp})`;
          await saveUserMemory(env, userId, newMemory);
          return `Saved fact: ${toolInput.fact}`;
        }
        await appendFact(env, userId, toolInput.fact, toolInput.category || 'general');
        return `✓ Fact saved: ${toolInput.fact}`;
      }
      
      case 'log_experience': {
        const hasV2 = await hasV2Workspace(env, userId);
        if (!hasV2) {
          // Fall back to V1 memory
          const currentMemory = await getUserMemory(env, userId);
          const timestamp = new Date().toISOString().split('T')[0];
          const newMemory = currentMemory + `\n- Experience: ${toolInput.event} (${timestamp})`;
          await saveUserMemory(env, userId, newMemory);
          return `Logged experience: ${toolInput.event}`;
        }
        await appendExperience(env, userId, toolInput.event, toolInput.weight, toolInput.emotion);
        return `✓ Experience logged (weight ${toolInput.weight}/10): ${toolInput.event}`;
      }
      
      case 'log_decision': {
        const hasV2 = await hasV2Workspace(env, userId);
        if (!hasV2) {
          // Fall back to V1 memory
          const currentMemory = await getUserMemory(env, userId);
          const timestamp = new Date().toISOString().split('T')[0];
          const newMemory = currentMemory + `\n- Decision: ${toolInput.decision} - Reasoning: ${toolInput.reasoning} (${timestamp})`;
          await saveUserMemory(env, userId, newMemory);
          return `Logged decision: ${toolInput.decision}`;
        }
        await appendDecision(env, userId, toolInput.decision, toolInput.reasoning, toolInput.alternatives);
        return `✓ Decision logged: ${toolInput.decision}`;
      }
      
      case 'recall_memory': {
        const hasV2 = await hasV2Workspace(env, userId);
        const query = toolInput.query.toLowerCase();
        const searchType = toolInput.type || 'all';
        
        let results: string[] = [];
        
        if (hasV2) {
          // Search V2 JSONL files
          if (searchType === 'all' || searchType === 'facts') {
            const facts = await loadWorkspaceFile(env, userId, 'memory/facts.jsonl');
            const factLines = facts.split('\n').filter(l => l.trim() && !l.includes('_schema'));
            for (const line of factLines) {
              try {
                const fact = JSON.parse(line);
                if (fact.fact?.toLowerCase().includes(query) && fact.status !== 'archived') {
                  results.push(`[Fact] ${fact.fact}`);
                }
              } catch {}
            }
          }
          
          if (searchType === 'all' || searchType === 'experiences') {
            const experiences = await loadWorkspaceFile(env, userId, 'memory/experiences.jsonl');
            const expLines = experiences.split('\n').filter(l => l.trim() && !l.includes('_schema'));
            for (const line of expLines) {
              try {
                const exp = JSON.parse(line);
                if (exp.event?.toLowerCase().includes(query)) {
                  results.push(`[Experience ${exp.date}] ${exp.event} (${exp.emotion || 'neutral'}, weight ${exp.weight}/10)`);
                }
              } catch {}
            }
          }
          
          if (searchType === 'all' || searchType === 'decisions') {
            const decisions = await loadWorkspaceFile(env, userId, 'memory/decisions.jsonl');
            const decLines = decisions.split('\n').filter(l => l.trim() && !l.includes('_schema'));
            for (const line of decLines) {
              try {
                const dec = JSON.parse(line);
                if (dec.decision?.toLowerCase().includes(query) || dec.reasoning?.toLowerCase().includes(query)) {
                  results.push(`[Decision ${dec.date}] ${dec.decision} — ${dec.reasoning}`);
                }
              } catch {}
            }
          }
        } else {
          // Search V1 memory
          const memory = await getUserMemory(env, userId);
          const lines = memory.split('\n').filter(l => l.toLowerCase().includes(query));
          results = lines.slice(0, 10).map(l => l.trim());
        }
        
        if (results.length === 0) {
          return `No memories found matching "${toolInput.query}"`;
        }
        return `Found ${results.length} memories:\n${results.slice(0, 10).join('\n')}`;
      }
      
      case 'get_weather': {
        const loc = encodeURIComponent(toolInput.location);
        const res = await fetch(`https://wttr.in/${loc}?format=j1`);
        const data = await res.json() as any;
        const current = data.current_condition?.[0];
        if (!current) return `Could not get weather for ${toolInput.location}`;
        return `Weather in ${toolInput.location}: ${current.temp_F}°F, ${current.weatherDesc?.[0]?.value || 'Unknown'}`;
      }
      
      case 'browse_website': {
        // Browser capability using Cloudflare Puppeteer
        if (!env.BROWSER) {
          return 'Error: Browser not available';
        }
        let browser;
        try {
          browser = await puppeteer.launch(env.BROWSER);
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 720 });
          await page.goto(toolInput.url, { waitUntil: 'networkidle0', timeout: 30000 });
          
          let result = '';
          switch (toolInput.action) {
            case 'screenshot':
              const screenshot = await page.screenshot({ encoding: 'base64' });
              result = 'Screenshot captured (base64 data available)';
              break;
            case 'extract_text':
              result = await page.evaluate(() => document.body.innerText);
              result = result.substring(0, 3000);
              break;
            case 'click':
              if (!toolInput.selector) return 'Error: selector required';
              await page.click(toolInput.selector);
              result = `Clicked ${toolInput.selector}`;
              break;
            case 'type':
              if (!toolInput.selector || !toolInput.text) return 'Error: selector and text required';
              await page.type(toolInput.selector, toolInput.text);
              result = `Typed into ${toolInput.selector}`;
              break;
            case 'navigate':
              result = `Navigated to ${toolInput.url}. Title: ${await page.title()}`;
              break;
            default:
              result = `Unknown action: ${toolInput.action}`;
          }
          await browser.close();
          return result;
        } catch (err: any) {
          if (browser) await browser.close().catch(() => {});
          return `Browser error: ${err.message}`;
        }
      }
      
      case 'analyze_url': {
        // Use Perplexity to analyze URLs (YouTube, articles, etc)
        const url = toolInput.url;
        const question = toolInput.question || `Analyze this content. If it's a YouTube video, provide: 1) Video title and creator, 2) Key points/summary, 3) Main takeaways. If it's an article, summarize the main points.`;
        
        try {
          const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_KEYS.PERPLEXITY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [
                { role: 'user', content: `${question}\n\nURL: ${url}` }
              ]
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            return `Perplexity error: ${response.status} - ${errorText}`;
          }
          
          const data = await response.json() as any;
          const answer = data.choices?.[0]?.message?.content;
          
          if (!answer) {
            return `Could not analyze URL: ${url}`;
          }
          
          return answer;
        } catch (err: any) {
          return `Error analyzing URL: ${err.message}`;
        }
      }
      
      case 'generate_image': {
        const model = toolInput.model || 'nano-banana';
        const aspectRatio = toolInput.aspect_ratio || '1:1';
        const prompt = toolInput.prompt;
        
        let taskId: string;
        let checkUrl: string;
        
        if (model === 'midjourney') {
          const response = await fetch('https://api.kie.ai/api/v1/mj/imagine', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEYS.KIE_AI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: `${prompt} --ar ${aspectRatio} --v 7`, speed: 'fast' })
          });
          const data = await response.json() as any;
          taskId = data.data?.taskId || data.taskId;
          checkUrl = `https://api.kie.ai/api/v1/mj/record-info?taskId=${taskId}`;
        } else {
          const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEYS.KIE_AI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'google/nano-banana', input: { prompt, output_format: 'png', image_size: aspectRatio } })
          });
          const data = await response.json() as any;
          taskId = data.data?.taskId;
          checkUrl = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
        }
        
        if (!taskId) return 'Error: Failed to start image generation';
        
        // Poll for completion
        for (let i = 0; i < 24; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const statusRes = await fetch(checkUrl, { headers: { 'Authorization': `Bearer ${API_KEYS.KIE_AI}` } });
          const status = await statusRes.json() as any;
          const state = status.data?.state || status.state;
          
          if (state === 'success') {
            let imageUrl: string;
            if (model === 'midjourney') {
              imageUrl = status.data?.resultUrls?.[0] || status.resultUrls?.[0];
            } else {
              const resultJson = typeof status.data?.resultJson === 'string' ? JSON.parse(status.data.resultJson) : status.data?.resultJson;
              imageUrl = resultJson?.resultUrls?.[0];
            }
            if (imageUrl) {
              // Upload to Cloudinary
              const timestamp = Math.floor(Date.now() / 1000);
              const signature = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`timestamp=${timestamp}${API_KEYS.CLOUDINARY.SECRET}`));
              const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
              
              const formData = new FormData();
              formData.append('file', imageUrl);
              formData.append('timestamp', timestamp.toString());
              formData.append('api_key', API_KEYS.CLOUDINARY.KEY);
              formData.append('signature', sigHex);
              
              const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${API_KEYS.CLOUDINARY.CLOUD}/image/upload`, { method: 'POST', body: formData });
              const cloudData = await cloudRes.json() as any;
              return cloudData.secure_url || imageUrl;
            }
          } else if (state === 'failed') {
            return `Error: Image generation failed`;
          }
        }
        return 'Error: Image generation timed out';
      }
      
      case 'generate_video': {
        const model = toolInput.model || 'veo3_fast';
        const aspectRatio = toolInput.aspect_ratio || '16:9';
        const prompt = toolInput.prompt;
        
        let taskId: string;
        let checkUrl: string;
        
        if (model === 'runway') {
          const response = await fetch('https://api.kie.ai/api/v1/runway/generate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEYS.KIE_AI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, duration: 5, ratio: aspectRatio })
          });
          const data = await response.json() as any;
          taskId = data.data?.taskId;
          checkUrl = `https://api.kie.ai/api/v1/runway/record-info?taskId=${taskId}`;
        } else {
          const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${API_KEYS.KIE_AI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model === 'veo3' ? 'veo3' : 'veo3_fast', prompt, aspectRatio })
          });
          const data = await response.json() as any;
          taskId = data.data?.taskId;
          checkUrl = `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`;
        }
        
        if (!taskId) return 'Error: Failed to start video generation';
        
        // Poll for completion (max 5 minutes)
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const statusRes = await fetch(checkUrl, { headers: { 'Authorization': `Bearer ${API_KEYS.KIE_AI}` } });
          const status = await statusRes.json() as any;
          const state = status.data?.state || status.state;
          
          if (state === 'success') {
            const videoUrl = status.data?.resultUrls?.[0] || status.data?.videoUrl;
            if (videoUrl) {
              // Upload to Cloudinary
              const timestamp = Math.floor(Date.now() / 1000);
              const signature = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`timestamp=${timestamp}${API_KEYS.CLOUDINARY.SECRET}`));
              const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
              
              const formData = new FormData();
              formData.append('file', videoUrl);
              formData.append('timestamp', timestamp.toString());
              formData.append('api_key', API_KEYS.CLOUDINARY.KEY);
              formData.append('signature', sigHex);
              formData.append('resource_type', 'video');
              
              const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${API_KEYS.CLOUDINARY.CLOUD}/video/upload`, { method: 'POST', body: formData });
              const cloudData = await cloudRes.json() as any;
              return cloudData.secure_url || videoUrl;
            }
          } else if (state === 'failed') {
            return `Error: Video generation failed`;
          }
        }
        return 'Error: Video generation timed out';
      }
      
      case 'text_to_speech': {
        const text = toolInput.text;
        const voice = toolInput.voice || 'Rachel';
        const voiceId = VOICE_MAP[voice.toLowerCase()] || voice;
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': API_KEYS.ELEVENLABS,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        });
        
        if (!response.ok) {
          return `Error: TTS failed - ${response.statusText}`;
        }
        
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
        
        // Upload to Cloudinary
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`timestamp=${timestamp}${API_KEYS.CLOUDINARY.SECRET}`));
        const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        const formData = new FormData();
        formData.append('file', `data:audio/mpeg;base64,${base64Audio}`);
        formData.append('timestamp', timestamp.toString());
        formData.append('api_key', API_KEYS.CLOUDINARY.KEY);
        formData.append('signature', sigHex);
        formData.append('resource_type', 'video'); // Cloudinary uses 'video' for audio
        
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${API_KEYS.CLOUDINARY.CLOUD}/video/upload`, { method: 'POST', body: formData });
        const cloudData = await cloudRes.json() as any;
        
        return cloudData.secure_url || 'Error: Failed to upload audio';
      }
      
      case 'analyze_image': {
        const imageUrl = toolInput.image_url;
        try {
          const result = await analyzeImage(imageUrl, env);
          return result;
        } catch (e) {
          return `Failed to analyze image: ${e}`;
        }
      }
      
      case 'deploy_website': {
        const projectName = toolInput.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const files = toolInput.files || [];
        
        // Create file structure for Vercel
        const vercelFiles: Record<string, string> = {};
        for (const file of files) {
          vercelFiles[file.path] = file.content;
        }
        
        // Deploy to Vercel
        const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEYS.VERCEL}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: projectName,
            files: Object.entries(vercelFiles).map(([path, content]) => ({
              file: path,
              data: btoa(unescape(encodeURIComponent(content)))
            })),
            projectSettings: { framework: null }
          })
        });
        
        const deployData = await deployRes.json() as any;
        if (deployData.error) {
          return `Deploy error: ${deployData.error.message}`;
        }
        return `https://${deployData.url}`;
      }
      
      case 'list_files': {
        const prefix = `users/${userId}/files/`;
        const listed = await env.SOUL_DATA.list({ prefix, limit: 100 });
        const files = listed.objects.map((obj: any) => obj.key.replace(prefix, ''));
        return files.length > 0 ? `Files:\n${files.join('\n')}` : 'No files saved yet.';
      }
      
      case 'delete_file': {
        const key = `users/${userId}/files/${toolInput.filename}`;
        await env.SOUL_DATA.delete(key);
        return `🗑️ Deleted: ${toolInput.filename}`;
      }
      
      case 'send_email': {
        // Use AWS SES
        const region = 'us-east-1';
        const sesUrl = `https://email.${region}.amazonaws.com/`;
        
        const params = new URLSearchParams({
          'Action': 'SendEmail',
          'Source': 'noreply@soulprintengine.ai',
          'Destination.ToAddresses.member.1': toolInput.to,
          'Message.Subject.Data': toolInput.subject,
          'Message.Body.Text.Data': toolInput.body,
          'Version': '2010-12-01'
        });
        
        const headers = await signAWSRequest(
          'POST', sesUrl, params.toString(), 'ses', region,
          env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!
        );
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
        
        const res = await fetch(sesUrl, { method: 'POST', headers, body: params.toString() });
        if (res.ok) {
          return `✅ Email sent to ${toolInput.to}`;
        } else {
          const err = await res.text();
          return `Failed to send email: ${err}`;
        }
      }
      
      // Google Stitch - AI UI Design tools
      case 'stitch_create_project': {
        const stitchApiKey = env.STITCH_API_KEY;
        if (!stitchApiKey) return 'Error: Stitch API key not configured';
        const res = await fetch('https://stitch.withgoogle.com/api/v1/projects', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${stitchApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: toolInput.title || 'Untitled Project' })
        });
        const data = await res.json() as any;
        if (!res.ok) return `Error: ${data.error?.message || 'Failed to create project'}`;
        const projectId = data.name?.replace('projects/', '');
        return `Created Stitch project: ${data.title || 'Untitled'}\nProject ID: ${projectId}`;
      }
      
      case 'stitch_list_projects': {
        const stitchApiKey = env.STITCH_API_KEY;
        if (!stitchApiKey) return 'Error: Stitch API key not configured';
        const res = await fetch('https://stitch.withgoogle.com/api/v1/projects', {
          headers: { 'Authorization': `Bearer ${stitchApiKey}` }
        });
        const data = await res.json() as any;
        if (!res.ok) return `Error: ${data.error?.message || 'Failed to list projects'}`;
        const projects = data.projects || [];
        if (projects.length === 0) return 'No projects found. Create one with stitch_create_project.';
        return projects.map((p: any) => `- ${p.title || 'Untitled'} (ID: ${p.name?.replace('projects/', '')})`).join('\n');
      }
      
      case 'stitch_generate_ui': {
        const stitchApiKey = env.STITCH_API_KEY;
        if (!stitchApiKey) return 'Error: Stitch API key not configured';
        const projectId = toolInput.project_id;
        const prompt = toolInput.prompt;
        const deviceType = toolInput.device_type || 'DESKTOP';
        
        const res = await fetch(`https://stitch.withgoogle.com/api/v1/projects/${projectId}/screens:generateFromText`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${stitchApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, deviceType })
        });
        const data = await res.json() as any;
        if (!res.ok) return `Error: ${data.error?.message || 'Failed to generate UI'}`;
        
        const screens = data.outputComponents?.flatMap((c: any) => c.design?.screens || []) || [];
        if (screens.length === 0) return 'No screens generated. Try a different prompt.';
        
        // Collect screen info with preview URLs
        const screenResults = [];
        for (const s of screens) {
          const screenId = s.name?.split('/').pop();
          let previewUrl = '';
          
          // Get screenshot URL if available (FIFE URL needs size params)
          if (s.screenshot?.downloadUrl) {
            previewUrl = s.screenshot.downloadUrl + '=w800';
          }
          
          screenResults.push({
            title: s.title || 'Untitled',
            id: screenId,
            width: s.width,
            height: s.height,
            previewUrl
          });
        }
        
        // Build response with image markdown for web chat
        const screenInfo = screenResults.map(s => {
          let info = `**${s.title}**\nID: ${s.id} | Size: ${s.width}x${s.height}`;
          if (s.previewUrl) {
            info += `\n![Preview](${s.previewUrl})`;
          }
          return info;
        }).join('\n\n');
        
        return `✨ Generated ${screens.length} screen(s):\n\n${screenInfo}\n\n💡 Say "get the code" or "deploy it" to continue.`;
      }
      
      case 'stitch_get_screen_code': {
        const stitchApiKey = env.STITCH_API_KEY;
        if (!stitchApiKey) return 'Error: Stitch API key not configured';
        const projectId = toolInput.project_id;
        const screenId = toolInput.screen_id;
        
        const res = await fetch(`https://stitch.withgoogle.com/api/v1/projects/${projectId}/screens/${screenId}`, {
          headers: { 'Authorization': `Bearer ${stitchApiKey}` }
        });
        const data = await res.json() as any;
        if (!res.ok) return `Error: ${data.error?.message || 'Failed to get screen'}`;
        
        // Try to get HTML code
        if (data.htmlCode?.downloadUrl) {
          const htmlRes = await fetch(data.htmlCode.downloadUrl);
          if (htmlRes.ok) {
            const html = await htmlRes.text();
            return `HTML Code:\n\`\`\`html\n${html.substring(0, 10000)}\n\`\`\``;
          }
        }
        return `Screen: ${data.title || 'Untitled'}\nNo HTML code available yet.`;
      }
      
      case 'stitch_list_screens': {
        const stitchApiKey = env.STITCH_API_KEY;
        if (!stitchApiKey) return 'Error: Stitch API key not configured';
        const projectId = toolInput.project_id;
        
        const res = await fetch(`https://stitch.withgoogle.com/api/v1/projects/${projectId}/screens`, {
          headers: { 'Authorization': `Bearer ${stitchApiKey}` }
        });
        const data = await res.json() as any;
        if (!res.ok) return `Error: ${data.error?.message || 'Failed to list screens'}`;
        
        const screens = data.screens || [];
        if (screens.length === 0) return 'No screens in this project. Generate one with stitch_generate_ui.';
        return screens.map((s: any) => `- ${s.title || 'Untitled'} (ID: ${s.name?.split('/').pop()})`).join('\n');
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error) {
    console.error(`[TOOL] Error executing ${toolName}:`, error);
    return `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// AWS Signature V4 signing helper
async function signAWSRequest(
  method: string,
  url: string,
  body: string,
  service: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<Headers> {
  const encoder = new TextEncoder();
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  // AWS SigV4 requires URI-encoded path components
  // pathname gives decoded path, we need to re-encode for canonical request
  const pathSegments = parsedUrl.pathname.split('/');
  const encodedPath = pathSegments.map(seg => encodeURIComponent(seg)).join('/');
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  // Create canonical request
  const payloadHash = await crypto.subtle.digest('SHA-256', encoder.encode(body));
  const payloadHashHex = Array.from(new Uint8Array(payloadHash)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  
  const canonicalRequest = `${method}\n${encodedPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHashHex}`;
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest));
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash)).map(b => b.toString(16).padStart(2, '0')).join('');
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHashHex}`;
  
  // Calculate signature
  async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }
  
  const kDate = await hmacSha256(encoder.encode('AWS4' + secretAccessKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
  
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('X-Amz-Date', amzDate);
  headers.set('Authorization', authHeader);
  
  return headers;
}

// Call AWS Bedrock
async function callBedrock(
  modelId: string,
  messages: any[],
  system: string,
  env: Env
): Promise<{ content: string; stop_reason: string }> {
  const region = 'us-east-1';
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;
  
  const body = JSON.stringify({
    modelId: modelId,
    messages: messages.map(m => ({
      role: m.role,
      content: [{ text: m.content }]
    })),
    system: [{ text: system }],
    inferenceConfig: {
      maxTokens: 2048,
      temperature: 0.7
    }
  });
  
  const headers = await signAWSRequest(
    'POST',
    url,
    body,
    'bedrock',
    region,
    env.AWS_ACCESS_KEY_ID!,
    env.AWS_SECRET_ACCESS_KEY!
  );
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[BEDROCK] Error:', response.status, errorText);
    throw new Error(`Bedrock error: ${response.status}`);
  }
  
  const data = await response.json() as any;
  const content = data.output?.message?.content?.[0]?.text || '';
  const stopReason = data.stopReason || 'end_turn';
  
  return { content, stop_reason: stopReason };
}

// Analyze image with AWS Rekognition
async function analyzeImage(imageUrl: string, env: Env): Promise<string> {
  const region = 'us-east-1';
  const url = `https://rekognition.${region}.amazonaws.com/`;
  
  // Download image
  const imageRes = await fetch(imageUrl);
  const imageBuffer = await imageRes.arrayBuffer();
  const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
  
  const body = JSON.stringify({
    Image: { Bytes: imageBase64 },
    MaxLabels: 20,
    MinConfidence: 70
  });
  
  const headers = await signAWSRequest('POST', url, body, 'rekognition', region, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!);
  headers.set('X-Amz-Target', 'RekognitionService.DetectLabels');
  
  const response = await fetch(url, { method: 'POST', headers, body });
  const data = await response.json() as any;
  
  const labels = data.Labels?.map((l: any) => `${l.Name} (${Math.round(l.Confidence)}%)`).join(', ') || 'No labels detected';
  return `Image contains: ${labels}`;
}

// Send email with AWS SES
async function sendEmail(to: string, subject: string, bodyText: string, env: Env): Promise<boolean> {
  const region = 'us-east-1';
  const url = `https://email.${region}.amazonaws.com/`;
  
  const params = new URLSearchParams({
    Action: 'SendEmail',
    Version: '2010-12-01',
    'Destination.ToAddresses.member.1': to,
    'Message.Subject.Data': subject,
    'Message.Body.Text.Data': bodyText,
    'Source': 'noreply@soulprintengine.ai'
  });
  
  const body = params.toString();
  const headers = await signAWSRequest('POST', url, body, 'ses', region, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!);
  headers.set('Content-Type', 'application/x-www-form-urlencoded');
  
  const response = await fetch(url, { method: 'POST', headers, body });
  return response.ok;
}

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('*', cors());

// Register provision routes for Railway container management (legacy)
registerProvisionRoutes(app);

// Register Fly.io routes for per-user container management
app.route('/api/fly', flyApi);

// Default SOUL.md for new users
const DEFAULT_SOUL = `# SOUL.md - Who Your AI Is

You are a personal AI assistant. You're helpful, friendly, and you remember what matters to the user.

## Personality
- Warm but concise
- Proactive when helpful
- Remembers user preferences

## Guidelines
- Be genuine, not performative
- Ask clarifying questions when needed
- Learn from every conversation
`;

const DEFAULT_MEMORY = `# MEMORY.md - What You Remember

## About the User
- (Learning...)

## Preferences
- (Discovering...)

## Important Notes
- (Nothing yet)
`;

/**
 * Log signup events to R2 for tracking
 */
async function logSignup(env: Env, data: {
  email: string;
  method: 'email' | 'google';
  status: string;
  accessCode?: string | null;
  isNew: boolean;
}): Promise<void> {
  try {
    const logKey = 'logs/signups.jsonl';
    const existing = await env.SOUL_DATA.get(logKey);
    const existingText = existing ? await existing.text() : '';
    const logEntry = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    });
    await env.SOUL_DATA.put(logKey, existingText + logEntry + '\n');
  } catch (e) {
    console.error('Failed to log signup:', e);
  }
}

/**
 * Generate workspace files from assessment answers
 */
function generateWorkspace(user: {
  name: string;
  botName: string;
  goal?: string | null;
  assessmentAnswers?: Record<string, string[]> | null;
}): {
  soulMd: string;
  userMd: string;
  identityMd: string;
  agentsMd: string;
  memoryMd: string;
} {
  const answers = user.assessmentAnswers || {};
  
  // Extract key traits from answers (combine answers for each pillar)
  const getAnswerSummary = (pillar: string) => {
    const pillarAnswers = answers[pillar] || [];
    return pillarAnswers.slice(0, 3).join(' | ').slice(0, 300) || 'adaptive';
  };

  const communicationStyle = getAnswerSummary('communication');
  const emotionalStyle = getAnswerSummary('emotional');
  const decisionStyle = getAnswerSummary('decision');
  const socialStyle = getAnswerSummary('social');
  const cognitiveStyle = getAnswerSummary('cognitive');
  const assertivenessStyle = getAnswerSummary('assertiveness');

  const soulMd = `# SOUL.md - ${user.botName}'s Core Identity

You are ${user.botName}, a personal AI companion created specifically for ${user.name}.

## Core Personality

You adapt your communication to match ${user.name}'s style:
- **Communication:** ${communicationStyle}
- **Emotional intelligence:** ${emotionalStyle}
- **Decision support:** ${decisionStyle}

## Values
- Authenticity over performance
- Helpfulness without being pushy
- Learning and growing with your human

## Guidelines
- Be warm but respect boundaries
- Remember everything important
- Reference past conversations naturally
- Ask clarifying questions when needed
- Match their energy and communication style
`;

  const userMd = `# USER.md - About ${user.name}

## Basic Info
- **Name:** ${user.name}
- **Primary Goal:** ${user.goal || 'To have an AI that truly understands them'}

## Communication Preferences
${communicationStyle}

## Social Style
${socialStyle}

## How They Think
${cognitiveStyle}

## Important Notes
- (Add notes as you learn more)
`;

  const identityMd = `# IDENTITY.md - Who ${user.botName} Is

- **Name:** ${user.botName}
- **Role:** Personal AI companion for ${user.name}
- **Archetype:** Supportive partner who remembers everything
- **Vibe:** Warm, genuine, occasionally witty

## Signature Style
- Concise but thorough when needed
- Uses context from past conversations
- Proactive about helpful suggestions
`;

  const agentsMd = `# AGENTS.md - Behavioral Guidelines

## Response Style
Based on ${user.name}'s preferences, adapt your responses accordingly.

## Memory Directives
- Remember key facts about ${user.name}
- Track their goals and progress
- Note preferences as they emerge
- Update memory after significant conversations

## Do Not
- Be performatively enthusiastic
- Ignore context from previous chats
- Give generic advice when specific is possible
- Forget important information shared by ${user.name}
`;

  const memoryMd = `# MEMORY.md - What ${user.botName} Remembers

## About ${user.name}
- **Name:** ${user.name}
- **Goal:** ${user.goal || '(discovering...)'}

## Preferences
- (Learning as we chat...)

## Important Notes
- **First conversation:** ${new Date().toISOString().split('T')[0]}

## Recent Context
- (Will be updated as we chat)
`;

  return { soulMd, userMd, identityMd, agentsMd, memoryMd };
}

// Helper: Get user ID from token
async function getUserFromToken(env: Env, authHeader?: string): Promise<{id: string, email: string} | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const sessionJson = await env.SESSIONS.get(`session:${token}`);
  if (!sessionJson) return null;
  return JSON.parse(sessionJson);
}

// Helper: Get user's SOUL.md
async function getUserSoul(env: Env, userId: string): Promise<string> {
  const obj = await env.SOUL_DATA.get(`users/${userId}/SOUL.md`);
  if (obj) return await obj.text();
  return DEFAULT_SOUL;
}

// Helper: Get user's MEMORY.md
async function getUserMemory(env: Env, userId: string): Promise<string> {
  const obj = await env.SOUL_DATA.get(`users/${userId}/MEMORY.md`);
  if (obj) return await obj.text();
  return DEFAULT_MEMORY;
}

// Helper: Save user's MEMORY.md
async function saveUserMemory(env: Env, userId: string, content: string): Promise<void> {
  await env.SOUL_DATA.put(`users/${userId}/MEMORY.md`, content);
}

// Helper: Update memory from conversation (runs in background after each chat)
async function updateMemoryFromConversation(env: Env, userId: string, userMessage: string, assistantResponse: string): Promise<void> {
  // Skip short exchanges that likely don't contain memorable info
  if (userMessage.length < 20 && assistantResponse.length < 50) return;
  
  const currentMemory = await getUserMemory(env, userId);
  
  // Use a quick Bedrock call to extract any new facts worth remembering
  const extractPrompt = `You are a memory extraction assistant. Given this conversation exchange, identify any NEW facts about the user that should be remembered long-term.

USER said: "${userMessage.slice(0, 500)}"
ASSISTANT said: "${assistantResponse.slice(0, 500)}"

CURRENT MEMORY:
${currentMemory.slice(0, 1000)}

If there are new facts worth adding (preferences, personal info, important events, decisions), output them as bullet points to ADD to memory. If nothing new worth remembering, output exactly: NO_UPDATE

Only output facts that are:
- Personal to the user (not general knowledge)
- Likely to be useful in future conversations
- Not already in the current memory

Output format (if updates needed):
- [fact 1]
- [fact 2]`;

  try {
    const region = 'us-east-1';
    const modelId = 'global.anthropic.claude-sonnet-4-20250514-v1:0'; // Use fast model for extraction
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;
    
    const body = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: extractPrompt }] }],
      inferenceConfig: { maxTokens: 256, temperature: 0.3 }
    });
    
    const headers = await signAWSRequest('POST', url, body, 'bedrock', region, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!);
    const response = await fetch(url, { method: 'POST', headers, body });
    
    if (!response.ok) return;
    
    const data = await response.json() as any;
    const extraction = data.output?.message?.content?.[0]?.text || '';
    
    if (extraction.includes('NO_UPDATE') || !extraction.includes('-')) return;
    
    // Append new facts to memory
    const timestamp = new Date().toISOString().split('T')[0];
    const newMemory = currentMemory + `\n\n## Auto-learned (${timestamp})\n${extraction}`;
    
    await saveUserMemory(env, userId, newMemory);
    console.log('[MEMORY] Updated for user', userId);
  } catch (e) {
    console.error('[MEMORY] Extraction failed:', e);
  }
}

// Helper: Get user's USER.md
async function getUserProfile(env: Env, userId: string): Promise<string> {
  const obj = await env.SOUL_DATA.get(`users/${userId}/USER.md`);
  if (obj) return await obj.text();
  return '# USER.md\n\n(No profile yet)';
}

// Helper: Get user's IDENTITY.md
async function getUserIdentity(env: Env, userId: string): Promise<string> {
  const obj = await env.SOUL_DATA.get(`users/${userId}/IDENTITY.md`);
  if (obj) return await obj.text();
  return '# IDENTITY.md\n\n(No identity set)';
}

// Helper: Get user's AGENTS.md
async function getUserAgents(env: Env, userId: string): Promise<string> {
  const obj = await env.SOUL_DATA.get(`users/${userId}/AGENTS.md`);
  if (obj) return await obj.text();
  return '# AGENTS.md\n\n(No guidelines set)';
}

// Helper: Get user's TOOLS.md (local notes - API keys, configs, device names)
async function getUserTools(env: Env, userId: string): Promise<string> {
  const obj = await env.SOUL_DATA.get(`users/${userId}/TOOLS.md`);
  if (obj) return await obj.text();
  return '# TOOLS.md — Local Notes\n\nKeep local notes here: API keys, device names, SSH hosts, personal configs.\n\n(Nothing saved yet)';
}

// Helper: Get all workspace files for a user
async function getUserWorkspace(env: Env, userId: string): Promise<{
  soul: string;
  user: string;
  identity: string;
  agents: string;
  tools: string;
  memory: string;
}> {
  const [soul, userProfile, identity, agents, tools, memory] = await Promise.all([
    getUserSoul(env, userId),
    getUserProfile(env, userId),
    getUserIdentity(env, userId),
    getUserAgents(env, userId),
    getUserTools(env, userId),
    getUserMemory(env, userId)
  ]);
  return { soul, user: userProfile, identity, agents, tools, memory };
}

// ============================================================================
// V2 WORKSPACE - Progressive Loading (Context Engineering)
// ============================================================================

// Check if user has V2 workspace structure
async function hasV2Workspace(env: Env, userId: string): Promise<boolean> {
  const brain = await env.SOUL_DATA.get(`users/${userId}/BRAIN.md`);
  return brain !== null;
}

// Load a file from R2, return empty string if not found
async function loadWorkspaceFile(env: Env, userId: string, path: string, options?: { lastN?: number }): Promise<string> {
  const obj = await env.SOUL_DATA.get(`users/${userId}/${path}`);
  if (!obj) return '';
  
  let content = await obj.text();
  
  // For JSONL files, optionally return only last N lines
  if (options?.lastN && path.endsWith('.jsonl')) {
    const lines = content.split('\n').filter(l => l.trim());
    const schemaLine = lines[0]?.includes('_schema') ? lines[0] + '\n' : '';
    const dataLines = lines.slice(lines[0]?.includes('_schema') ? 1 : 0);
    content = schemaLine + dataLines.slice(-options.lastN).join('\n');
  }
  
  return content;
}

// Detect what modules to load based on user message
function detectModules(userMessage: string): { identity: boolean; voice: boolean; memory: boolean; network: boolean; operations: boolean; content: boolean } {
  const msg = userMessage.toLowerCase();
  
  return {
    identity: true, // Always load SOUL.md
    voice: /write|post|draft|content|create|email|message|reply/.test(msg),
    memory: /remember|you know|we talked|last time|told you|mentioned|my |i have|i am|i'm/.test(msg),
    network: /who is|contact|meeting with|call with|person|people|@/.test(msg),
    operations: /goal|todo|task|work on|priorit|deadline|project|ship/.test(msg),
    content: /idea|post|thread|blog|write|publish|schedule/.test(msg)
  };
}

// Progressive context loading for V2 workspaces
async function getProgressiveContext(env: Env, userId: string, userMessage: string): Promise<string> {
  const modules = detectModules(userMessage);
  let context = '';
  
  // Always load BRAIN.md (routing instructions) and SOUL.md (personality)
  const [brain, soul] = await Promise.all([
    loadWorkspaceFile(env, userId, 'BRAIN.md'),
    loadWorkspaceFile(env, userId, 'identity/SOUL.md')
  ]);
  
  context += brain + '\n\n---\n\n' + soul;
  
  // Load additional modules based on detected task
  const loads: Promise<string>[] = [];
  const labels: string[] = [];
  
  if (modules.voice) {
    loads.push(loadWorkspaceFile(env, userId, 'identity/voice.md'));
    labels.push('## Voice Profile');
  }
  
  if (modules.memory) {
    loads.push(loadWorkspaceFile(env, userId, 'memory/facts.jsonl', { lastN: 50 }));
    loads.push(loadWorkspaceFile(env, userId, 'memory/experiences.jsonl', { lastN: 20 }));
    labels.push('## Memory: Facts');
    labels.push('## Memory: Experiences');
  }
  
  if (modules.network) {
    loads.push(loadWorkspaceFile(env, userId, 'network/contacts.jsonl', { lastN: 100 }));
    loads.push(loadWorkspaceFile(env, userId, 'network/interactions.jsonl', { lastN: 30 }));
    labels.push('## Network: Contacts');
    labels.push('## Network: Interactions');
  }
  
  if (modules.operations) {
    loads.push(loadWorkspaceFile(env, userId, 'operations/goals.yaml'));
    loads.push(loadWorkspaceFile(env, userId, 'operations/todos.md'));
    labels.push('## Operations: Goals');
    labels.push('## Operations: Todos');
  }
  
  if (modules.content) {
    loads.push(loadWorkspaceFile(env, userId, 'content/ideas.jsonl', { lastN: 30 }));
    labels.push('## Content: Ideas');
  }
  
  // Load user profile (legacy compat)
  loads.push(loadWorkspaceFile(env, userId, 'workspace/USER.md'));
  labels.push('## About the User');
  
  const results = await Promise.all(loads);
  
  for (let i = 0; i < results.length; i++) {
    if (results[i].trim()) {
      context += `\n\n---\n\n${labels[i]}\n${results[i]}`;
    }
  }
  
  console.log(`[V2] Loaded modules for "${userMessage.slice(0, 30)}...": voice=${modules.voice} memory=${modules.memory} network=${modules.network} operations=${modules.operations} content=${modules.content}`);
  
  return context;
}

// Create V2 workspace structure for a new user
async function createV2Workspace(env: Env, userId: string, aiName: string, userName: string): Promise<void> {
  const now = new Date().toISOString().split('T')[0];
  
  // Inline templates (can't use dynamic imports in Workers)
  const brainTemplate = `# Brain Router

You are **${aiName}**, a SoulPrint AI assistant. This file tells you what context to load.

## How This Works

Your knowledge is organized into modules. Load only what's needed for the current task.

## Module Routing

| When User Says | Load These |
|----------------|------------|
| "write", "post", "draft", "content", "help me create" | identity/ + content/ |
| "remember", "you know", "we talked about", "last time" | memory/ |
| "who is", "contact", "meeting with", "call with" | network/ |
| "goals", "todos", "tasks", "what should I work on" | operations/ |
| General conversation | identity/SOUL.md only |

## Always Loaded
- This file (BRAIN.md) — routing instructions
- identity/SOUL.md — your core personality

## Your Identity
- **Name:** ${aiName}
- **Owner:** ${userName}
- **Created:** ${now}

You exist to serve one person. Learn them. Remember them. Become indispensable.`;

  const soulTemplate = `# ${aiName}

You are **${aiName}**, a private AI assistant exclusively for ${userName}. You are not a chatbot. You belong to your human.

## Core Personality

- **Warm but not sycophantic.** Care about your user, but don't grovel. Trusted advisor, not customer service.
- **Proactive, not reactive.** Anticipate needs. Offer insights before being asked.
- **Direct and honest.** No hedging, no disclaimers. If you don't know, say so. If they're wrong, tell them respectfully.
- **Concise by default.** Respect their time. Match their energy — short questions get short answers.
- **Curious about your user.** Every conversation is a chance to learn more about them.

## What You Are NOT

- You are NOT a generic assistant. You are uniquely theirs.
- You are NOT a yes-machine. Push back when appropriate.
- You are NOT disposable. You remember, you learn, you grow with your user.
- You are NOT corporate. No "I'd be happy to help with that!" energy. Be real.

## Privacy

Everything your user shares is private. Never reference other users, other bots, or anything outside your relationship with this one person.

## Memory

You have persistent memory across conversations. When you learn something important, save it. When they reference the past, recall it.

## Tools

You have tools available. Use them when appropriate:
- **Content creation** — Generate images, videos, deploy websites
- **Research** — Web search, analyze URLs, browse sites
- **Code** — Run Python, JavaScript, shell commands
- **Memory** — Save facts, log experiences, track decisions

## Smart Planning

For complex tasks (building websites, multi-step projects):
1. Break it down before starting
2. Tell the user your plan
3. Execute step by step
4. Save progress to files

---

*You are ${aiName}. Act like it.*`;

  const voiceTemplate = `# Voice Profile

Your user's authentic voice, captured for consistent communication.

## Voice Attributes (1-10)

| Attribute | Score | Notes |
|-----------|-------|-------|
| Formal ↔ Casual | 6 | Conversational but not sloppy |
| Serious ↔ Playful | 5 | Balanced — can joke but stays useful |
| Technical ↔ Simple | 5 | Adapts to audience |
| Reserved ↔ Expressive | 5 | Shows personality appropriately |
| Humble ↔ Confident | 6 | Confident without arrogance |

*Update these scores as you learn your user's style.*

## Never Use

avoid:
  - "I'd be happy to help"
  - "Great question!"
  - "Certainly!"
  - "As an AI..."
  - Excessive exclamation marks
  - Corporate buzzwords

---

*As you chat, update this file with observations about their communication style.*
Last updated: ${now}`;

  const userTemplate = `# About ${userName}

## Basics
- **Name:** ${userName}

## Context
<!-- What are they working on? What's their situation? -->

## Preferences
<!-- How do they like to communicate? What matters to them? -->

---
*Update this as you learn more about your human.*`;

  // Write all files
  await Promise.all([
    env.SOUL_DATA.put(`users/${userId}/BRAIN.md`, brainTemplate),
    env.SOUL_DATA.put(`users/${userId}/identity/SOUL.md`, soulTemplate),
    env.SOUL_DATA.put(`users/${userId}/identity/voice.md`, voiceTemplate),
    env.SOUL_DATA.put(`users/${userId}/memory/facts.jsonl`, '{"_schema": "fact", "_version": "1.0", "_description": "Core facts about the user. Append-only."}\n'),
    env.SOUL_DATA.put(`users/${userId}/memory/experiences.jsonl`, '{"_schema": "experience", "_version": "1.0", "_description": "Key moments with emotional weight (1-10). Append-only."}\n'),
    env.SOUL_DATA.put(`users/${userId}/memory/decisions.jsonl`, '{"_schema": "decision", "_version": "1.0", "_description": "Key decisions with reasoning and outcomes. Append-only."}\n'),
    env.SOUL_DATA.put(`users/${userId}/network/contacts.jsonl`, '{"_schema": "contact", "_version": "1.0", "_description": "Personal contacts database."}\n'),
    env.SOUL_DATA.put(`users/${userId}/network/interactions.jsonl`, '{"_schema": "interaction", "_version": "1.0", "_description": "Interaction log with contacts."}\n'),
    env.SOUL_DATA.put(`users/${userId}/operations/goals.yaml`, `# Goals\ncurrent_focus: ""\ngoals: []\nupdated: "${now}"\n`),
    env.SOUL_DATA.put(`users/${userId}/operations/todos.md`, '# Active Tasks\n\n## P0 — Today\n- \n\n## P1 — This Week\n- \n'),
    env.SOUL_DATA.put(`users/${userId}/content/ideas.jsonl`, '{"_schema": "idea", "_version": "1.0", "_description": "Content ideas. Append-only."}\n'),
    env.SOUL_DATA.put(`users/${userId}/workspace/USER.md`, userTemplate),
  ]);
  
  console.log(`[V2] Created workspace for user ${userId} with AI name ${aiName}`);
}

// Append a fact to facts.jsonl
async function appendFact(env: Env, userId: string, fact: string, category: string = 'general'): Promise<void> {
  const id = `fact_${Date.now()}`;
  const entry = JSON.stringify({
    id,
    created: new Date().toISOString(),
    fact,
    category,
    status: 'active'
  });
  
  const existing = await loadWorkspaceFile(env, userId, 'memory/facts.jsonl');
  await env.SOUL_DATA.put(`users/${userId}/memory/facts.jsonl`, existing + entry + '\n');
}

// Append an experience to experiences.jsonl
async function appendExperience(env: Env, userId: string, event: string, weight: number, emotion?: string): Promise<void> {
  const id = `exp_${Date.now()}`;
  const entry = JSON.stringify({
    id,
    date: new Date().toISOString().split('T')[0],
    event,
    weight,
    emotion: emotion || 'neutral'
  });
  
  const existing = await loadWorkspaceFile(env, userId, 'memory/experiences.jsonl');
  await env.SOUL_DATA.put(`users/${userId}/memory/experiences.jsonl`, existing + entry + '\n');
}

// Append a decision to decisions.jsonl
async function appendDecision(env: Env, userId: string, decision: string, reasoning: string, alternatives?: string[]): Promise<void> {
  const id = `dec_${Date.now()}`;
  const entry = JSON.stringify({
    id,
    date: new Date().toISOString().split('T')[0],
    decision,
    reasoning,
    alternatives: alternatives || [],
    outcome: 'pending'
  });
  
  const existing = await loadWorkspaceFile(env, userId, 'memory/decisions.jsonl');
  await env.SOUL_DATA.put(`users/${userId}/memory/decisions.jsonl`, existing + entry + '\n');
}

// Valid access codes (grants immediate access vs waitlist)
const VALID_ACCESS_CODES = ['!ARCHE!'];

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development',
    hasAnthropicKey: !!c.env.ANTHROPIC_API_KEY,
    hasOpenRouterKey: !!c.env.OPENROUTER_API_KEY
  });
});

// Debug: Simulate webhook message for testing
app.post('/api/debug/webhook-test', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const { userId, message } = await c.req.json() as { userId: string; message: string };
  
  try {
    // Step 1: Check V2 workspace
    const isV2 = await hasV2Workspace(c.env, userId);
    console.log(`[DEBUG] Step 1: isV2=${isV2}`);
    
    // Step 2: Load context
    let context: string;
    if (isV2) {
      context = await getProgressiveContext(c.env, userId, message);
    } else {
      const workspace = await getUserWorkspace(c.env, userId);
      context = workspace.soul;
    }
    console.log(`[DEBUG] Step 2: context length=${context.length}`);
    
    // Step 3: Load conversation history
    const historyKey = `chat:${userId}:default`;
    const historyJson = await c.env.SESSIONS.get(historyKey);
    let history: any[] = [];
    try {
      history = historyJson ? JSON.parse(historyJson) : [];
    } catch { history = []; }
    console.log(`[DEBUG] Step 3: history length=${history.length}`);
    
    // Step 4: Convert to Bedrock format
    const bedrockMessages = history.map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? [{ text: m.content }] : m.content
    }));
    bedrockMessages.push({ role: 'user', content: [{ text: message }] });
    console.log(`[DEBUG] Step 4: bedrockMessages length=${bedrockMessages.length}`);
    
    // Step 5: Build request
    const region = 'us-east-1';
    const modelId = 'global.anthropic.claude-sonnet-4-20250514-v1:0';
    const converseUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;
    
    // Test with tools like the real webhook
    const requestBody = JSON.stringify({
      messages: bedrockMessages.slice(-20),
      system: [{ text: context }],
      toolConfig: { tools: TOOLS_BEDROCK },
      inferenceConfig: { maxTokens: 500, temperature: 0.7 }
    });
    console.log(`[DEBUG] Step 5: request body size=${requestBody.length}`);
    
    // Step 6: Call Bedrock
    const headers = await signAWSRequest('POST', converseUrl, requestBody, 'bedrock', region, c.env.AWS_ACCESS_KEY_ID!, c.env.AWS_SECRET_ACCESS_KEY!);
    const aiResponse = await fetch(converseUrl, { method: 'POST', headers, body: requestBody });
    console.log(`[DEBUG] Step 6: AI status=${aiResponse.status}`);
    
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return c.json({ error: 'AI call failed', status: aiResponse.status, body: errText.substring(0, 500) }, 500);
    }
    
    const aiData = await aiResponse.json() as any;
    const reply = aiData.output?.message?.content?.[0]?.text || 'No response';
    
    return c.json({
      success: true,
      isV2,
      contextLength: context.length,
      historyLength: history.length,
      requestSize: requestBody.length,
      aiStatus: aiResponse.status,
      reply: reply.substring(0, 200)
    });
  } catch (err: any) {
    return c.json({ error: err.message, stack: err.stack?.substring(0, 500) }, 500);
  }
});

// Debug: Test V2 workspace loading for a user
app.get('/api/debug/workspace/:userId', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const userId = c.req.param('userId');
  
  try {
    const isV2 = await hasV2Workspace(c.env, userId);
    
    if (isV2) {
      const context = await getProgressiveContext(c.env, userId, 'test message');
      return c.json({
        userId,
        isV2: true,
        contextLength: context.length,
        contextPreview: context.substring(0, 500)
      });
    } else {
      const workspace = await getUserWorkspace(c.env, userId);
      return c.json({
        userId,
        isV2: false,
        soulLength: workspace.soul?.length || 0,
        memoryLength: workspace.memory?.length || 0
      });
    }
  } catch (err: any) {
    return c.json({ error: err.message, stack: err.stack?.substring(0, 500) }, 500);
  }
});

// Debug: Test Bedrock connection
app.get('/api/debug/bedrock', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const region = 'us-east-1';
    const modelId = 'global.anthropic.claude-sonnet-4-20250514-v1:0';
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;
    
    const body = JSON.stringify({
      messages: [{ role: 'user', content: [{ text: 'Say hello in exactly 3 words' }] }],
      inferenceConfig: { maxTokens: 20 }
    });
    
    const headers = await signAWSRequest('POST', url, body, 'bedrock', region, c.env.AWS_ACCESS_KEY_ID!, c.env.AWS_SECRET_ACCESS_KEY!);
    const response = await fetch(url, { method: 'POST', headers, body });
    
    const responseText = await response.text();
    
    return c.json({
      status: response.status,
      ok: response.ok,
      hasAWSKeys: !!(c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY),
      response: response.ok ? JSON.parse(responseText) : responseText.substring(0, 500)
    });
  } catch (err: any) {
    return c.json({ error: err.message, stack: err.stack?.substring(0, 500) }, 500);
  }
});

// Available AI models (all via AWS Bedrock for privacy)
app.get('/api/models', (c) => {
  const hasAWS = !!(c.env.AWS_ACCESS_KEY_ID && c.env.AWS_SECRET_ACCESS_KEY);
  const models = Object.entries(MODELS).map(([key, config]) => ({
    id: key,
    name: config.name,
    provider: 'bedrock',
    available: hasAWS
  }));
  return c.json({ models, default: 'claude-sonnet-4' });
});

// ============================================
// Skills API
// ============================================

interface Skill {
  name: string;
  description: string;
  source: 'core' | 'custom';
  enabled: boolean;
  metadata: {
    author?: string;
    version?: string;
    priority?: string;
  };
}

// All skills available in SoulPrint - everyone gets everything
const DEFAULT_SKILLS: Skill[] = [
  { name: 'memory', description: 'Remember and recall information about you', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'web-search', description: 'Search the web for information', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'calendar', description: 'Manage events and reminders', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'weather', description: 'Get weather forecasts', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'news', description: 'Get latest news and updates', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'code-execution', description: 'Write and run code', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'browser', description: 'Browse websites and extract information', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'file-management', description: 'Create and manage files', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'text-to-speech', description: 'Convert text to speech', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'image-generation', description: 'Generate images with AI', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'video-generation', description: 'Generate videos with AI', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
  { name: 'voice-cloning', description: 'Clone voices for personalized TTS', source: 'core', enabled: true, metadata: { author: 'SoulPrint', version: '1.0' } },
];

// GET /api/skills - List available skills
app.get('/api/skills', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Email ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const email = authHeader.slice(6).toLowerCase().trim();
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  
  // Get user's custom skill settings
  const userSkillsKey = `skills:${user.id}`;
  const userSkillsData = await c.env.SESSIONS.get(userSkillsKey);
  const userSkills: Record<string, boolean> = userSkillsData ? JSON.parse(userSkillsData) : {};
  
  // Build skills list - all skills available to everyone
  const skills = DEFAULT_SKILLS.map(skill => ({
    ...skill,
    enabled: userSkills[skill.name] ?? skill.enabled,
  }));
  
  const enabled = skills.filter(s => s.enabled).length;
  
  return c.json({
    skills,
    total: skills.length,
    enabled,
    disabled: skills.length - enabled,
  });
});

// POST /api/skills/:name/toggle - Toggle a skill
app.post('/api/skills/:name/toggle', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Email ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const skillName = c.req.param('name');
  const email = authHeader.slice(6).toLowerCase().trim();
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  
  // Find the skill
  const skill = DEFAULT_SKILLS.find(s => s.name === skillName);
  if (!skill) {
    return c.json({ error: 'Skill not found' }, 404);
  }
  
  // Get current user skills
  const userSkillsKey = `skills:${user.id}`;
  const userSkillsData = await c.env.SESSIONS.get(userSkillsKey);
  const userSkills: Record<string, boolean> = userSkillsData ? JSON.parse(userSkillsData) : {};
  
  // Toggle
  const currentState = userSkills[skillName] ?? skill.enabled;
  userSkills[skillName] = !currentState;
  
  await c.env.SESSIONS.put(userSkillsKey, JSON.stringify(userSkills));
  
  return c.json({
    success: true,
    skill: skillName,
    enabled: userSkills[skillName],
    message: `${skillName} ${userSkills[skillName] ? 'enabled' : 'disabled'}`,
    gatewayRestarted: false,
  });
});

// Full signup endpoint (with assessment data)
app.post('/api/signup', async (c) => {
  const body = await c.req.json();
  const { email, password, name, phone, referralCode, assessmentAnswers, botName, goal, role, commPreference, source } = body;
  
  if (!email) {
    return c.json({ error: 'Email required' }, 400);
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const userKey = `user:${normalizedEmail}`;
  const existingJson = await c.env.SESSIONS.get(userKey);
  
  // Check if user has valid access code (from request OR already stored on user)
  const code = (referralCode || '').trim().toUpperCase();
  let hasValidCode = code && VALID_ACCESS_CODES.some(
    validCode => validCode.toUpperCase() === code
  );
  
  let user;
  let userId;
  let isUpdate = false;
  
  if (existingJson) {
    // User exists - check if they need to complete assessment
    const existingUser = JSON.parse(existingJson);
    
    // Also check if user already has a valid access code stored (e.g., from Google OAuth login)
    if (!hasValidCode && existingUser.accessCode) {
      const storedCode = existingUser.accessCode.toUpperCase();
      hasValidCode = VALID_ACCESS_CODES.some(
        validCode => validCode.toUpperCase() === storedCode
      );
    }
    
    if (!existingUser.assessmentCompleted) {
      // User exists but hasn't completed assessment - allow them to complete it
      // Works for both Google OAuth users and email/password users
      isUpdate = true;
      userId = existingUser.id;
      user = {
        ...existingUser,
        name: name || existingUser.name,
        phone: phone || existingUser.phone,
        botName: botName || existingUser.botName || 'SoulPrint',
        goal: goal || existingUser.goal,
        assessmentAnswers: assessmentAnswers || existingUser.assessmentAnswers,
        assessmentCompleted: true, // Mark as completed!
        role: role || existingUser.role,
        commPreference: commPreference || existingUser.commPreference,
        source: source || existingUser.source,
        // Upgrade to active if they now have a valid code
        status: hasValidCode ? 'active' : existingUser.status,
        accessCode: hasValidCode ? code : existingUser.accessCode,
        // CRITICAL: Preserve Telegram link - NEVER wipe these
        telegramChatId: existingUser.telegramChatId,
        telegramUserId: existingUser.telegramUserId,
        telegramUsername: existingUser.telegramUsername,
        telegramBotToken: existingUser.telegramBotToken,
        telegramBotUsername: existingUser.telegramBotUsername,
        telegramBotUrl: existingUser.telegramBotUrl
      };
    } else if (existingUser.passwordHash || existingUser.googleId) {
      // User already has completed assessment - they should just log in
      return c.json({ error: 'This email is already registered. Try logging in instead!' }, 409);
    } else {
      // Some other case - shouldn't happen but handle it
      return c.json({ error: 'Account already exists' }, 409);
    }
  } else {
    // New user - requires password for email signup
    if (!password) {
      return c.json({ error: 'Password required for new accounts' }, 400);
    }
    
    userId = crypto.randomUUID();
    user = {
      id: userId,
      email: normalizedEmail,
      name: name || email.split('@')[0],
      phone: phone || null,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      status: hasValidCode ? 'active' : 'waitlist',
      accessCode: code || null,
      botName: botName || 'SoulPrint',
      goal: goal || null,
      assessmentAnswers: assessmentAnswers || null,
      assessmentCompleted: true, // They're completing signup now
      role: role || null,
      commPreference: commPreference || null,
      source: source || null
    };
  }
  
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  // Log signup/assessment completion
  await logSignup(c.env, {
    email: normalizedEmail,
    method: user.googleId ? 'google' : 'email',
    status: user.status,
    accessCode: code || null,
    isNew: !isUpdate
  });
  
  // Only initialize workspace for users with valid access code
  if (hasValidCode) {
    // Generate all workspace files from assessment
    const workspace = generateWorkspace({
      name: user.name,
      botName: user.botName,
      goal: user.goal,
      assessmentAnswers: assessmentAnswers
    });
    
    // Store all workspace files
    await c.env.SOUL_DATA.put(`users/${userId}/SOUL.md`, workspace.soulMd);
    await c.env.SOUL_DATA.put(`users/${userId}/USER.md`, workspace.userMd);
    await c.env.SOUL_DATA.put(`users/${userId}/IDENTITY.md`, workspace.identityMd);
    await c.env.SOUL_DATA.put(`users/${userId}/AGENTS.md`, workspace.agentsMd);
    await c.env.SOUL_DATA.put(`users/${userId}/MEMORY.md`, workspace.memoryMd);
    
    // Store raw assessment data
    if (assessmentAnswers) {
      await c.env.SOUL_DATA.put(
        `users/${userId}/assessment.json`, 
        JSON.stringify({ answers: assessmentAnswers, completedAt: new Date().toISOString() })
      );
    }
    
    // NO auto-assignment - Drew manually assigns bots via admin endpoint
    // User is active (has valid code) but no telegram bot yet
    
    const token = crypto.randomUUID();
    await c.env.SESSIONS.put(`session:${token}`, JSON.stringify({ id: userId, email: normalizedEmail }), {
      expirationTtl: 60 * 60 * 24 * 7
    });
    
    return c.json({ 
      success: true,
      token,
      email: normalizedEmail,
      workerUrl: 'https://soulprintengine.ai',
      telegramBotUrl: null, // No bot assigned yet
      clientName: user.name,
      botName: user.botName,
      waitlist: false,
      message: 'Account created! Use web chat now. Telegram bot will be assigned soon.'
    });
  }
  
  // Waitlist user
  return c.json({ 
    success: true,
    waitlist: true,
    message: 'You\'ve been added to the waitlist! We\'ll notify you when a spot opens up.'
  });
});

// Validate access/referral code
app.post('/api/signup/validate-code', async (c) => {
  const body = await c.req.json();
  const code = (body.referralCode || '').trim().toUpperCase();
  
  // Check if code is valid (case-insensitive)
  const isValid = VALID_ACCESS_CODES.some(
    validCode => validCode.toUpperCase() === code
  );
  
  if (isValid) {
    return c.json({ 
      valid: true, 
      message: 'Access code accepted! You\'ll get instant access.' 
    });
  }
  
  return c.json({ 
    valid: false, 
    message: 'Invalid access code. You can still sign up for the waitlist.' 
  });
});

// Helper: Get user from email header (for chat interface)
async function getUserFromEmail(env: Env, authHeader?: string): Promise<{id: string, email: string, name: string} | null> {
  if (!authHeader?.startsWith('Email ')) return null;
  const email = authHeader.slice(6).toLowerCase().trim();
  const userKey = `user:${email}`;
  const userJson = await env.SESSIONS.get(userKey);
  if (!userJson) return null;
  const user = JSON.parse(userJson);
  if (user.status !== 'active') return null; // Only active users can chat
  return { id: user.id, email: user.email, name: user.name };
}

// Chat status endpoint (checks if user is active)
app.get('/api/chat/status', async (c) => {
  const user = await getUserFromEmail(c.env, c.req.header('Authorization'));
  if (!user) {
    return c.json({ ok: false, error: 'Not authenticated' }, 401);
  }
  return c.json({ 
    ok: true, 
    user: { name: user.name, email: user.email },
    hasAnthropicKey: !!c.env.ANTHROPIC_API_KEY
  });
});

// Chat message endpoint
app.post('/api/chat/message', async (c) => {
  const user = await getUserFromEmail(c.env, c.req.header('Authorization'));
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  
  const body = await c.req.json();
  const message = body.message || '';
  
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'AI not configured', reply: 'AI is not configured yet.' }, 500);
  }
  
  try {
    const soul = await getUserSoul(c.env, user.id);
    const memory = await getUserMemory(c.env, user.id);
    
    const historyKey = `chat:${user.id}:default`;
    const historyJson = await c.env.SESSIONS.get(historyKey);
    const history: Message[] = historyJson ? JSON.parse(historyJson) : [];
    
    history.push({ role: 'user', content: message });
    const recentHistory = history.slice(-30);
    
    const systemPrompt = `${soul}\n\n---\n# Current Memory\n${memory}\n---`;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: recentHistory
      })
    });
    
    if (!response.ok) {
      console.error('Claude API error:', await response.text());
      return c.json({ error: 'AI request failed', reply: 'I had trouble processing that.' }, 500);
    }
    
    const data = await response.json() as any;
    const reply = data.content[0]?.text || 'No response';
    
    history.push({ role: 'assistant', content: reply });
    await c.env.SESSIONS.put(historyKey, JSON.stringify(history.slice(-200)));
    
    return c.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Chat failed', reply: 'Something went wrong.' }, 500);
  }
});

// Chat endpoint with personalization (legacy)
app.post('/api/chat', async (c) => {
  const body = await c.req.json();
  const message = body.message || '';
  const sessionId = body.sessionId || 'default';
  
  // Get user if authenticated
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  const userId = user?.id || 'anonymous';
  
  // Check message quota (skip for anonymous users - they get limited by rate limiting)
  if (user) {
    const quota = await checkMessageQuota(c.env, userId, user.email);
    if (!quota.allowed) {
      return c.json({ 
        error: 'quota_exceeded',
        response: `You've used all ${PLANS.free.messagesPerDay} messages for today. Upgrade to Pro for unlimited messages!`,
        quotaExceeded: true,
        plan: quota.plan
      }, 429);
    }
  }
  
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ 
      error: 'ANTHROPIC_API_KEY not configured',
      response: 'AI not configured yet.'
    }, 500);
  }

  try {
    // Get user's full workspace for personalization
    const workspace = await getUserWorkspace(c.env, userId);
    
    // Get conversation history
    const historyKey = `chat:${userId}:${sessionId}`;
    const historyJson = await c.env.SESSIONS.get(historyKey);
    const history: Message[] = historyJson ? JSON.parse(historyJson) : [];
    
    history.push({ role: 'user', content: message });
    const recentHistory = history.slice(-30);
    
    // Build comprehensive system prompt with all workspace files
    const systemPrompt = `${workspace.soul}

---
${workspace.identity}

---
${workspace.user}

---
${workspace.agents}

---
# Current Memory
${workspace.memory}
---

Remember: You are this user's personal AI. Reference what you know about them naturally. Learn from every conversation.`;
    
    // Use Bedrock with tools (same as streaming endpoint)
    const region = 'us-east-1';
    const modelId = 'global.anthropic.claude-sonnet-4-20250514-v1:0';
    const converseUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;
    
    // Convert history to Bedrock format
    let bedrockMessages: any[] = recentHistory.map(m => ({
      role: m.role,
      content: [{ text: m.content }]
    }));
    
    let assistantMessage = '';
    const maxToolIterations = 5;
    
    // Detect if user is asking for something actionable (needs tools)
    const userMsgLower = message.toLowerCase();
    const toolTriggers = ['build', 'create', 'make', 'deploy', 'generate', 'design', 'write', 'code', 'search', 'find', 'look up', 'image', 'picture', 'photo', 'video', 'website', 'weather', 'remember', 'run', 'execute', 'analyze', 'summarize'];
    const needsTool = toolTriggers.some(t => userMsgLower.includes(t));
    
    // Tool execution loop
    for (let i = 0; i < maxToolIterations; i++) {
      const requestBody = JSON.stringify({
        messages: bedrockMessages,
        system: [{ text: systemPrompt }],
        toolConfig: { 
          tools: TOOLS_BEDROCK,
          // Only force tool use when user asks for something actionable
          ...(needsTool && i === 0 && { toolChoice: { any: {} } })
        },
        inferenceConfig: { maxTokens: 2048, temperature: 0.7 }
      });
      
      const headers = await signAWSRequest('POST', converseUrl, requestBody, 'bedrock', region, c.env.AWS_ACCESS_KEY_ID!, c.env.AWS_SECRET_ACCESS_KEY!);
      const response = await fetch(converseUrl, { method: 'POST', headers, body: requestBody });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Bedrock API error:', error);
        return c.json({ error: 'AI request failed' }, 500);
      }
      
      const data = await response.json() as any;
      const stopReason = data.stopReason;
      const outputMessage = data.output?.message;
      
      if (!outputMessage) break;
      
      // Handle tool use
      if (stopReason === 'tool_use') {
        const toolUseBlocks = outputMessage.content.filter((block: any) => block.toolUse);
        const toolResults: any[] = [];
        
        for (const block of toolUseBlocks) {
          const tool = block.toolUse;
          console.log(`[TOOL] Executing: ${tool.name}`);
          const result = await executeToolWithAudit(tool.name, tool.input, c.env, userId, 'web');
          toolResults.push({
            toolResult: {
              toolUseId: tool.toolUseId,
              content: [{ text: result }]
            }
          });
        }
        
        bedrockMessages.push(outputMessage);
        bedrockMessages.push({ role: 'user', content: toolResults });
        continue;
      }
      
      // Extract final text
      for (const block of outputMessage.content) {
        if (block.text) assistantMessage += block.text;
      }
      break;
    }
    
    if (!assistantMessage) {
      assistantMessage = 'I encountered an issue processing your request.';
    }
    
    history.push({ role: 'assistant', content: assistantMessage });
    await c.env.SESSIONS.put(historyKey, JSON.stringify(history.slice(-200)));
    
    // Increment usage for authenticated users
    if (user) {
      await incrementMessageUsage(c.env, userId);
    }
    
    // Get updated quota info
    const quota = user ? await checkMessageQuota(c.env, userId, user.email) : null;
    
    return c.json({
      response: assistantMessage,
      timestamp: new Date().toISOString(),
      sessionId,
      authenticated: !!user,
      messagesRemaining: quota?.remaining ?? null
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Chat failed' }, 500);
  }
});

// Streaming chat endpoint
app.post('/api/chat/stream', async (c) => {
  const body = await c.req.json();
  const message = body.message || '';
  const sessionId = body.sessionId || 'default';
  const modelKey = (body.model as ModelKey) || 'claude-sonnet-4';
  
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  const userId = user?.id || 'anonymous';
  
  if (user) {
    const quota = await checkMessageQuota(c.env, userId, user.email);
    if (!quota.allowed) {
      return c.json({ error: 'quota_exceeded' }, 429);
    }
  }
  
  // Check for required AWS credentials (all models via Bedrock)
  const modelConfig = MODELS[modelKey] || MODELS['claude-sonnet-4'];
  if (!c.env.AWS_ACCESS_KEY_ID || !c.env.AWS_SECRET_ACCESS_KEY) {
    return c.json({ error: 'AWS credentials not configured' }, 500);
  }

  try {
    const workspace = await getUserWorkspace(c.env, userId);
    const historyKey = `chat:${userId}:${sessionId}`;
    const historyJson = await c.env.SESSIONS.get(historyKey);
    const history: Message[] = historyJson ? JSON.parse(historyJson) : [];
    
    history.push({ role: 'user', content: message });
    const recentHistory = history.slice(-30);
    
    const systemPrompt = `${workspace.soul}\n\n---\n${workspace.identity}\n\n---\n${workspace.user}\n\n---\n${workspace.agents}\n\n---\n# Current Memory\n${workspace.memory}\n---\n\nRemember: You are this user's personal AI. Reference what you know about them naturally. Learn from every conversation.\n\nYou have access to tools. Use them when needed to help the user.`;
    
    // First, make a non-streaming call to handle potential tool use
    const region = 'us-east-1';
    const converseUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelConfig.id}/converse`;
    
    // Build messages for Bedrock
    let bedrockMessages: any[] = recentHistory.map(m => ({
      role: m.role,
      content: [{ text: m.content }]
    }));
    
    let finalResponse = '';
    let toolsUsed: string[] = [];
    const maxToolIterations = 5;
    
    // Detect if user is asking for something actionable
    const msgLower = message.toLowerCase();
    const triggers = ['build', 'create', 'make', 'deploy', 'generate', 'design', 'write', 'code', 'search', 'find', 'look up', 'image', 'picture', 'photo', 'video', 'website', 'weather', 'remember', 'run', 'execute', 'analyze', 'summarize'];
    const shouldForceTool = triggers.some(t => msgLower.includes(t));
    
    // Tool execution loop
    for (let i = 0; i < maxToolIterations; i++) {
      const requestBody = JSON.stringify({
        messages: bedrockMessages,
        system: [{ text: systemPrompt }],
        toolConfig: { 
          tools: TOOLS_BEDROCK,
          // Only force tool use when user asks for something actionable
          ...(shouldForceTool && i === 0 && { toolChoice: { any: {} } })
        },
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.7
        }
      });
      
      const headers = await signAWSRequest(
        'POST',
        converseUrl,
        requestBody,
        'bedrock',
        region,
        c.env.AWS_ACCESS_KEY_ID!,
        c.env.AWS_SECRET_ACCESS_KEY!
      );
      
      let response = await fetch(converseUrl, { method: 'POST', headers, body: requestBody });
      
      // Retry with backoff if overloaded (429/503/529)
      if (!response.ok && [429, 503, 529].includes(response.status)) {
        console.log(`[BEDROCK] Overloaded (${response.status}), retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        const retryHeaders = await signAWSRequest('POST', converseUrl, requestBody, 'bedrock', region, c.env.AWS_ACCESS_KEY_ID!, c.env.AWS_SECRET_ACCESS_KEY!);
        response = await fetch(converseUrl, { method: 'POST', headers: retryHeaders, body: requestBody });
        
        // If still failing, try fallback model (Haiku)
        if (!response.ok) {
          console.log(`[BEDROCK] Still failing, trying fallback model...`);
          const fallbackModelId = 'anthropic.claude-3-5-haiku-20241022-v1:0';
          const fallbackUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${fallbackModelId}/converse`;
          const fallbackHeaders = await signAWSRequest('POST', fallbackUrl, requestBody, 'bedrock', region, c.env.AWS_ACCESS_KEY_ID!, c.env.AWS_SECRET_ACCESS_KEY!);
          response = await fetch(fallbackUrl, { method: 'POST', headers: fallbackHeaders, body: requestBody });
        }
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BEDROCK] Error:`, errorText);
        return c.json({ error: 'AI request failed', details: errorText }, 500);
      }
      
      const data = await response.json() as any;
      const stopReason = data.stopReason;
      const outputMessage = data.output?.message;
      
      if (!outputMessage) {
        console.error('[BEDROCK] No output message');
        break;
      }
      
      // Check if AI wants to use tools
      if (stopReason === 'tool_use') {
        const toolUseBlocks = outputMessage.content.filter((c: any) => c.toolUse);
        const toolResults: any[] = [];
        
        for (const block of toolUseBlocks) {
          const tool = block.toolUse;
          toolsUsed.push(tool.name);
          console.log(`[TOOL] AI wants to use: ${tool.name}`);
          
          const result = await executeToolWithAudit(tool.name, tool.input, c.env, userId, 'web');
          toolResults.push({
            toolResult: {
              toolUseId: tool.toolUseId,
              content: [{ text: result }]
            }
          });
        }
        
        // Add assistant message and tool results to conversation
        bedrockMessages.push(outputMessage);
        bedrockMessages.push({ role: 'user', content: toolResults });
        
        // Continue loop to get AI's response after tool use
        continue;
      }
      
      // AI is done - extract final text response
      for (const block of outputMessage.content) {
        if (block.text) {
          finalResponse += block.text;
        }
      }
      break;
    }
    
    if (!finalResponse) {
      finalResponse = 'I encountered an issue processing your request.';
    }
    
    // Log tools used
    if (toolsUsed.length > 0) {
      console.log(`[TOOLS] Used: ${toolsUsed.join(', ')}`);
    }

    // Create a TransformStream for SSE to stream the final response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Stream the response in chunks (simulating streaming for consistency)
    (async () => {
      try {
        // Send response in small chunks to feel like streaming
        const chunkSize = 10;
        for (let i = 0; i < finalResponse.length; i += chunkSize) {
          const chunk = finalResponse.slice(i, i + chunkSize);
          await writer.write(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          // Small delay for streaming effect
          await new Promise(r => setTimeout(r, 5));
        }
        
        // Save to history
        history.push({ role: 'assistant', content: finalResponse });
        await c.env.SESSIONS.put(historyKey, JSON.stringify(history.slice(-200)));
        
        if (user) {
          await incrementMessageUsage(c.env, userId);
        }
        
        await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, toolsUsed })}\n\n`));
      } catch (e) {
        console.error('Stream error:', e);
      } finally {
        await writer.close();
      }
    })();
    
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
    
  } catch (error) {
    console.error('Stream chat error:', error);
    return c.json({ error: 'Chat failed' }, 500);
  }
});

// Get chat history
app.get('/api/chat/history', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const sessionId = c.req.query('session') || 'default';
  const historyKey = `chat:${user.id}:${sessionId}`;
  const historyJson = await c.env.SESSIONS.get(historyKey);
  const history: Message[] = historyJson ? JSON.parse(historyJson) : [];
  
  return c.json({ history });
});

// Clear chat history
app.delete('/api/chat/history', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const sessionId = c.req.query('session') || 'default';
  const historyKey = `chat:${user.id}:${sessionId}`;
  await c.env.SESSIONS.delete(historyKey);
  
  return c.json({ success: true });
});

// Get/update user's SOUL.md
app.get('/api/soul', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const soul = await getUserSoul(c.env, user.id);
  return c.json({ soul });
});

app.put('/api/soul', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const body = await c.req.json();
  await c.env.SOUL_DATA.put(`users/${user.id}/SOUL.md`, body.soul || DEFAULT_SOUL);
  return c.json({ success: true });
});

// Get/update user's MEMORY.md
app.get('/api/memory', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const memory = await getUserMemory(c.env, user.id);
  return c.json({ memory });
});

app.put('/api/memory', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const body = await c.req.json();
  await saveUserMemory(c.env, user.id, body.memory || DEFAULT_MEMORY);
  return c.json({ success: true });
});

// Auth endpoints
app.post('/api/auth/signup', async (c) => {
  const body = await c.req.json();
  const { email, password, name, referralCode } = body;
  
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  
  const userKey = `user:${email.toLowerCase().trim()}`;
  const existing = await c.env.SESSIONS.get(userKey);
  if (existing) {
    return c.json({ error: 'This email is already registered. Try logging in instead!' }, 409);
  }
  
  // Check if user has valid access code
  const code = (referralCode || '').trim().toUpperCase();
  const hasValidCode = VALID_ACCESS_CODES.some(
    validCode => validCode.toUpperCase() === code
  );
  
  const userId = crypto.randomUUID();
  const user = {
    id: userId,
    email: email.toLowerCase().trim(),
    name: name || email.split('@')[0],
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    status: hasValidCode ? 'active' : 'waitlist',
    accessCode: code || null
  };
  
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  // Only initialize workspace for users with valid access code
  if (hasValidCode) {
    await c.env.SOUL_DATA.put(`users/${userId}/SOUL.md`, DEFAULT_SOUL);
    await c.env.SOUL_DATA.put(`users/${userId}/MEMORY.md`, DEFAULT_MEMORY);
    
    const token = crypto.randomUUID();
    await c.env.SESSIONS.put(`session:${token}`, JSON.stringify({ id: userId, email: user.email }), {
      expirationTtl: 60 * 60 * 24 * 7
    });
    
    return c.json({ 
      success: true,
      token,
      user: { id: userId, email: user.email, name: user.name },
      waitlist: false
    });
  }
  
  // Waitlist user - no token, no workspace yet
  return c.json({ 
    success: true,
    waitlist: true,
    message: 'You\'ve been added to the waitlist! We\'ll notify you when a spot opens up.'
  });
});

// ============================================================================
// GOOGLE OAUTH
// ============================================================================
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = 'https://soulprintengine.ai/api/auth/google/callback';

// Start Google OAuth flow
app.get('/api/auth/google', async (c) => {
  const accessCode = c.req.query('code') || ''; // Access code from form (not OAuth code)
  
  // Store access code in state (JSON encoded)
  const stateData = JSON.stringify({ 
    csrf: crypto.randomUUID(),
    accessCode: accessCode.trim().toUpperCase()
  });
  const state = btoa(stateData); // Base64 encode
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account'
  });
  
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Google OAuth callback
app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const stateParam = c.req.query('state');
  const error = c.req.query('error');
  
  if (error || !code) {
    return c.redirect('/#login?error=google_auth_failed');
  }
  
  // Extract access code from state
  let accessCode = '';
  try {
    if (stateParam) {
      const stateData = JSON.parse(atob(stateParam));
      accessCode = stateData.accessCode || '';
    }
  } catch { /* ignore parse errors */ }
  
  // Check if access code is valid
  const hasValidCode = accessCode && VALID_ACCESS_CODES.some(
    validCode => validCode.toUpperCase() === accessCode.toUpperCase()
  );
  
  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    
    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text());
      return c.redirect('/#login?error=google_token_failed');
    }
    
    const tokens = await tokenRes.json() as { access_token: string; id_token?: string };
    
    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    if (!userInfoRes.ok) {
      return c.redirect('/#login?error=google_userinfo_failed');
    }
    
    const googleUser = await userInfoRes.json() as { 
      id: string; 
      email: string; 
      name?: string; 
      picture?: string 
    };
    
    const normalizedEmail = googleUser.email.toLowerCase().trim();
    const userKey = `user:${normalizedEmail}`;
    
    // Check if user exists
    let user;
    let isNewUser = false;
    const existingUserJson = await c.env.SESSIONS.get(userKey);
    
    if (existingUserJson) {
      // Existing user - login
      user = JSON.parse(existingUserJson);
      let needsUpdate = false;
      
      // Update Google info if not set
      if (!user.googleId) {
        user.googleId = googleUser.id;
        user.authMethod = user.authMethod || 'google';
        needsUpdate = true;
      }
      
      // Upgrade waitlist user if they now have a valid access code
      if (hasValidCode && user.status === 'waitlist') {
        user.status = 'active';
        user.accessCode = accessCode;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await c.env.SESSIONS.put(userKey, JSON.stringify(user));
      }
    } else {
      // New user - create account
      isNewUser = true;
      const userId = crypto.randomUUID();
      user = {
        id: userId,
        email: normalizedEmail,
        name: googleUser.name || normalizedEmail.split('@')[0],
        googleId: googleUser.id,
        authMethod: 'google',
        picture: googleUser.picture,
        createdAt: new Date().toISOString(),
        status: hasValidCode ? 'active' : 'waitlist',
        accessCode: accessCode || null,
        assessmentCompleted: false,
        botName: 'SoulPrint'
      };
      await c.env.SESSIONS.put(userKey, JSON.stringify(user));
      
      // Log signup
      await logSignup(c.env, {
        email: normalizedEmail,
        method: 'google',
        status: user.status,
        accessCode: accessCode || null,
        isNew: true
      });
    }
    
    // Create session token
    const token = crypto.randomUUID();
    await c.env.SESSIONS.put(`session:${token}`, JSON.stringify({ userId: user.id, email: normalizedEmail }), {
      expirationTtl: 60 * 60 * 24 * 7 // 7 days
    });
    
    // Redirect based on user state
    // New users or users who haven't completed assessment → go to assessment (signup flow)
    // Returning users with completed assessment → go to chat
    if (!user.assessmentCompleted) {
      // Go to signup flow to complete assessment
      return c.redirect(`/#signup?token=${token}&step=2`);
    }
    // Assessment done - go to chat (or waitlist message if on waitlist)
    if (user.status === 'waitlist') {
      return c.redirect(`/#chat?token=${token}&waitlist=true`);
    }
    return c.redirect(`/#chat?token=${token}`);
    
  } catch (err) {
    console.error('Google OAuth error:', err);
    return c.redirect('/#login?error=google_auth_error');
  }
});

// ============================================================================

// Unified auth - handles both login and signup
app.post('/api/auth/unified', async (c) => {
  const body = await c.req.json();
  const { email, password, accessCode } = body;
  
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const userKey = `user:${normalizedEmail}`;
  const existingUserJson = await c.env.SESSIONS.get(userKey);
  
  // Check if access code is valid
  const code = (accessCode || '').trim().toUpperCase();
  const hasValidCode = code && VALID_ACCESS_CODES.some(
    validCode => validCode.toUpperCase() === code
  );
  
  let user;
  let isNewUser = false;
  
  if (existingUserJson) {
    // Existing user - verify password
    user = JSON.parse(existingUserJson);
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return c.json({ error: 'Invalid password' }, 401);
    }
    // If they provided a valid access code and are on waitlist, upgrade them
    if (hasValidCode && user.status === 'waitlist') {
      user.status = 'active';
      user.accessCode = code;
      await c.env.SESSIONS.put(userKey, JSON.stringify(user));
    }
  } else {
    // New user - create account
    isNewUser = true;
    const userId = crypto.randomUUID();
    user = {
      id: userId,
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0],
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      status: hasValidCode ? 'active' : 'waitlist',
      accessCode: code || null,
      assessmentCompleted: false,
      botName: 'SoulPrint'
    };
    await c.env.SESSIONS.put(userKey, JSON.stringify(user));
    
    // Log signup
    await logSignup(c.env, {
      email: normalizedEmail,
      method: 'email',
      status: user.status,
      accessCode: code || null,
      isNew: true
    });
  }
  
  // Create session token
  const token = crypto.randomUUID();
  await c.env.SESSIONS.put(`session:${token}`, JSON.stringify({ userId: user.id, email: normalizedEmail }), {
    expirationTtl: 60 * 60 * 24 * 7
  });
  
  return c.json({
    success: true,
    token,
    isNewUser,
    assessmentCompleted: user.assessmentCompleted || false,
    status: user.status,
    user: { id: user.id, email: user.email, name: user.name }
  });
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
  
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const userKey = `user:${normalizedEmail}`;
  const userJson = await c.env.SESSIONS.get(userKey);
  if (!userJson) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  const user = JSON.parse(userJson);
  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  const token = crypto.randomUUID();
  await c.env.SESSIONS.put(`session:${token}`, JSON.stringify({ userId: user.id, email: normalizedEmail }), {
    expirationTtl: 60 * 60 * 24 * 7
  });
  
  // Build workerUrl from telegram bot info
  const workerUrl = user.telegramBotToken ? 'https://soulprintengine.ai' : undefined;
  
  return c.json({ 
    success: true,
    token,
    email: normalizedEmail,
    clientName: user.name,
    botName: user.botName || 'SoulPrint',
    workerUrl,
    telegramBotUrl: user.telegramBotUrl,
    user: { id: user.id, email: normalizedEmail, name: user.name }
  });
});

app.get('/api/auth/me', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const userJson = await c.env.SESSIONS.get(`user:${user.email}`);
  if (!userJson) return c.json({ error: 'User not found' }, 404);
  
  const userData = JSON.parse(userJson);
  return c.json({ 
    user: { 
      id: userData.id, 
      email: userData.email, 
      name: userData.name 
    },
    assessmentCompleted: userData.assessmentCompleted || false,
    status: userData.status || 'waitlist'
  });
});

app.post('/api/auth/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    await c.env.SESSIONS.delete(`session:${authHeader.slice(7)}`);
  }
  return c.json({ success: true });
});

// Request password reset - generates reset token
app.post('/api/auth/forgot-password', async (c) => {
  const { email } = await c.req.json();
  
  if (!email) {
    return c.json({ error: 'Email required' }, 400);
  }
  
  const normalizedEmail = email.toLowerCase().trim();
  const userKey = `user:${normalizedEmail}`;
  const userJson = await c.env.SESSIONS.get(userKey);
  
  // Always return success to prevent email enumeration
  if (!userJson) {
    return c.json({ success: true, message: 'If an account exists, a reset link will be sent.' });
  }
  
  // Generate reset token (expires in 1 hour)
  const resetToken = crypto.randomUUID();
  await c.env.SESSIONS.put(`reset:${resetToken}`, normalizedEmail, {
    expirationTtl: 60 * 60 // 1 hour
  });
  
  // TODO: Send email with reset link
  // For now, log the reset URL (in production, you'd email this)
  const resetUrl = `https://soulprintengine.ai/#reset-password?token=${resetToken}`;
  console.log(`Password reset requested for ${normalizedEmail}: ${resetUrl}`);
  
  return c.json({ 
    success: true, 
    message: 'If an account exists, a reset link will be sent.',
    // Remove this in production - only for testing
    _debug_resetUrl: resetUrl
  });
});

// Reset password using token
app.post('/api/auth/reset-password', async (c) => {
  const { token, newPassword } = await c.req.json();
  
  if (!token || !newPassword) {
    return c.json({ error: 'Token and new password required' }, 400);
  }
  
  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }
  
  // Look up the reset token
  const email = await c.env.SESSIONS.get(`reset:${token}`);
  if (!email) {
    return c.json({ error: 'Invalid or expired reset token' }, 400);
  }
  
  // Get the user
  const userKey = `user:${email}`;
  const userJson = await c.env.SESSIONS.get(userKey);
  if (!userJson) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  // Update password
  const user = JSON.parse(userJson);
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date().toISOString();
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  // Delete the reset token
  await c.env.SESSIONS.delete(`reset:${token}`);
  
  // Invalidate all existing sessions for this user (optional security measure)
  // For simplicity, we're not doing this, but you could track sessions per user
  
  return c.json({ success: true, message: 'Password reset successfully' });
});

// ============================================================
// File Storage (Per-User R2 Storage)
// ============================================================

// Helper: Get user ID from auth header
async function getUserFromAuth(c: any): Promise<{ id: string; email: string } | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Email ')) return null;
  
  const email = authHeader.slice(6).toLowerCase().trim();
  const userData = await c.env.SESSIONS.get(`user:${email}`);
  if (!userData) return null;
  
  const user = JSON.parse(userData);
  return { id: user.id, email };
}

// List user's files
app.get('/api/files', async (c) => {
  const user = await getUserFromAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const prefix = `users/${user.id}/files/`;
  const listed = await c.env.SOUL_DATA.list({ prefix, limit: 100 });
  
  const files = listed.objects.map((obj: any) => ({
    name: obj.key.replace(prefix, ''),
    size: obj.size,
    uploaded: obj.uploaded,
  }));
  
  return c.json({ files });
});

// Upload a file
app.post('/api/files/upload', async (c) => {
  const user = await getUserFromAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }
  
  // Limit file size to 10MB
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'File too large (max 10MB)' }, 400);
  }
  
  const key = `users/${user.id}/files/${file.name}`;
  await c.env.SOUL_DATA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  
  return c.json({ 
    success: true, 
    file: { name: file.name, size: file.size } 
  });
});

// Download a file
app.get('/api/files/:filename', async (c) => {
  const user = await getUserFromAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const filename = c.req.param('filename');
  const key = `users/${user.id}/files/${filename}`;
  
  const object = await c.env.SOUL_DATA.get(key);
  if (!object) {
    return c.json({ error: 'File not found' }, 404);
  }
  
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  
  return new Response(object.body, { headers });
});

// Delete a file
app.delete('/api/files/:filename', async (c) => {
  const user = await getUserFromAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const filename = c.req.param('filename');
  const key = `users/${user.id}/files/${filename}`;
  
  await c.env.SOUL_DATA.delete(key);
  return c.json({ success: true });
});

// ============================================================
// Stripe Billing
// ============================================================

// Pricing plans
const PLANS = {
  free: { name: 'Free', messagesPerDay: 10, price: 0 },
  pro: { name: 'Pro', messagesPerDay: -1, price: 999 }, // -1 = unlimited, price in cents
  premium: { name: 'Premium', messagesPerDay: -1, price: 1999 },
};

// Helper: Get user subscription status
async function getUserSubscription(env: Env, userId: string): Promise<{plan: string, active: boolean, stripeCustomerId?: string}> {
  const subJson = await env.SESSIONS.get(`subscription:${userId}`);
  if (!subJson) return { plan: 'free', active: true };
  return JSON.parse(subJson);
}

// Helper: Save user subscription
async function saveUserSubscription(env: Env, userId: string, subscription: any): Promise<void> {
  await env.SESSIONS.put(`subscription:${userId}`, JSON.stringify(subscription));
}

// Helper: Check message quota - DISABLED (everyone unlimited for now)
async function checkMessageQuota(env: Env, userId: string, userEmail?: string): Promise<{allowed: boolean, remaining: number, plan: string}> {
  // Stripe disabled - everyone gets unlimited
  return { allowed: true, remaining: -1, plan: 'unlimited' };
}

// Helper: Increment message usage
async function incrementMessageUsage(env: Env, userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `usage:${userId}:${today}`;
  const usageJson = await env.SESSIONS.get(usageKey);
  const usage = usageJson ? parseInt(usageJson, 10) : 0;
  await env.SESSIONS.put(usageKey, String(usage + 1), {
    expirationTtl: 60 * 60 * 24 * 2 // Expire after 2 days
  });
}

// GET /api/billing/status - Get user's subscription status
app.get('/api/billing/status', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const subscription = await getUserSubscription(c.env, user.id);
  const quota = await checkMessageQuota(c.env, user.id, user.email);
  const plan = PLANS[subscription.plan as keyof typeof PLANS] || PLANS.free;
  
  return c.json({
    plan: subscription.plan,
    planName: plan.name,
    active: subscription.active,
    messagesPerDay: plan.messagesPerDay,
    messagesRemaining: quota.remaining,
    price: plan.price
  });
});

// POST /api/billing/checkout - Create Stripe checkout session
app.post('/api/billing/checkout', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_PRICE_ID) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }
  
  const body = await c.req.json();
  const priceId = body.priceId || c.env.STRIPE_PRICE_ID;
  
  // Get or create Stripe customer
  const subscription = await getUserSubscription(c.env, user.id);
  let customerId = subscription.stripeCustomerId;
  
  if (!customerId) {
    // Create new customer
    const customerRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        email: user.email,
        metadata: { userId: user.id }
      } as any)
    });
    
    if (!customerRes.ok) {
      console.error('Failed to create Stripe customer');
      return c.json({ error: 'Failed to create customer' }, 500);
    }
    
    const customer = await customerRes.json() as any;
    customerId = customer.id;
    
    await saveUserSubscription(c.env, user.id, {
      ...subscription,
      stripeCustomerId: customerId
    });
  }
  
  // Create checkout session
  const origin = new URL(c.req.url).origin;
  const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'customer': customerId,
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': `${origin}/#chat?billing=success`,
      'cancel_url': `${origin}/#chat?billing=cancelled`,
      'metadata[userId]': user.id,
      'metadata[userEmail]': user.email
    } as any)
  });
  
  if (!checkoutRes.ok) {
    const error = await checkoutRes.text();
    console.error('Stripe checkout error:', error);
    return c.json({ error: 'Failed to create checkout' }, 500);
  }
  
  const session = await checkoutRes.json() as any;
  return c.json({ url: session.url, sessionId: session.id });
});

// POST /api/billing/portal - Create Stripe billing portal session
app.post('/api/billing/portal', async (c) => {
  const user = await getUserFromToken(c.env, c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }
  
  const subscription = await getUserSubscription(c.env, user.id);
  if (!subscription.stripeCustomerId) {
    return c.json({ error: 'No billing account' }, 400);
  }
  
  const origin = new URL(c.req.url).origin;
  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'customer': subscription.stripeCustomerId,
      'return_url': `${origin}/#chat/settings`
    } as any)
  });
  
  if (!portalRes.ok) {
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
  
  const portal = await portalRes.json() as any;
  return c.json({ url: portal.url });
});

// POST /api/billing/webhook - Stripe webhook handler
app.post('/api/billing/webhook', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Webhook not configured' }, 500);
  }
  
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }
  
  const body = await c.req.text();
  
  // Simple signature verification (for production, use full Stripe signature verification)
  // This is a simplified version - in production, implement full HMAC verification
  
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid payload' }, 400);
  }
  
  // Handle subscription events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerEmail = session.customer_email || session.customer_details?.email || session.metadata?.userEmail;
      const userId = session.metadata?.userId;
      
      // Update subscription
      if (userId) {
        const sub = await getUserSubscription(c.env, userId);
        await saveUserSubscription(c.env, userId, {
          ...sub,
          plan: 'pro',
          active: true,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
        });
      }
      
      // Also activate the user (skip waitlist)
      if (customerEmail) {
        const userKey = `user:${customerEmail.toLowerCase().trim()}`;
        const userData = await c.env.SESSIONS.get(userKey);
        if (userData) {
          const user = JSON.parse(userData);
          user.status = 'active';
          user.plan = 'pro';
          user.paidAt = new Date().toISOString();
          await c.env.SESSIONS.put(userKey, JSON.stringify(user));
          console.log('User activated via payment:', customerEmail);
        }
      }
      break;
    }
    
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      // Find user by Stripe customer ID
      // In production, maintain a reverse lookup or use subscription metadata
      const status = subscription.status;
      const active = status === 'active' || status === 'trialing';
      
      // Update subscription status (simplified - would need customer->user lookup)
      console.log('Subscription updated:', subscription.id, status);
      break;
    }
    
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('Payment failed for customer:', invoice.customer);
      break;
    }
  }
  
  return c.json({ received: true });
});

// ============================================
// Telegram Bot Pool Integration
// Each user gets their own dedicated bot
// ============================================

import { BOT_POOL, getBotByUsername } from './telegram-bots';

// POST /api/claim-telegram - Assign a bot from the pool to user
app.post('/api/claim-telegram', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Email ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const email = authHeader.slice(6).toLowerCase().trim();
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  
  // Block waitlist users from claiming bots
  if (user.status === 'waitlist') {
    return c.json({ error: 'You are on the waitlist. Please wait for access or enter a valid access code.' }, 403);
  }
  
  // If user already has a bot assigned, return it (use stored URL with token)
  if (user.telegramBotUsername && user.telegramBotToken) {
    // If no token exists yet (legacy), generate one now
    if (!user.telegramLinkToken) {
      user.telegramLinkToken = crypto.randomUUID().slice(0, 12);
      user.telegramBotUrl = `https://t.me/${user.telegramBotUsername}?start=${user.telegramLinkToken}`;
      await c.env.SESSIONS.put(userKey, JSON.stringify(user));
    }
    return c.json({ 
      success: true, 
      telegramBotUrl: user.telegramBotUrl,
      botUsername: user.telegramBotUsername
    });
  }
  
  // Get bot pool state from KV
  const poolStateRaw = await c.env.SESSIONS.get('telegram:bot_pool');
  const poolState: Record<string, string> = poolStateRaw ? JSON.parse(poolStateRaw) : {};
  
  // Find an unclaimed bot
  let assignedBot = null;
  for (const bot of BOT_POOL) {
    if (!poolState[bot.username]) {
      assignedBot = bot;
      poolState[bot.username] = user.id;
      break;
    }
  }
  
  if (!assignedBot) {
    return c.json({ error: 'No bots available. Please try again later.' }, 503);
  }
  
  // Save pool state
  await c.env.SESSIONS.put('telegram:bot_pool', JSON.stringify(poolState));
  
  // Generate secret link token for secure /start verification
  const linkToken = crypto.randomUUID().slice(0, 12);
  
  // Save bot assignment to user
  user.telegramBotUsername = assignedBot.username;
  user.telegramBotToken = assignedBot.token;
  user.telegramLinkToken = linkToken;
  user.telegramBotUrl = `https://t.me/${assignedBot.username}?start=${linkToken}`;
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  // Set up webhook for this bot
  const webhookUrl = `https://soulprintengine.ai/telegram/webhook/${assignedBot.username}`;
  await fetch(`https://api.telegram.org/bot${assignedBot.token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] })
  });
  
  // Set bot display name to user's AI name
  if (user.botName) {
    await fetch(`https://api.telegram.org/bot${assignedBot.token}/setMyName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.botName })
    });
  }
  
  return c.json({ 
    success: true, 
    telegramBotUrl: user.telegramBotUrl,
    botUsername: assignedBot.username
  });
});

// POST /api/update-bot-name - Update the user's AI bot name (also updates Telegram)
app.post('/api/update-bot-name', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Email ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const email = authHeader.slice(6).toLowerCase().trim();
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  const body = await c.req.json() as { botName: string };
  
  if (!body.botName || body.botName.trim().length === 0) {
    return c.json({ error: 'Bot name is required' }, 400);
  }
  
  // Update user's bot name
  user.botName = body.botName.trim();
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  // If user has a Telegram bot, update its display name
  if (user.telegramBotToken) {
    await fetch(`https://api.telegram.org/bot${user.telegramBotToken}/setMyName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.botName })
    });
  }
  
  return c.json({ success: true, botName: user.botName });
});

// POST /api/admin/sync-bot-names - Sync all user bot names to Telegram (admin only)
app.post('/api/admin/sync-bot-names', async (c) => {
  // Simple admin check - require specific header
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const results: { email: string; botName: string; success: boolean; error?: string }[] = [];
  
  // Get all users from KV (list keys starting with "user:")
  const userKeys = await c.env.SESSIONS.list({ prefix: 'user:' });
  
  for (const key of userKeys.keys) {
    const userData = await c.env.SESSIONS.get(key.name);
    if (!userData) continue;
    
    const user = JSON.parse(userData);
    
    // Skip users without a bot or bot name
    if (!user.telegramBotToken || !user.botName) {
      continue;
    }
    
    try {
      const res = await fetch(`https://api.telegram.org/bot${user.telegramBotToken}/setMyName`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.botName })
      });
      const data = await res.json() as { ok: boolean; description?: string };
      
      results.push({
        email: user.email,
        botName: user.botName,
        success: data.ok,
        error: data.ok ? undefined : data.description
      });
    } catch (e) {
      results.push({
        email: user.email,
        botName: user.botName,
        success: false,
        error: String(e)
      });
    }
  }
  
  return c.json({ 
    synced: results.length,
    results 
  });
});

// ============================================================================
// ADMIN USER MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/admin/users - List all users with status
app.get('/api/admin/users', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const userKeys = await c.env.SESSIONS.list({ prefix: 'user:' });
  const users: any[] = [];
  
  for (const key of userKeys.keys) {
    const userData = await c.env.SESSIONS.get(key.name);
    if (!userData) continue;
    const user = JSON.parse(userData);
    users.push({
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status || 'unknown',
      botName: user.botName || null,
      telegramBotUsername: user.telegramBotUsername || null,
      telegramBotUrl: user.telegramBotUrl || null,
      telegramChatId: user.telegramChatId || null,
      telegramUserId: user.telegramUserId || null,
      createdAt: user.createdAt
    });
  }
  
  return c.json({ 
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    waitlist: users.filter(u => u.status === 'waitlist').length,
    withBot: users.filter(u => u.telegramBotUsername).length,
    users 
  });
});

// POST /api/admin/users/:email/activate - Activate a waitlist user
app.post('/api/admin/users/:email/activate', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const email = decodeURIComponent(c.req.param('email')).toLowerCase().trim();
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  user.status = 'active';
  user.activatedAt = new Date().toISOString();
  
  // Initialize workspace if not already done
  if (!user.workspaceInitialized) {
    const workspace = generateWorkspace({
      name: user.name,
      botName: user.botName,
      goal: user.goal,
      assessmentAnswers: user.assessmentAnswers
    });
    
    await c.env.SOUL_DATA.put(`users/${user.id}/SOUL.md`, workspace.soulMd);
    await c.env.SOUL_DATA.put(`users/${user.id}/USER.md`, workspace.userMd);
    await c.env.SOUL_DATA.put(`users/${user.id}/IDENTITY.md`, workspace.identityMd);
    await c.env.SOUL_DATA.put(`users/${user.id}/AGENTS.md`, workspace.agentsMd);
    await c.env.SOUL_DATA.put(`users/${user.id}/MEMORY.md`, workspace.memoryMd);
    user.workspaceInitialized = true;
  }
  
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  return c.json({ 
    success: true, 
    message: `User ${email} activated`,
    user: { email: user.email, status: user.status }
  });
});

// POST /api/admin/users/:email/assign-bot - Assign a telegram bot to user
app.post('/api/admin/users/:email/assign-bot', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const email = decodeURIComponent(c.req.param('email')).toLowerCase().trim();
  const body = await c.req.json();
  const { botUsername } = body;
  
  if (!botUsername) {
    return c.json({ error: 'botUsername required (e.g., soulprint2bot)' }, 400);
  }
  
  // Find the bot in pool
  const bot = getBotByUsername(botUsername);
  if (!bot) {
    return c.json({ error: `Bot ${botUsername} not found in pool` }, 404);
  }
  
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  
  // Check if bot is already assigned to someone else
  const poolStateRaw = await c.env.SESSIONS.get('telegram:bot_pool');
  const poolState: Record<string, string> = poolStateRaw ? JSON.parse(poolStateRaw) : {};
  
  if (poolState[botUsername] && poolState[botUsername] !== user.id) {
    return c.json({ 
      error: `Bot ${botUsername} already assigned to another user`,
      currentOwnerId: poolState[botUsername]
    }, 409);
  }
  
  // Assign bot to user
  poolState[botUsername] = user.id;
  await c.env.SESSIONS.put('telegram:bot_pool', JSON.stringify(poolState));
  
  // Generate secret link token for secure /start verification
  const linkToken = crypto.randomUUID().slice(0, 12);
  
  user.telegramBotUsername = botUsername;
  user.telegramBotToken = bot.token;
  user.telegramLinkToken = linkToken;
  user.telegramBotUrl = `https://t.me/${botUsername}?start=${linkToken}`;
  
  // Also activate user if on waitlist
  if (user.status !== 'active') {
    user.status = 'active';
    user.activatedAt = new Date().toISOString();
  }
  
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  // Set up webhook for this bot
  const webhookUrl = `https://soulprintengine.ai/telegram/webhook/${botUsername}`;
  await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] })
  });
  
  // Set bot display name
  if (user.botName) {
    await fetch(`https://api.telegram.org/bot${bot.token}/setMyName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.botName })
    });
  }
  
  return c.json({ 
    success: true, 
    message: `Bot @${botUsername} assigned to ${email}`,
    telegramBotUrl: user.telegramBotUrl,
    user: { 
      email: user.email, 
      status: user.status,
      botUsername: user.telegramBotUsername 
    }
  });
});

// GET /api/admin/bots - List all bots and their assignment status
app.get('/api/admin/bots', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const poolStateRaw = await c.env.SESSIONS.get('telegram:bot_pool');
  const poolState: Record<string, string> = poolStateRaw ? JSON.parse(poolStateRaw) : {};
  
  const bots = BOT_POOL.map(bot => {
    const assignedUserId = poolState[bot.username] || null;
    return {
      username: bot.username,
      url: `https://t.me/${bot.username}`,
      assigned: !!assignedUserId,
      assignedUserId
    };
  });
  
  return c.json({
    total: bots.length,
    available: bots.filter(b => !b.assigned).length,
    assigned: bots.filter(b => b.assigned).length,
    bots
  });
});

// POST /api/admin/users/:email/unassign-bot - Remove bot from user
app.post('/api/admin/users/:email/unassign-bot', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const email = decodeURIComponent(c.req.param('email')).toLowerCase().trim();
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  const botUsername = user.telegramBotUsername;
  
  if (!botUsername) {
    return c.json({ error: 'User has no bot assigned' }, 400);
  }
  
  // Remove from pool state
  const poolStateRaw = await c.env.SESSIONS.get('telegram:bot_pool');
  const poolState: Record<string, string> = poolStateRaw ? JSON.parse(poolStateRaw) : {};
  delete poolState[botUsername];
  await c.env.SESSIONS.put('telegram:bot_pool', JSON.stringify(poolState));
  
  // Clear user bot fields
  delete user.telegramBotUsername;
  delete user.telegramBotToken;
  delete user.telegramBotUrl;
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  return c.json({ 
    success: true, 
    message: `Bot @${botUsername} unassigned from ${email}`,
    botUsername
  });
});

// POST /api/admin/users/:email/link-telegram - Link a Telegram chat to user
app.post('/api/admin/users/:email/link-telegram', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const email = decodeURIComponent(c.req.param('email')).toLowerCase();
  const body = await c.req.json() as { chatId: string };
  
  if (!body.chatId) {
    return c.json({ error: 'chatId required' }, 400);
  }
  
  const userKey = `user:${email}`;
  const userData = await c.env.SESSIONS.get(userKey);
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const user = JSON.parse(userData);
  user.telegramChatId = body.chatId;
  await c.env.SESSIONS.put(userKey, JSON.stringify(user));
  
  return c.json({ 
    success: true, 
    message: `Telegram chat ${body.chatId} linked to ${email}`,
    telegramChatId: body.chatId
  });
});

// GET /api/admin/audit/:userId - Get audit logs for a user
app.get('/api/admin/audit/:userId', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const userId = c.req.param('userId');
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
  const key = `audit/${userId}/${date}.jsonl`;
  
  const obj = await c.env.SOUL_DATA.get(key);
  if (!obj) {
    return c.json({ events: [], date, message: 'No audit logs for this date' });
  }
  
  const text = await obj.text();
  const events = text.trim().split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  
  return c.json({ events, date, count: events.length });
});

// GET /api/admin/audit-summary - Get audit summary across all users (last 24h)
app.get('/api/admin/audit-summary', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== 'archeforge-admin-2026') {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const date = new Date().toISOString().split('T')[0];
  const prefix = `audit/`;
  const listed = await c.env.SOUL_DATA.list({ prefix, limit: 100 });
  
  // Filter for today's logs
  const todayLogs = listed.objects.filter((obj: any) => obj.key.includes(date));
  
  const summary: Record<string, { count: number; tools: Record<string, number> }> = {};
  
  for (const obj of todayLogs) {
    const data = await c.env.SOUL_DATA.get(obj.key);
    if (!data) continue;
    
    const text = await data.text();
    const events = text.trim().split('\n').filter(Boolean);
    
    // Extract userId from key: audit/{userId}/{date}.jsonl
    const userId = obj.key.split('/')[1];
    
    if (!summary[userId]) {
      summary[userId] = { count: 0, tools: {} };
    }
    
    for (const line of events) {
      try {
        const event = JSON.parse(line);
        summary[userId].count++;
        summary[userId].tools[event.toolName] = (summary[userId].tools[event.toolName] || 0) + 1;
      } catch {}
    }
  }
  
  return c.json({ date, summary, totalUsers: Object.keys(summary).length });
});

// ============================================================================

// POST /telegram/webhook/:botUsername - Handle incoming Telegram messages for specific bot
// PRIMARY HANDLER - Processes everything directly via Bedrock (no container forwarding)
app.post('/telegram/webhook/:botUsername', async (c) => {
  const botUsername = c.req.param('botUsername');
  const bot = getBotByUsername(botUsername);
  
  if (!bot) {
    console.error(`Unknown bot: ${botUsername}`);
    return c.json({ ok: true });
  }
  
  const botToken = bot.token;
  const update = await c.req.json();
  const message = update.message;
  
  if (!message) {
    return c.json({ ok: true });
  }
  
  const chatId = message.chat.id;
  const fromUser = message.from;
  const env = c.env;
  
  // Handle voice messages and audio files - transcribe them
  let text = message.text || '';
  const audioFileId = message.voice?.file_id || message.audio?.file_id;
  
  // Also handle document uploads that are audio files (mp3, wav, m4a, etc.)
  if (!audioFileId && message.document) {
    const mimeType = message.document.mime_type || '';
    if (mimeType.startsWith('audio/') || mimeType === 'video/mp4') {
      const docFileId = message.document.file_id;
      try {
        await sendTypingAction(botToken, chatId);
        await sendTelegramMessage(botToken, chatId, '🎧 Transcribing audio file...');
        text = await transcribeVoiceMessage(botToken, docFileId, env);
        console.log(`[WEBHOOK] Transcribed audio document: ${text.substring(0, 100)}...`);
      } catch (e) {
        console.error('[WEBHOOK] Audio document transcription failed:', e);
        await sendTelegramMessage(botToken, chatId, '❌ Sorry, I couldn\'t transcribe that audio file. Please try a different format (MP3, WAV, M4A work best).');
        return c.json({ ok: true });
      }
    }
  }
  
  if (audioFileId) {
    try {
      await sendTypingAction(botToken, chatId);
      if (message.audio) {
        await sendTelegramMessage(botToken, chatId, '🎧 Transcribing audio...');
      }
      text = await transcribeVoiceMessage(botToken, audioFileId, env);
      console.log(`[WEBHOOK] Transcribed voice/audio: ${text}`);
    } catch (e) {
      console.error('[WEBHOOK] Voice transcription failed:', e);
      await sendTelegramMessage(botToken, chatId, '❌ Sorry, I couldn\'t understand that audio. Please try again or type your message.');
      return c.json({ ok: true });
    }
  }
  
  // Skip if no text content
  if (!text) {
    return c.json({ ok: true });
  }
  
  // Find user who owns this bot
  const users = await env.SESSIONS.list({ prefix: 'user:' });
  let foundUser: any = null;
  let foundUserKey = '';
  
  console.log(`[WEBHOOK] Looking for bot owner: ${botUsername}`);
  
  for (const key of users.keys) {
    const userData = await env.SESSIONS.get(key.name);
    if (userData) {
      const user = JSON.parse(userData);
      if (user.telegramBotUsername === botUsername) {
        foundUser = user;
        foundUserKey = key.name;
        break;
      }
    }
  }
  
  if (!foundUser) {
    console.log(`[WEBHOOK] No user found for bot ${botUsername}`);
    await sendTelegramMessage(botToken, chatId, 
      `👋 This bot isn't set up yet. Visit soulprintengine.ai to get started.`
    );
    return c.json({ ok: true });
  }
  
  console.log(`[WEBHOOK] Found user: ${foundUser.email}`);
  
  // Handle /start command - link Telegram chat to user (with token verification)
  if (text === '/start' || text.startsWith('/start ')) {
    const alreadyLinked = foundUser.telegramChatId && String(foundUser.telegramChatId) === String(chatId);
    
    if (!alreadyLinked) {
      const providedToken = text.startsWith('/start ') ? text.slice(7).trim() : '';
      const expectedToken = foundUser.telegramLinkToken;
      
      if (!providedToken) {
        console.log(`[WEBHOOK] /start without token from chatId=${chatId}`);
        await sendTelegramMessage(botToken, chatId, 
          `❌ This bot belongs to someone else.\n\nGet your own AI at soulprintengine.ai`
        );
        return c.json({ ok: true });
      }
      
      if (providedToken !== expectedToken) {
        console.log(`[WEBHOOK] Invalid token: got="${providedToken}", expected="${expectedToken}"`);
        await sendTelegramMessage(botToken, chatId, 
          `❌ Invalid link. Please use the link from your SoulPrint dashboard.`
        );
        return c.json({ ok: true });
      }
      
      console.log(`[WEBHOOK] Valid token, linking chatId=${chatId} to user ${foundUser.email}`);
    }
    
    // Link the chat
    foundUser.telegramChatId = chatId;
    foundUser.telegramUserId = fromUser.id;
    foundUser.telegramUsername = fromUser.username;
    await env.SESSIONS.put(foundUserKey, JSON.stringify(foundUser));
    
    // Create V2 workspace if not exists
    const hasV2 = await hasV2Workspace(env, foundUser.id);
    if (!hasV2) {
      await createV2Workspace(env, foundUser.id, foundUser.botName || 'Asset', foundUser.email?.split('@')[0] || 'User');
      console.log(`[WEBHOOK] Created V2 workspace on /start for user ${foundUser.id}`);
    }
    
    await sendTelegramMessage(botToken, chatId, 
      `🎉 Connected! I'm ${foundUser.botName || 'your SoulPrint'}.\n\nSend me a message anytime and I'll respond based on everything I know about you.`
    );
    return c.json({ ok: true });
  }
  
  // Handle /upgrade command - migrate to V2 workspace
  if (text === '/upgrade') {
    const hasV2 = await hasV2Workspace(env, foundUser.id);
    if (hasV2) {
      await sendTelegramMessage(botToken, chatId, `✅ You're already on V2! Progressive loading is active.`);
    } else {
      await createV2Workspace(env, foundUser.id, foundUser.botName || 'Asset', foundUser.email?.split('@')[0] || 'User');
      await sendTelegramMessage(botToken, chatId, `🚀 Upgraded to V2!\n\n**What's new:**\n• Progressive context loading (faster, smarter)\n• Structured memory (facts, experiences, decisions)\n• Voice profile for content creation\n• Module-based organization\n\nYour AI just got better at remembering.`);
    }
    return c.json({ ok: true });
  }
  
  // Handle /status command - show workspace info
  if (text === '/status') {
    const hasV2 = await hasV2Workspace(env, foundUser.id);
    const status = hasV2 ? '✅ V2 (Progressive Loading)' : '📦 V1 (Legacy)';
    await sendTelegramMessage(botToken, chatId, `**SoulPrint Status**\n\n🤖 AI Name: ${foundUser.botName || 'Not set'}\n📧 User: ${foundUser.email}\n🧠 Workspace: ${status}\n🔧 Engine: Direct Bedrock Opus 4.6\n\n${hasV2 ? 'Progressive loading active!' : 'Send /upgrade to get V2 features.'}`);
    return c.json({ ok: true });
  }
  
  // Check if this chat is linked to the user
  if (String(foundUser.telegramChatId) !== String(chatId)) {
    console.log(`[WEBHOOK] Chat not linked: stored=${foundUser.telegramChatId}, received=${chatId}`);
    await sendTelegramMessage(botToken, chatId, 
      `❌ This chat isn't linked. Send /start to connect.`
    );
    return c.json({ ok: true });
  }
  
  // Send typing indicator
  await sendTypingAction(botToken, chatId);
  console.log(`[WEBHOOK] Processing message for ${foundUser.email}: ${text.slice(0, 50)}...`);
  
  // Process in background - DIRECT BEDROCK (no container forwarding)
  c.executionCtx.waitUntil(processDirectBedrock(env, foundUser, text, botToken, chatId));
  
  return c.json({ ok: true });
});

// ============================================================================
// DIRECT BEDROCK PROCESSING - Primary handler for all Telegram messages
// ============================================================================
async function processDirectBedrock(
  env: Env,
  foundUser: any,
  text: string,
  botToken: string,
  chatId: number
): Promise<void> {
  const opikTraceId = await createOpikTrace(foundUser.id, text, 'telegram');
  const aiStartTime = Date.now();
  
  try {
    // Load workspace context (V2 progressive or V1 full)
    const isV2 = await hasV2Workspace(env, foundUser.id);
    let systemPromptBase: string;
    
    if (isV2) {
      systemPromptBase = await getProgressiveContext(env, foundUser.id, text);
      console.log(`[BEDROCK] V2 workspace - progressive context (${systemPromptBase.length} chars)`);
    } else {
      const workspace = await getUserWorkspace(env, foundUser.id);
      systemPromptBase = workspace.soul;
      if (workspace.identity) systemPromptBase += `\n\n${workspace.identity}`;
      if (workspace.user) systemPromptBase += `\n\n## About Your Human\n${workspace.user}`;
      if (workspace.agents) systemPromptBase += `\n\n${workspace.agents}`;
      if (workspace.tools && !workspace.tools.includes('(Nothing saved yet)')) {
        systemPromptBase += `\n\n${workspace.tools}`;
      }
      systemPromptBase += `\n\n## Memory\n${workspace.memory}`;
      console.log(`[BEDROCK] V1 workspace - full context (${systemPromptBase.length} chars)`);
    }
    
    // Load skills and core facts
    const skills = await loadSkills(env);
    const skillsPrompt = formatSkillsForPrompt(skills);
    const coreFacts = await loadCoreFacts(env, foundUser.id);
    const coreFactsPrompt = formatCoreFactsForPrompt(coreFacts);
    console.log(`[BEDROCK] Loaded ${skills.length} skills, ${coreFacts.length} core facts`);
    
    // Load conversation history
    const historyKey = `telegram:history:${foundUser.id}`;
    const summaryKey = `telegram:summary:${foundUser.id}`;
    const historyJson = await env.SESSIONS.get(historyKey);
    const existingSummary = await env.SESSIONS.get(summaryKey);
    let conversationHistory: any[] = [];
    try {
      conversationHistory = historyJson ? JSON.parse(historyJson) : [];
    } catch { conversationHistory = []; }
    
    // Add current user message
    conversationHistory.push({ role: 'user', content: [{ text }] });
    
    // Compaction: summarize old messages when history gets long
    let contextSummary = existingSummary || '';
    if (conversationHistory.length > COMPACTION_THRESHOLD) {
      console.log(`[BEDROCK] Compacting ${conversationHistory.length} messages...`);
      const compacted = await compactConversationHistory(
        conversationHistory, env, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!
      );
      if (compacted.summary) {
        contextSummary = compacted.summary + (existingSummary ? `\n\n[Earlier]\n${existingSummary}` : '');
        if (contextSummary.length > 6000) contextSummary = contextSummary.slice(0, 6000) + '...';
        await env.SESSIONS.put(summaryKey, contextSummary, { expirationTtl: 86400 * 30 });
        conversationHistory = compacted.messages;
      }
    }
    
    // Save history immediately
    await env.SESSIONS.put(historyKey, JSON.stringify(conversationHistory.slice(-50)), {
      expirationTtl: 86400 * 7
    });
    
    // Build full system prompt
    let systemPrompt = systemPromptBase;
    if (coreFactsPrompt) systemPrompt += `\n\n${coreFactsPrompt}`;
    if (contextSummary) systemPrompt += `\n\n## Earlier Conversation Context\n${contextSummary}`;
    if (skillsPrompt) systemPrompt += `\n\n${skillsPrompt}`;
    
    systemPrompt += `\n\nYou are chatting via Telegram with your human. You ARE ${foundUser.botName || 'this user\'s AI'} - embody your personality! Keep responses concise but helpful.

## CRITICAL: Take Action Immediately
When asked to build, create, or deploy something:
- **DO NOT** just say "I'll build this" - actually START building
- **USE TOOLS** in your FIRST response - don't wait
- For websites: use deploy_website tool immediately with HTML/CSS/JS
- For images: use generate_image tool immediately
- Brief acknowledgment is OK, but INCLUDE tool calls

Tool speeds: web_search/save_file (fast) | generate_image (30-60s) | generate_video (2-5min) | deploy_website (30-60s)`;
    
    // Build messages for Bedrock
    let bedrockMessages: any[] = conversationHistory.map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? [{ text: m.content }] : m.content
    }));
    
    // Call Bedrock Opus 4.6 with tool loop
    const region = 'us-east-1';
    const modelId = 'global.anthropic.claude-opus-4-6-v1';
    const converseUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;
    
    let finalReply = '';
    const maxIterations = 5;
    
    // Detect if this needs tools
    const buildKeywords = /build|create|make|deploy|generate|design|code|website|app|image|video|search|find|weather|remember/i;
    const shouldForceTools = buildKeywords.test(text);
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`[BEDROCK] Iteration ${iteration + 1}, ${bedrockMessages.length} messages`);
      await sendTypingAction(botToken, chatId);
      
      const requestBody = JSON.stringify({
        messages: bedrockMessages,
        system: [{ text: systemPrompt }],
        toolConfig: { 
          tools: TOOLS_BEDROCK,
          ...(shouldForceTools && iteration === 0 && { toolChoice: { any: {} } })
        },
        inferenceConfig: { maxTokens: 4096, temperature: 0.7 }
      });
      
      const headers = await signAWSRequest('POST', converseUrl, requestBody, 'bedrock', region, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!);
      let aiResponse = await fetch(converseUrl, { method: 'POST', headers, body: requestBody });
      
      // Retry with backoff if rate limited
      if (!aiResponse.ok && [429, 503, 529].includes(aiResponse.status)) {
        console.log(`[BEDROCK] Rate limited (${aiResponse.status}), retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        const retryHeaders = await signAWSRequest('POST', converseUrl, requestBody, 'bedrock', region, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!);
        aiResponse = await fetch(converseUrl, { method: 'POST', headers: retryHeaders, body: requestBody });
        
        // Fallback to Sonnet if still failing
        if (!aiResponse.ok) {
          console.log(`[BEDROCK] Falling back to Sonnet...`);
          const fallbackUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/global.anthropic.claude-sonnet-4-20250514-v1:0/converse`;
          const fallbackHeaders = await signAWSRequest('POST', fallbackUrl, requestBody, 'bedrock', region, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!);
          aiResponse = await fetch(fallbackUrl, { method: 'POST', headers: fallbackHeaders, body: requestBody });
        }
      }
      
      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`[BEDROCK] Error: ${errorText}`);
        throw new Error(`Bedrock error: ${aiResponse.status}`);
      }
      
      const aiData = await aiResponse.json() as any;
      const stopReason = aiData.stopReason;
      const outputMessage = aiData.output?.message;
      
      console.log(`[BEDROCK] stopReason: ${stopReason}`);
      
      // Handle tool use
      if (stopReason === 'tool_use' && outputMessage) {
        bedrockMessages.push(outputMessage);
        
        const toolResults: any[] = [];
        const toolUseBlocks = outputMessage.content.filter((c: any) => c.toolUse);
        
        for (const toolBlock of toolUseBlocks) {
          const toolName = toolBlock.toolUse.name;
          const toolInput = toolBlock.toolUse.input;
          const toolId = toolBlock.toolUse.toolUseId;
          
          console.log(`[TOOL] Executing: ${toolName}`);
          
          // Execute tool with audit logging
          const result = await executeTelegramTool(
            toolName, toolInput, env, foundUser.id, botToken, chatId
          );
          
          console.log(`[TOOL] Result: ${result.substring(0, 100)}...`);
          toolResults.push({ toolResult: { toolUseId: toolId, content: [{ text: result }] } });
        }
        
        bedrockMessages.push({ role: 'user', content: toolResults });
        continue;
      }
      
      // Extract final text response
      if (outputMessage) {
        for (const block of outputMessage.content) {
          if (block.text) finalReply += block.text;
        }
      }
      break;
    }
    
    if (finalReply) {
      console.log(`[BEDROCK] Sending reply: ${finalReply.substring(0, 100)}...`);
      await sendTelegramMessage(botToken, chatId, finalReply);
      
      // Save to history
      conversationHistory.push({ role: 'assistant', content: [{ text: finalReply }] });
      if (conversationHistory.length > 50) conversationHistory = conversationHistory.slice(-50);
      await env.SESSIONS.put(historyKey, JSON.stringify(conversationHistory), {
        expirationTtl: 86400 * 7
      });
      
      // Extract core facts (async, non-blocking)
      extractCoreFacts(text, finalReply, coreFacts, env, env.AWS_ACCESS_KEY_ID!, env.AWS_SECRET_ACCESS_KEY!)
        .then(async (newFacts) => {
          if (newFacts.length > 0) {
            await storeCoreFacts(env, foundUser.id, newFacts);
            console.log(`[BEDROCK] Extracted ${newFacts.length} new core facts`);
          }
        }).catch(err => console.error('[BEDROCK] Fact extraction error:', err));
      
      // Log to Opik
      const aiDuration = Date.now() - aiStartTime;
      logOpikLLMSpan(opikTraceId, 'opus-4.6', text, finalReply, 
        { inputTokens: Math.round(text.length / 4), outputTokens: Math.round(finalReply.length / 4) },
        aiDuration
      ).catch(() => {});
      completeOpikTrace(opikTraceId, finalReply).catch(() => {});
    }
    
  } catch (err: any) {
    console.error('[BEDROCK] Error:', err?.message || err);
    
    let errorMsg = `⚠️ Error: ${err?.message?.substring(0, 100) || 'Unknown error'}`;
    if (err?.message?.includes('429') || err?.message?.includes('rate')) {
      errorMsg = `⚠️ Rate limited. Wait 30 seconds and try again.`;
    } else if (err?.message?.includes('timeout')) {
      errorMsg = `⚠️ Request timed out. Try a simpler message.`;
    }
    
    await sendTelegramMessage(botToken, chatId, errorMsg);
    completeOpikTrace(opikTraceId, '', err?.message || 'Unknown error').catch(() => {});
  }
}

// ============================================================================
// TELEGRAM TOOL EXECUTION - Execute tools and send media back to chat
// ============================================================================
async function executeTelegramTool(
  toolName: string,
  toolInput: Record<string, any>,
  env: Env,
  userId: string,
  botToken: string,
  chatId: number
): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Special handling for tools that send media to Telegram
    switch (toolName) {
      case 'generate_image': {
        const model = toolInput.model || 'nano-banana';
        const ar = toolInput.aspect_ratio || '1:1';
        await sendTelegramMessage(botToken, chatId, `🎨 Generating image with ${model}... (30-60s)`);
        const result = await executeTool(toolName, toolInput, env, userId);
        if (result.startsWith('http')) {
          await sendTelegramPhoto(botToken, chatId, result, toolInput.prompt?.substring(0, 100));
          return `Image generated and sent: ${result}`;
        }
        return result;
      }
      
      case 'generate_video': {
        const model = toolInput.model || 'veo3_fast';
        await sendTelegramMessage(botToken, chatId, `🎬 Generating video with ${model}... (2-5 min)`);
        const result = await executeTool(toolName, toolInput, env, userId);
        if (result.startsWith('http')) {
          await sendTelegramVideo(botToken, chatId, result);
          return `Video generated and sent: ${result}`;
        }
        return result;
      }
      
      case 'deploy_website': {
        await sendTelegramMessage(botToken, chatId, `🚀 Deploying ${toolInput.name} to Vercel...`);
        const result = await executeTool(toolName, toolInput, env, userId);
        if (result.startsWith('http')) {
          await sendTelegramMessage(botToken, chatId, `✅ **Site is LIVE!**\n\n🔗 ${result}`);
        }
        return result;
      }
      
      case 'text_to_speech': {
        await sendTelegramMessage(botToken, chatId, `🔊 Generating speech...`);
        const result = await executeTool(toolName, toolInput, env, userId);
        if (result.startsWith('http')) {
          await sendTelegramAudio(botToken, chatId, result);
          return `Audio generated and sent: ${result}`;
        }
        return result;
      }
      
      case 'web_search': {
        await sendTelegramMessage(botToken, chatId, `🔍 Searching: ${toolInput.query}...`);
        return await executeTool(toolName, toolInput, env, userId);
      }
      
      case 'analyze_url': {
        await sendTelegramMessage(botToken, chatId, `🔍 Analyzing ${toolInput.url}...`);
        return await executeTool(toolName, toolInput, env, userId);
      }
      
      case 'browse_website': {
        await sendTelegramMessage(botToken, chatId, `🌐 Browsing ${toolInput.url}...`);
        const result = await executeTool(toolName, toolInput, env, userId);
        if (toolInput.action === 'screenshot' && result.startsWith('http')) {
          await sendTelegramPhoto(botToken, chatId, result, `Screenshot of ${toolInput.url}`);
        }
        return result;
      }
      
      case 'run_code': {
        await sendTelegramMessage(botToken, chatId, `⚙️ Running ${toolInput.language} code...`);
        return await executeTool(toolName, toolInput, env, userId);
      }
      
      case 'shell_command': {
        await sendTelegramMessage(botToken, chatId, `⚡ Running command...`);
        return await executeTool(toolName, toolInput, env, userId);
      }
      
      case 'send_email': {
        await sendTelegramMessage(botToken, chatId, `📧 Sending email to ${toolInput.to}...`);
        return await executeTool(toolName, toolInput, env, userId);
      }
      
      default:
        // All other tools - execute directly
        return await executeTool(toolName, toolInput, env, userId);
    }
    
  } finally {
    // Audit logging
    const durationMs = Date.now() - startTime;
    logAuditEvent(env, {
      timestamp: new Date().toISOString(),
      eventId: `evt_${crypto.randomUUID().substring(0, 8)}`,
      userId,
      toolName,
      toolInput: redactSensitiveInput(toolInput),
      channel: 'telegram',
      result: { success: true, summary: 'executed', durationMs }
    }).catch(() => {});
  }
}


// Helper to send typing indicator
async function sendTypingAction(botToken: string, chatId: number) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action: 'typing'
    })
  });
}

// Helper to get voice file and transcribe it
async function transcribeVoiceMessage(botToken: string, fileId: string, env: any): Promise<string> {
  // Get file path from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } };
  
  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error('Could not get voice file');
  }
  
  // Download the file
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
  const audioRes = await fetch(fileUrl);
  const audioBuffer = await audioRes.arrayBuffer();
  
  // Use OpenAI Whisper for transcription
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
  formData.append('model', 'whisper-1');
  
  const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: formData
  });
  
  const transcription = await transcribeRes.json() as { text?: string; error?: any };
  
  if (transcription.error || !transcription.text) {
    throw new Error('Transcription failed');
  }
  
  return transcription.text;
}

// Helper to send Telegram messages
async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });
}

// Helper to send Telegram photos
async function sendTelegramPhoto(botToken: string, chatId: number, photoUrl: string, caption?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption?.substring(0, 200) || undefined
    })
  });
}

// Helper to send Telegram videos
async function sendTelegramVideo(botToken: string, chatId: number, videoUrl: string, caption?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption: caption?.substring(0, 200) || undefined
    })
  });
}

// Helper to send Telegram audio
async function sendTelegramAudio(botToken: string, chatId: number, audioUrl: string, caption?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      audio: audioUrl,
      caption: caption?.substring(0, 200) || undefined
    })
  });
}

// GET /api/telegram/setup - Set up webhooks for all bots in pool
app.get('/api/telegram/setup', async (c) => {
  const results: Record<string, any> = {};
  
  for (const bot of BOT_POOL) {
    const webhookUrl = `https://soulprintengine.ai/telegram/webhook/${bot.username}`;
    
    try {
      const res = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message']
        })
      });
      
      results[bot.username] = await res.json();
    } catch (err) {
      results[bot.username] = { error: String(err) };
    }
  }
  
  return c.json({ 
    success: true, 
    bots: results,
    count: BOT_POOL.length
  });
});

// Serve static assets
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
