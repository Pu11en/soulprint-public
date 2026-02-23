// Telegram Bot Pool for SoulPrint
// Each user gets assigned their own dedicated bot

export interface TelegramBot {
  username: string;
  token: string;
  claimed: boolean;
  claimedBy?: string; // user ID
}

export const BOT_POOL: TelegramBot[] = [
  { username: 'soulprint2bot', token: '8392392461:AAHUPcwcg6Ym4U3yxiZeBFe86S8vGFsWmdA', claimed: false },
  { username: 'soulprint3bot', token: '8569580868:AAEgtf4rd8NlvHY_6nLkX1qDUKObxh-CfWo', claimed: false },
  { username: 'soulprint4bot', token: '8455842623:AAEXmISfq0Z5WvhhpEGUEe70_X2j-AP2D30', claimed: false },
  { username: 'soulprint5bot', token: '8569655066:AAElB70e9e_PbRUms0V0n4iQdZYWOrPc2TQ', claimed: false },
  { username: 'soulprint6bot', token: '8564344025:AAGFoKo5NUOy6fUBFYJHF7fWgn3bLXr8au4', claimed: false },
  { username: 'soulprint7bot', token: '8344606600:AAESg-WT00j0w0gplHRra-lPXnE3Smq-qu4', claimed: false },
  { username: 'soulprint8bot', token: '8170707998:AAGkluS6Z2kjFsKtxAbGGt6qUgV6U8-_k_M', claimed: false },
];

// Get bot by username
export function getBotByUsername(username: string): TelegramBot | undefined {
  return BOT_POOL.find(b => b.username === username);
}

// Get bot by token
export function getBotByToken(token: string): TelegramBot | undefined {
  return BOT_POOL.find(b => b.token === token);
}
