/**
 * Semantic Context System for SoulPrint
 * 
 * Stores user interactions with embeddings for semantic search.
 * Uses OpenAI text-embedding-3-small (768-dim) for embeddings.
 * Retrieves top N relevant past interactions to include in context.
 */

// Context entry structure
export interface ContextEntry {
  id: string;
  userId: string;
  timestamp: string;
  userMessage: string;
  assistantResponse: string;
  embedding: number[]; // 768-dim vector
  summary?: string; // Optional short summary for display
}

// Search result with similarity score
export interface ContextSearchResult {
  entry: ContextEntry;
  similarity: number;
}

// KV key prefixes
const CONTEXT_INDEX_PREFIX = 'context:index:'; // Stores list of entry IDs per user
const CONTEXT_ENTRY_PREFIX = 'context:entry:'; // Stores individual entries

/**
 * Generate embedding using OpenAI text-embedding-3-small (768 dimensions)
 */
export async function generateEmbedding(
  text: string,
  openaiApiKey: string
): Promise<number[]> {
  // Truncate text if too long (max ~8000 tokens for embedding model)
  const truncatedText = text.slice(0, 8000);
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: truncatedText,
      dimensions: 768 // Explicitly request 768 dimensions
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[EMBEDDING] Error:', error);
    throw new Error(`Embedding failed: ${response.status}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Store a context entry with embedding
 */
export async function storeContextEntry(
  kv: KVNamespace,
  userId: string,
  userMessage: string,
  assistantResponse: string,
  openaiApiKey: string
): Promise<ContextEntry> {
  // Generate embedding from combined user message + assistant response
  // This captures the semantic meaning of the entire exchange
  const combinedText = `User: ${userMessage}\n\nAssistant: ${assistantResponse}`;
  const embedding = await generateEmbedding(combinedText, openaiApiKey);

  const entry: ContextEntry = {
    id: crypto.randomUUID(),
    userId,
    timestamp: new Date().toISOString(),
    userMessage,
    assistantResponse,
    embedding,
    summary: userMessage.slice(0, 100) // Short summary for quick reference
  };

  // Store the entry
  const entryKey = `${CONTEXT_ENTRY_PREFIX}${userId}:${entry.id}`;
  await kv.put(entryKey, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 90 // 90 days TTL
  });

  // Update the user's context index (list of entry IDs)
  const indexKey = `${CONTEXT_INDEX_PREFIX}${userId}`;
  const existingIndex = await kv.get(indexKey);
  const entryIds: string[] = existingIndex ? JSON.parse(existingIndex) : [];
  
  // Add new entry ID and limit to last 200 entries
  entryIds.push(entry.id);
  const trimmedIds = entryIds.slice(-200);
  
  await kv.put(indexKey, JSON.stringify(trimmedIds));

  console.log(`[CONTEXT] Stored entry ${entry.id} for user ${userId}`);
  return entry;
}

/**
 * Search for relevant context entries based on semantic similarity
 */
export async function searchContextEntries(
  kv: KVNamespace,
  userId: string,
  query: string,
  openaiApiKey: string,
  topK: number = 5
): Promise<ContextSearchResult[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query, openaiApiKey);

  // Get user's context index
  const indexKey = `${CONTEXT_INDEX_PREFIX}${userId}`;
  const existingIndex = await kv.get(indexKey);
  
  if (!existingIndex) {
    console.log(`[CONTEXT] No context entries found for user ${userId}`);
    return [];
  }

  const entryIds: string[] = JSON.parse(existingIndex);
  
  // Load all entries and calculate similarity
  const results: ContextSearchResult[] = [];
  
  // Process in batches to avoid overwhelming KV
  const batchSize = 20;
  for (let i = 0; i < entryIds.length; i += batchSize) {
    const batch = entryIds.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (entryId) => {
      const entryKey = `${CONTEXT_ENTRY_PREFIX}${userId}:${entryId}`;
      const entryJson = await kv.get(entryKey);
      
      if (entryJson) {
        const entry: ContextEntry = JSON.parse(entryJson);
        const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
        
        // Only include if similarity is above threshold (0.3 seems reasonable)
        if (similarity > 0.3) {
          results.push({ entry, similarity });
        }
      }
    }));
  }

  // Sort by similarity (descending) and take top K
  results.sort((a, b) => b.similarity - a.similarity);
  const topResults = results.slice(0, topK);

  console.log(`[CONTEXT] Found ${topResults.length} relevant entries for user ${userId} (searched ${entryIds.length})`);
  return topResults;
}

/**
 * Format context entries for inclusion in system prompt
 */
export function formatContextForPrompt(results: ContextSearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const formattedEntries = results.map((r, i) => {
    const entry = r.entry;
    const date = new Date(entry.timestamp).toLocaleDateString();
    return `### Past Conversation ${i + 1} (${date}, relevance: ${(r.similarity * 100).toFixed(0)}%)
**User:** ${entry.userMessage.slice(0, 300)}${entry.userMessage.length > 300 ? '...' : ''}
**You responded:** ${entry.assistantResponse.slice(0, 500)}${entry.assistantResponse.length > 500 ? '...' : ''}`;
  });

  return `
## Relevant Past Conversations
The following past conversations may be relevant to the current message. Reference them naturally if helpful.

${formattedEntries.join('\n\n')}

---
`;
}

/**
 * Lightweight context check - only search if we have entries
 */
export async function hasContextEntries(
  kv: KVNamespace,
  userId: string
): Promise<boolean> {
  const indexKey = `${CONTEXT_INDEX_PREFIX}${userId}`;
  const existingIndex = await kv.get(indexKey);
  if (!existingIndex) return false;
  const entryIds: string[] = JSON.parse(existingIndex);
  return entryIds.length > 0;
}

/**
 * Get context entry count for a user
 */
export async function getContextEntryCount(
  kv: KVNamespace,
  userId: string
): Promise<number> {
  const indexKey = `${CONTEXT_INDEX_PREFIX}${userId}`;
  const existingIndex = await kv.get(indexKey);
  if (!existingIndex) return 0;
  const entryIds: string[] = JSON.parse(existingIndex);
  return entryIds.length;
}

/**
 * Clear all context entries for a user (for privacy/reset)
 */
export async function clearContextEntries(
  kv: KVNamespace,
  userId: string
): Promise<number> {
  const indexKey = `${CONTEXT_INDEX_PREFIX}${userId}`;
  const existingIndex = await kv.get(indexKey);
  
  if (!existingIndex) return 0;
  
  const entryIds: string[] = JSON.parse(existingIndex);
  
  // Delete all entries
  await Promise.all(entryIds.map(async (entryId) => {
    const entryKey = `${CONTEXT_ENTRY_PREFIX}${userId}:${entryId}`;
    await kv.delete(entryKey);
  }));
  
  // Delete the index
  await kv.delete(indexKey);
  
  console.log(`[CONTEXT] Cleared ${entryIds.length} entries for user ${userId}`);
  return entryIds.length;
}
