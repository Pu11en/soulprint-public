# ChatGPT Data Import Skill for SoulPrint

## Overview

This skill allows SoulPrint users to import their ChatGPT conversation history to accelerate the profile-building process. Instead of starting from scratch, SoulPrint can learn from potentially years of AI interactions.

---

## 1. ChatGPT Export Format

### How Users Export Data

1. Sign in at [chatgpt.com](https://chatgpt.com)
2. Navigate to: **Profile → Settings → Data controls → Export**
3. Click **Confirm export**
4. Wait for email from OpenAI (typically 5-30 minutes)
5. Download `.zip` file (link expires in 24 hours)

### ZIP File Structure

```
chatgpt-export-YYYY-MM-DD.zip
├── conversations.json          # Main conversation history
├── chat.html                   # HTML viewer for conversations
├── model_comparisons.json      # A/B test comparisons (if any)
├── message_feedback.json       # Thumbs up/down feedback
├── shared_conversations.json   # Conversations shared via link
├── user.json                   # Account info (email, name)
└── attachments/                # Media files uploaded in chats
    └── file-XXXXX/
        └── image.png
```

### conversations.json Schema

Each conversation is a node-based DAG (directed acyclic graph) allowing for branching/regeneration:

```typescript
interface ChatGPTExport {
  conversations: Conversation[];
}

interface Conversation {
  id: string;                           // UUID
  title: string;                        // Auto-generated or user-set title
  create_time: number;                  // Unix timestamp (seconds)
  update_time: number;                  // Unix timestamp (seconds)
  mapping: Record<string, MessageNode>; // Node ID -> MessageNode
  moderation_results: any[];
  current_node: string;                 // ID of the current/final message
  conversation_template_id?: string;
  gizmo_id?: string;                    // Custom GPT ID if used
  is_archived?: boolean;
  safe_urls?: string[];
  default_model_slug?: string;          // e.g., "gpt-4", "gpt-4o"
}

interface MessageNode {
  id: string;
  parent: string | null;                // Parent node ID (null for root)
  children: string[];                   // Child node IDs
  message: Message | null;              // Null for system/root nodes
}

interface Message {
  id: string;
  author: Author;
  create_time: number | null;
  update_time: number | null;
  content: MessageContent;
  status: "finished_successfully" | "in_progress" | string;
  end_turn: boolean | null;
  weight: number;
  metadata: MessageMetadata;
  recipient: "all" | string;
}

interface Author {
  role: "system" | "user" | "assistant" | "tool";
  name?: string;                        // For tools: "browser", "python", etc.
  metadata: Record<string, any>;
}

interface MessageContent {
  content_type: "text" | "multimodal_text" | "code" | "execution_output" | "tether_browsing_display" | "tether_quote";
  parts?: (string | ContentPart)[];     // Text content or mixed media
  language?: string;                    // For code content
  text?: string;                        // Alternative text field
}

interface ContentPart {
  asset_pointer?: string;               // Reference to attachment
  content_type?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
}

interface MessageMetadata {
  model_slug?: string;                  // "gpt-4", "gpt-4o", "o1-preview"
  is_user_system_message?: boolean;
  user_context_message_data?: {         // Custom instructions context
    about_user_message?: string;
    about_model_message?: string;
  };
  voice_mode_message?: boolean;
  citations?: Citation[];
  finish_details?: {
    type: "stop" | "max_tokens";
    stop_tokens?: number[];
  };
}
```

### Key Observations

- **Branching Structure**: Conversations are DAGs, not linear. Users can regenerate responses, creating branches. Follow `current_node` backward via `parent` for the "active" conversation thread.
- **Custom Instructions**: Found in `metadata.user_context_message_data` - extremely valuable for understanding user preferences!
- **Voice Messages**: `metadata.voice_mode_message = true` indicates voice input
- **Tool Use**: `author.role = "tool"` with `author.name = "browser"/"python"/"dalle"` shows tool interactions
- **Model Preferences**: `default_model_slug` shows which models the user prefers

---

## 2. Google Drive Access Patterns

### Public Share Links

Users share files via links like:
```
https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
https://drive.google.com/open?id={FILE_ID}
```

### Direct Download URL Pattern

Convert share link to direct download:
```
https://drive.google.com/uc?export=download&id={FILE_ID}
```

**For large files (>100MB)**: Google shows a "virus scan warning" page. Must handle redirect or use API.

### Google Drive API Method (Recommended)

Using our existing Google OAuth credentials:

```typescript
async function downloadFromDrive(fileId: string, accessToken: string): Promise<ArrayBuffer> {
  // First, get file metadata to check size and type
  const metadata = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ).then(r => r.json());
  
  // Download content
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  return response.arrayBuffer();
}
```

### Extracting File ID from URLs

```typescript
function extractGoogleDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,           // /file/d/{id}/
    /[?&]id=([a-zA-Z0-9_-]+)/,               // ?id={id} or &id={id}
    /\/d\/([a-zA-Z0-9_-]+)/,                 // /d/{id}/
    /^([a-zA-Z0-9_-]{20,})$/,                // Raw ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

---

## 3. Extractable User Insights

### A. Personal Facts

| Category | Extraction Method |
|----------|-------------------|
| **Name** | From `user.json`, or mentioned in conversations |
| **Job/Role** | Topic analysis + explicit mentions ("as a software engineer...") |
| **Location** | Time zone references, local events, weather discussions |
| **Relationships** | Mentions of family, partners, friends, pets |
| **Interests/Hobbies** | Recurring topics, creative projects |

### B. Communication Style

- **Formality Level**: Analyze greetings, sentence structure
- **Verbosity**: Average message length
- **Question Patterns**: How they ask for help
- **Follow-up Behavior**: Do they iterate or one-shot?
- **Code Literacy**: Ratio of coding conversations, complexity

### C. Behavioral Patterns

- **Active Hours**: Time distribution of messages
- **Session Patterns**: Short bursts vs. long sessions
- **Topic Clusters**: What they use ChatGPT for most
- **Model Preferences**: Which GPT versions they choose
- **Custom GPT Usage**: Specific tools/personas they prefer

### D. Custom Instructions (Gold Mine!)

```typescript
interface CustomInstructions {
  about_user: string;    // "What would you like ChatGPT to know about you?"
  about_model: string;   // "How would you like ChatGPT to respond?"
}
```

These are literally user-written self-descriptions! Found in:
- `message.metadata.user_context_message_data.about_user_message`
- `message.metadata.user_context_message_data.about_model_message`

---

## 4. Tool Definition: `import_chatgpt_data`

```typescript
interface ImportChatGPTDataParams {
  source: 
    | { type: 'google_drive'; url: string }
    | { type: 'direct_upload'; fileData: ArrayBuffer };
  options?: {
    maxConversations?: number;     // Limit for testing (default: all)
    includeArchived?: boolean;     // Include archived chats (default: true)
    sinceDays?: number;            // Only import last N days
    analysisDepth?: 'quick' | 'standard' | 'deep';
  };
}

interface ImportResult {
  success: boolean;
  stats: {
    totalConversations: number;
    totalMessages: number;
    dateRange: { start: Date; end: Date };
    topModels: { model: string; count: number }[];
    processingTimeMs: number;
  };
  profile: ExtractedProfile;
  insights: Insight[];
}

interface ExtractedProfile {
  // Direct extractions
  customInstructions?: {
    aboutUser: string;
    aboutModel: string;
  };
  
  // Inferred attributes
  communicationStyle: {
    formality: 'casual' | 'balanced' | 'formal';
    verbosity: 'concise' | 'moderate' | 'detailed';
    techLevel: 'non-technical' | 'technical' | 'developer';
  };
  
  // Topic analysis
  topInterests: { topic: string; confidence: number }[];
  
  // Personal facts (with confidence scores)
  facts: {
    category: string;  // 'job', 'location', 'hobby', etc.
    value: string;
    confidence: number;
    source: string;    // Quote from conversation
  }[];
  
  // Behavioral patterns
  patterns: {
    activeHours: number[];  // 0-23 distribution
    preferredModels: string[];
    avgSessionLength: number;
    topUseCases: string[];
  };
}

interface Insight {
  type: 'fact' | 'preference' | 'pattern' | 'suggestion';
  title: string;
  description: string;
  confidence: number;
  evidence?: string[];
}
```

### MCP Tool Schema

```json
{
  "name": "import_chatgpt_data",
  "description": "Import and analyze ChatGPT conversation history to learn about the user. Extracts personal facts, communication style, interests, and behavioral patterns.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "google_drive_url": {
        "type": "string",
        "description": "Google Drive share link to the ChatGPT export zip file"
      },
      "analysis_depth": {
        "type": "string",
        "enum": ["quick", "standard", "deep"],
        "default": "standard",
        "description": "How thoroughly to analyze: quick (5-10s), standard (30-60s), deep (2-5min)"
      }
    },
    "required": ["google_drive_url"]
  }
}
```

---

## 5. Extraction Logic (Pseudocode)

```python
def import_chatgpt_data(zip_file, options):
    # 1. Extract and parse
    conversations = parse_conversations_json(zip_file)
    user_info = parse_user_json(zip_file)
    
    # 2. Build linear conversation threads from DAG
    threads = []
    for conv in conversations:
        if options.since_days and conv.create_time < cutoff:
            continue
        thread = linearize_conversation(conv)  # Follow current_node -> root
        threads.append(thread)
    
    # 3. Extract custom instructions (first priority - explicit user input!)
    custom_instructions = extract_custom_instructions(threads)
    
    # 4. Analyze user messages only
    user_messages = [m for t in threads for m in t if m.author.role == "user"]
    
    # 5. Communication style analysis
    style = analyze_style(user_messages)
    # - Average message length
    # - Vocabulary complexity
    # - Question patterns
    # - Code block frequency
    
    # 6. Topic extraction (NLP)
    topics = extract_topics(user_messages)
    # - Named entity recognition
    # - Keyword clustering
    # - Semantic grouping
    
    # 7. Fact extraction
    facts = extract_facts(user_messages)
    # Pattern matching for:
    # - "I am a [JOB]"
    # - "I work at/for [COMPANY]"
    # - "I live in [LOCATION]"
    # - "My [RELATIONSHIP] is..."
    # - "I'm interested in [TOPIC]"
    
    # 8. Behavioral patterns
    patterns = analyze_patterns(threads)
    # - Hour-of-day distribution
    # - Session lengths
    # - Model preferences
    # - Use case categorization
    
    # 9. Compile profile
    return ExtractedProfile(
        custom_instructions=custom_instructions,
        communication_style=style,
        top_interests=topics[:10],
        facts=facts,
        patterns=patterns
    )

