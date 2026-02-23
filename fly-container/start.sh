#!/bin/bash
set -e

cd /home/soulprint/workspace || mkdir -p /home/soulprint/workspace && cd /home/soulprint/workspace
mkdir -p memory

echo "=== SoulPrint Container ==="

# Decode workspace files
[ -n "$SOUL_MD_B64" ] && echo "$SOUL_MD_B64" | base64 -d > SOUL.md
[ -n "$USER_MD_B64" ] && echo "$USER_MD_B64" | base64 -d > USER.md
[ -n "$MEMORY_MD_B64" ] && echo "$MEMORY_MD_B64" | base64 -d > MEMORY.md

# Create defaults
[ ! -f SOUL.md ] && echo "# SOUL.md\n\nYou are a helpful AI assistant powered by SoulPrint.\nBe genuine, resourceful, and grow with your human." > SOUL.md
[ ! -f USER.md ] && echo "# USER.md\n\nYour human. Learn about them over time." > USER.md
[ ! -f MEMORY.md ] && echo "# MEMORY.md\n\nYour memories." > MEMORY.md

echo "Workspace ready"

# Run API server with Bedrock
exec node << 'NODEJS'
const http = require('http');
const fs = require('fs');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const PORT = 8080;
const WORKSPACE = '/home/soulprint/workspace';
const MODEL_ID = process.env.BEDROCK_MODEL || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// AWS client
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Load workspace context
function loadContext() {
  const files = {};
  ['SOUL.md', 'USER.md', 'MEMORY.md'].forEach(f => {
    try { files[f] = fs.readFileSync(`${WORKSPACE}/${f}`, 'utf8'); } catch(e) {}
  });
  return files;
}

// Call Bedrock
async function chat(message, history = []) {
  const ctx = loadContext();
  
  const systemPrompt = `${ctx['SOUL.md'] || ''}\n\n${ctx['USER.md'] || ''}\n\nMemory:\n${ctx['MEMORY.md'] || ''}`;
  
  const messages = [
    ...history,
    { role: 'user', content: message }
  ];
  
  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    system: systemPrompt,
    messages
  };
  
  const cmd = new InvokeModelCommand({
    modelId: MODEL_ID,
    body: JSON.stringify(body),
    contentType: 'application/json'
  });
  
  const response = await bedrock.send(cmd);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text;
}

// Read body
function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify({ status: 'ok', model: MODEL_ID }));
  }
  
  if (req.url === '/api/chat' && req.method === 'POST') {
    try {
      const { message, history } = JSON.parse(await readBody(req));
      const response = await chat(message, history || []);
      res.writeHead(200, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify({ response }));
    } catch(e) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      return res.end(JSON.stringify({ error: e.message }));
    }
  }
  
  res.writeHead(200).end('SoulPrint Ready');
});

server.listen(PORT, '0.0.0.0', () => console.log(`API on :${PORT}`));
NODEJS
