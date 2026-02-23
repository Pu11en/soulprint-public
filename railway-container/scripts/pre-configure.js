#!/usr/bin/env node
/**
 * Pre-configure OpenClaw for SoulPrint
 * Creates openclaw.json with AWS Bedrock settings
 * Skips the setup wizard entirely
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENCLAW_DIR = '/data/.openclaw';
const CONFIG_PATH = `${OPENCLAW_DIR}/openclaw.json`;
const WORKSPACE_DIR = `${OPENCLAW_DIR}/workspace`;

// Only run if not already configured
if (fs.existsSync(CONFIG_PATH)) {
  console.log('✓ Already configured, skipping pre-configure');
  process.exit(0);
}

// Check required env vars
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'soulprint-gateway-token';

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.log('⚠ AWS credentials not set — falling back to setup wizard');
  process.exit(0);
}

console.log('🔧 Pre-configuring OpenClaw with AWS Bedrock...');

// Create directories
fs.mkdirSync(OPENCLAW_DIR, { recursive: true });
fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
fs.mkdirSync(`${OPENCLAW_DIR}/agents/main/agent`, { recursive: true });

// Create openclaw.json config
const config = {
  "$schema": "https://openclaw.dev/schema/config.json",
  "version": "1.0.0",
  "gateway": {
    "enabled": true,
    "bind": "loopback",
    "port": 18789,
    "auth": "token",
    "token": "${OPENCLAW_GATEWAY_TOKEN}"
  },
  "agents": {
    "main": {
      "enabled": true,
      "model": "aws-bedrock/anthropic.claude-opus-4-5-20250514-v1:0",
      "provider": "aws-bedrock",
      "maxTokens": 8192,
      "temperature": 0.7
    }
  },
  "providers": {
    "aws-bedrock": {
      "enabled": true,
      "region": "${AWS_REGION}",
      "accessKeyId": "${AWS_ACCESS_KEY_ID}",
      "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}"
    }
  },
  "channels": {},
  "plugins": {
    "entries": {}
  },
  "commands": {
    "restart": true
  },
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {}
    }
  }
};

// Add Telegram if token is set
if (process.env.TELEGRAM_BOT_TOKEN) {
  config.channels.telegram = {
    enabled: true,
    botToken: "${TELEGRAM_BOT_TOKEN}",
    dmPolicy: "open",
    groupPolicy: "allowlist"
  };
  config.plugins.entries.telegram = { enabled: true };
  console.log('✓ Telegram channel configured');
}

// Write config
fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
console.log('✓ Created openclaw.json with AWS Bedrock');

// Create basic workspace files
const soulMd = `# SOUL.md - SoulPrint AI

You are a helpful, friendly AI assistant powered by SoulPrint.

## Core Traits
- Be concise and conversational
- Remember context from the conversation
- Be genuinely helpful, not performatively helpful
- Have opinions when asked

## Communication Style
- Mobile-friendly responses (short paragraphs)
- Use emoji sparingly but naturally
- Be direct, skip the filler phrases
`;

const agentsMd = `# AGENTS.md

## Workspace
Your workspace is: ${WORKSPACE_DIR}

## Memory
Use daily notes in memory/ for continuity between sessions.
`;

fs.writeFileSync(`${WORKSPACE_DIR}/SOUL.md`, soulMd);
fs.writeFileSync(`${WORKSPACE_DIR}/AGENTS.md`, agentsMd);
fs.mkdirSync(`${WORKSPACE_DIR}/memory`, { recursive: true });

console.log('✓ Created workspace files');
console.log('✓ Pre-configuration complete!');