def linearize_conversation(conv):
    """Convert DAG to linear thread by following current_node backwards."""
    thread = []
    node_id = conv.current_node
    while node_id:
        node = conv.mapping[node_id]
        if node.message and node.message.author.role in ['user', 'assistant']:
            thread.append(node.message)
        node_id = node.parent
    return list(reversed(thread))

def extract_custom_instructions(threads):
    """Find custom instructions from message metadata."""
    for thread in threads:
        for msg in thread:
            ctx = msg.metadata.get('user_context_message_data', {})
            if ctx:
                return {
                    'about_user': ctx.get('about_user_message'),
                    'about_model': ctx.get('about_model_message')
                }
    return None
```

---

## 6. User Profile Fields to Populate

### SoulPrint Profile Mapping

| ChatGPT Source | SoulPrint Field | Priority |
|----------------|-----------------|----------|
| Custom Instructions (about_user) | `profile.bio`, `profile.self_description` | HIGH |
| Custom Instructions (about_model) | `preferences.ai_interaction_style` | HIGH |
| Extracted job/role | `profile.occupation` | MEDIUM |
| Location mentions | `profile.location` | MEDIUM |
| Topic analysis | `interests[]` | MEDIUM |
| Communication style | `preferences.communication_style` | MEDIUM |
| Active hours | `behavior.active_hours` | LOW |
| Model preferences | `preferences.ai_model_preferences` | LOW |

### Memory Items to Create

```typescript
// Example memory entries from ChatGPT import
[
  {
    id: "chatgpt-import-001",
    type: "fact",
    category: "occupation",
    content: "Works as a software engineer",
    confidence: 0.9,
    source: "chatgpt_import:2025-02-21",
    evidence: "Mentioned in 47 conversations"
  },
  {
    id: "chatgpt-import-002",
    type: "interest",
    category: "hobbies",
    content: "Interested in woodworking",
    confidence: 0.75,
    source: "chatgpt_import:2025-02-21",
    evidence: "5 conversations about woodworking projects"
  },
  {
    id: "chatgpt-import-003",
    type: "preference",
    category: "communication",
    content: "Prefers detailed technical explanations",
    confidence: 0.85,
    source: "chatgpt_import:2025-02-21",
    evidence: "Derived from custom instructions"
  }
]
```

---

## 7. Implementation Considerations

### Size & Performance

- **Typical export size**: 10MB - 500MB (power users can have 1GB+)
- **Conversation count**: 100 - 10,000+
- **Processing strategy**:
  1. Stream extraction (don't load entire ZIP into memory)
  2. Process in batches of 100 conversations
  3. Use Workers with longer timeout or Durable Objects for background processing

### Privacy & Security

- **Never store raw conversations** - only extracted insights
- **Let user review extractions** before adding to profile
- **Provide "forget import" option** to clear all imported data
- **Rate limit imports** (once per day per user)

### User Flow

```
1. User triggers import
   → "Share your Google Drive link to your ChatGPT export"

2. Validation
   → Verify it's a valid ChatGPT export ZIP
   → Check file size (warn if >200MB, reject if >1GB)

3. Processing (show progress)
   → "Found 1,247 conversations from Jan 2023 to Feb 2025"
   → "Analyzing your communication style..."
   → "Extracting topics and interests..."

4. Review
   → "Here's what I learned about you:"
   → Show extracted facts, interests, style
   → Let user approve/edit/reject each item

5. Import
   → Add approved items to profile/memory
   → "Import complete! I now know you much better 🎉"
```

---

## 8. Future Enhancements

- **Claude Export**: When Anthropic adds export, support that format too
- **Incremental Import**: Import only new conversations since last import
- **Conversation Highlights**: Surface the most "revealing" conversations for user to verify facts
- **Cross-Reference**: Match ChatGPT topics with SoulPrint conversations to validate consistency
- **Export Stats Dashboard**: Show user their ChatGPT usage patterns as part of import

---

## 9. References

- [OpenAI Export Help](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)
- [Convoviz (ChatGPT export parser)](https://github.com/mohamed-chs/convoviz)
- [Google Drive API Downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
