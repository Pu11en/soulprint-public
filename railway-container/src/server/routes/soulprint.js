/**
 * SoulPrint Routes - Telegram + Web Chat
 * Clean integration with AWS Bedrock
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://swvljsixpvvcirjmflze.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Telegram Bot Pool
const BOT_POOL = [
  { username: 'soulprint2bot', token: process.env.TG_BOT2_TOKEN },
  { username: 'soulprint3bot', token: process.env.TG_BOT3_TOKEN },
  { username: 'soulprint4bot', token: process.env.TG_BOT4_TOKEN },
  { username: 'soulprint5bot', token: process.env.TG_BOT5_TOKEN },
  { username: 'soulprint6bot', token: process.env.TG_BOT6_TOKEN },
  { username: 'soulprint7bot', token: process.env.TG_BOT7_TOKEN },
  { username: 'soulprint8bot', token: process.env.TG_BOT8_TOKEN },
];

// AWS Bedrock chat
async function chatWithBedrock(messages, soulMd) {
  const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
  
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });

  const systemPrompt = soulMd || `You are a helpful, friendly AI assistant. Be concise and conversational.`;

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL || 'anthropic.claude-sonnet-4-20250514-v1:0',
    system: [{ text: systemPrompt }],
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: m.content }]
    })),
    inferenceConfig: {
      maxTokens: 2048,
      temperature: 0.7,
    }
  });

  const response = await client.send(command);
  return response.output?.message?.content?.[0]?.text || 'No response';
}

// Get user's SOUL.md from Supabase
async function getUserSoul(telegramChatId) {
  try {
    // Find user by telegram chat ID
    const { data: user } = await supabase
      .from('user_profiles')
      .select('user_id, soul_md, ai_name')
      .eq('telegram_chat_id', telegramChatId)
      .single();
    
    if (user?.soul_md) {
      return { soulMd: user.soul_md, aiName: user.ai_name || 'SoulPrint' };
    }
    
    // Default soul for new users
    return { 
      soulMd: `You are a helpful AI assistant. Be friendly, concise, and conversational. 
You're chatting via Telegram so keep responses mobile-friendly.`,
      aiName: 'SoulPrint'
    };
  } catch (e) {
    console.error('Error fetching soul:', e);
    return { soulMd: null, aiName: 'SoulPrint' };
  }
}

// Get or create chat history
async function getChatHistory(telegramChatId) {
  try {
    const { data } = await supabase
      .from('telegram_history')
      .select('messages')
      .eq('chat_id', telegramChatId)
      .single();
    return data?.messages || [];
  } catch {
    return [];
  }
}

async function saveChatHistory(telegramChatId, messages) {
  try {
    await supabase
      .from('telegram_history')
      .upsert({ chat_id: telegramChatId, messages, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error('Error saving history:', e);
  }
}

// Send Telegram message
async function sendTelegram(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

// Register routes
function registerSoulprintRoutes({ app }) {
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'soulprint-engine', timestamp: new Date().toISOString() });
  });

  // Telegram webhook for each bot
  BOT_POOL.forEach((bot, idx) => {
    app.post(`/telegram/webhook/${bot.username}`, async (req, res) => {
      res.json({ ok: true }); // Respond immediately
      
      try {
        const { message } = req.body;
        if (!message?.text || !message?.chat?.id) return;
        
        const chatId = message.chat.id;
        const userText = message.text;
        const token = bot.token;
        
        if (!token) {
          console.error(`No token for ${bot.username}`);
          return;
        }

        // Get user's soul and history
        const { soulMd, aiName } = await getUserSoul(chatId);
        let history = await getChatHistory(chatId);
        
        // Add user message
        history.push({ role: 'user', content: userText });
        
        // Keep last 20 messages
        if (history.length > 20) history = history.slice(-20);
        
        // Get AI response
        const response = await chatWithBedrock(history, soulMd);
        
        // Add assistant message
        history.push({ role: 'assistant', content: response });
        
        // Save history
        await saveChatHistory(chatId, history);
        
        // Send response
        await sendTelegram(token, chatId, response);
        
      } catch (error) {
        console.error('Telegram webhook error:', error);
        const chatId = req.body?.message?.chat?.id;
        const token = bot.token;
        if (chatId && token) {
          await sendTelegram(token, chatId, `Sorry, I encountered an error. Please try again.`);
        }
      }
    });
  });

  // Web chat endpoint (for soul-home frontend)
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, email, history = [] } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message required' });
      }

      // Get user's soul from Supabase by email
      let soulMd = null;
      if (email) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('soul_md')
          .eq('email', email)
          .single();
        soulMd = user?.soul_md;
      }

      // Build messages
      const messages = [...history, { role: 'user', content: message }];
      
      // Get response
      const response = await chatWithBedrock(messages, soulMd);
      
      res.json({ response, ok: true });
      
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message || 'Chat failed' });
    }
  });

  // Setup Telegram webhooks
  app.get('/api/telegram/setup', async (req, res) => {
    const baseUrl = process.env.BASE_URL || 'https://soulprint-engine.up.railway.app';
    const results = [];
    
    for (const bot of BOT_POOL) {
      if (!bot.token) {
        results.push({ bot: bot.username, status: 'skipped', reason: 'no token' });
        continue;
      }
      
      try {
        const webhookUrl = `${baseUrl}/telegram/webhook/${bot.username}`;
        const url = `https://api.telegram.org/bot${bot.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        results.push({ bot: bot.username, status: data.ok ? 'success' : 'failed', webhookUrl });
      } catch (e) {
        results.push({ bot: bot.username, status: 'error', error: e.message });
      }
    }
    
    res.json({ results });
  });

  console.log('[SoulPrint] Routes registered');
}

module.exports = { registerSoulprintRoutes };
