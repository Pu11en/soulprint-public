# SoulPrint App — Complete Screen Specification

20 screens. Every field, button, and state listed. Web first, Flutter later.

---

## Screen 1: Onboarding Carousel (first launch only)

4 swipeable cards:

| Card | Heading | Body |
|------|---------|------|
| 1 | STOP RE-EXPLAINING YOURSELF TO AI | Chat with an AI that remembers your tone, your tempo, and your life. |
| 2 | Lives in Telegram & SMS | No new apps to install. Just message your SoulPrint like you'd message a friend. |
| 3 | It can actually do things | Browse the web, generate images, manage your calendar, send emails — not just chat. |
| 4 | Your data stays yours | Your conversations are private and encrypted. We never use your data to train AI models. |

- Dot indicators showing current card (4 dots)
- "Skip" text button top-right on all cards
- "Get Started" button on card 4 → goes to Login

---

## Screen 2: Login

- Logo: SoulPrint logo
- Email input field, placeholder "you@example.com"
- Password input field, placeholder "Password", show/hide toggle
- "Log In" button
- "Forgot password?" text link → Forgot Password screen
- "Don't have an account? Sign up" text link → Signup Step 1
- "Already have an access code?" text link → Access Code Entry

---

## Screen 3: Forgot Password

- Back arrow top-left
- "Reset Password" heading
- Email input field, placeholder "you@example.com"
- "Send Reset Link" button
- Success state: "Check your email at {email} for a reset link."

---

## Screen 4: Signup Step 1 — Info Form

- Back arrow → Login
- Logo: "SoulPrint"
- Heading: "Get Your SoulPrint"
- Subtitle: "Your personal AI concierge — exclusive beta access"
- Full Name input, placeholder "Your name", required
- Email input, placeholder "you@example.com", required
- Phone Number input, placeholder "+1 (555) 000-0000", optional
- Access Code input, placeholder "e.g. DREW2026", optional, pre-fills from deep link
- "Begin Journey" button, shows "Verifying..." while loading
- Error: "Name and email are required"
- If draft exists in storage: banner "You have an unfinished assessment." with "Resume" and "Start Over" buttons

---

## Screen 5: Signup Step 2 — Quick Profile

- Heading: "Welcome aboard!"
- Subtitle: "Quick intro so your SoulPrint knows who it's working with."

- "What's your role?" (required, single select chips):
  Entrepreneur, Product Manager, Engineer, Designer, Creative, Student, Freelancer, Executive

- "How do you prefer to communicate?" (single select chips):
  Texting, Voice messages, Phone calls, Face to face, All of the above

- "Where did you hear about SoulPrint?" (single select chips):
  Twitter, Instagram, TikTok, YouTube, Friend or colleague, Search engine, Other

- "Continue" button

---

## Screen 6: Signup Step 3 — Chat Assessment

Looks like a chat thread. No AI — pre-scripted bot messages, user types free-text answers. Answers saved to R2 via `/api/ingest-assessment`. Progress bar at top shows completion.

- Progress bar: filled portion = answeredCount / 36
- Current pillar label (e.g. "Communication")
- Counter: "{answered}/36"

Bot sends first message automatically when screen loads. After user replies, bot sends transition text (if changing pillar) then next question. All messages appear as chat bubbles — bot on left, user on right.

### Bot intro message:
"Hey {firstName}! I'm going to ask you 36 quick questions so I can really get to know you. No right or wrong answers — just be yourself. Ready? Let's go."

### 6 pillars, 6 questions each:

**Communication:**
1. "When you need to share something important with someone, do you prefer to write it out or talk face-to-face?"
2. "Think about the last disagreement you had. How did you approach resolving it?"
3. "When someone asks for your opinion, do you tend to be direct or do you soften your words first?"
4. "How do you usually react when someone misunderstands what you meant?"
5. "Do you find yourself thinking carefully before speaking, or do your best ideas come out as you talk?"
6. "When giving feedback to someone, what matters more to you — being honest or being kind?"

**Emotional Intelligence:**
1. "When something unexpected goes wrong, what's your first internal reaction?"
2. "How comfortable are you sitting with uncertainty — say, waiting for important news?"
3. "Think of a time you felt really proud of yourself. What made that moment special?"
4. "When someone close to you is upset, do you try to fix the problem or just be present with them?"
5. "How do you usually process strong emotions — alone, by talking it out, or something else?"
6. "What's your relationship with vulnerability? Easy, uncomfortable, or somewhere in between?"

**Decision Making:**
1. "When you face a big decision, do you research extensively or go with your gut?"
2. "Think about a decision you made recently that turned out well. What drove your choice?"
3. "How do you handle situations where there's no clear right answer?"
4. "When you're stuck between two good options, what usually tips the scale for you?"
5. "Do you tend to decide quickly and adjust, or take your time to get it right the first time?"
6. "How much do other people's opinions influence your decisions?"

**Social Dynamics:**
1. "After a long week, does being around people energize you or drain you?"
2. "How do you typically build trust with someone new?"
3. "In a group setting, do you naturally take the lead, support others, or observe first?"
4. "What's your approach to maintaining friendships — regular check-ins or picking up where you left off?"
5. "How do you handle social situations where you don't know anyone?"
6. "When there's tension in a group, do you address it directly or wait for it to resolve itself?"

**Cognitive Style:**
1. "When you learn something new, do you prefer to understand the big picture first or start with the details?"
2. "How do you organize your thoughts when working on a complex problem?"
3. "Do you trust patterns and experience more, or do you prefer fresh data for each situation?"
4. "When you're brainstorming, do you work best alone or bouncing ideas off others?"
5. "How do you typically handle information overload?"
6. "What's your relationship with rules and systems — do you follow them, bend them, or create your own?"

**Assertiveness:**
1. "When someone crosses a boundary, how quickly do you address it?"
2. "How comfortable are you saying no to requests — even from people you care about?"
3. "In negotiations, do you push for what you want or look for middle ground first?"
4. "Think of a time you stood up for something important to you. What made you speak up?"
5. "How do you handle situations where you disagree with someone in authority?"
6. "When you want something, do you ask for it directly or drop hints?"

### Bot transition messages between pillars:

| After | Bot message |
|-------|------------|
| Communication | "I'm getting a real sense of how you communicate. Let's shift gears and talk about how you experience emotions..." |
| Emotional Intelligence | "Beautiful. Now let's explore how you make decisions..." |
| Decision Making | "Interesting patterns emerging. I'd like to understand your social dynamics..." |
| Social Dynamics | "That paints a clear picture. Let's dive into how you think and process information..." |
| Cognitive Style | "Fascinating. Last area — how you assert yourself and set boundaries..." |

### Bot final message (after question 36):
"That was awesome, {firstName}. I feel like I really know you now. One last thing — what should I call myself?"

User types bot name in the same chat input → answer saved → bot responds:
"Love it. {botName} it is. Setting things up for you now..."

Then auto-navigates to Success screen.

### Chat input:
- Text input, placeholder "Type your answer..."
- Send button
- No attach button (assessment only)
- Drafts auto-save to localStorage

---

## Screen 7: Signup Step 4a — Success (bot assigned)

- Checkmark icon
- Heading: "Your SoulPrint is Ready!"
- Body: "{botName} is being set up now and already knows who you are."
- "Start Chatting" button → Chat Thread screen
- If Telegram linked: "Or open on Telegram" link → @botname
- If SMS linked: "Or text at" + phone number
- "Back to Home" button

---

## Screen 8: Signup Step 4b — Success (waitlist)

- Checkmark icon
- Heading: "You're on the list!"
- Body: "We'll be in touch within 24 hours to get your SoulPrint set up."
- Body: "Check your email at {email} for next steps."
- "Back to Home" button

---

## Screen 9: Conversation List (main chat tab)

- Heading: "Messages"
- List of conversations, each showing:
  - Bot name / conversation title (or "Untitled Conversation")
  - Preview text (last message truncated)
  - Channel badge if present (Telegram / SMS / App)
  - Message count: "{count} messages"
  - Relative time: "2 min ago", "Yesterday", "Jan 15"
- Tapping a conversation → Chat Thread
- Empty state: "No conversations yet. Start chatting with your SoulPrint below."
- Floating action button or input bar to start new conversation

---

## Screen 10: Chat Thread

- Top bar: Bot name, back arrow
- Tapping bot name → Chat Info screen
- Message list:
  - User messages: right-aligned
  - Bot messages: left-aligned
  - System messages: centered, dimmed
  - Each message shows: content, timestamp
  - Bot messages render: markdown (bold, italic, lists, headers), code blocks with copy button, inline images (tappable → full preview), clickable links
  - Streaming: bot response text appears word-by-word as it generates
- Long press any message: Copy text, Share
- Search icon in top bar → search within this conversation
- Input bar at bottom:
  - Text input, placeholder "Message..."
  - Attach button (files/images via Cloudinary)
  - Send button
- If bot is offline: banner "Bot is starting up, please wait..." with loading indicator
- Failed message: red indicator + "Tap to retry"

---

## Screen 11: Chat Info

- Back arrow
- Bot name (the name user gave in signup)
- Bot avatar placeholder
- Status: "Online" / "Starting..." / "Offline"
- Platform: "Telegram" / "SMS" / "App"
- Skills count: "{enabled} skills active"
- "Open in Telegram" button (if Telegram bot URL exists)
- "Restart Bot" button with confirmation: "Are you sure? This will disconnect temporarily."

---

## Screen 12: File Preview

- Full-screen overlay
- Image/PDF/file rendered full size
- Close button (X) top-right
- Share button
- Download button

---

## Screen 13: Admin — Devices

- Section: "R2 Storage"
  - If not configured: "R2 Storage Not Configured. Paired devices and conversations will be lost when the container restarts." + list of missing secrets
  - If configured: "R2 storage is configured." + "Last backup: {datetime}" or "Never" + "Backup Now" button (shows "Syncing..." while active)

- Section: "Gateway Controls"
  - "Restart Gateway" button
  - Text: "Restart the gateway to apply configuration changes or recover from errors. All connected clients will be temporarily disconnected."
  - Confirmation dialog: "Are you sure you want to restart the gateway? This will disconnect all clients temporarily."
  - Success message: "Gateway restart initiated. Clients will reconnect automatically."

- Section: "Pending Pairing Requests"
  - "Approve All ({count})" button (shows "Approving..." while active)
  - "Refresh" button
  - Empty state: "No pending pairing requests. Devices will appear here when they attempt to connect without being paired."
  - Each pending device card:
    - Name: displayName or deviceId or "Unknown Device"
    - Badge: "Pending"
    - Fields (shown if present): Platform, Client, Mode, Role, IP
    - Requested: relative time with tooltip showing absolute time
    - "Approve" button (shows "Approving..." while active)

- Section: "Paired Devices"
  - Empty state: "No paired devices"
  - Each paired device card:
    - Name: displayName or deviceId or "Unknown Device"
    - Badge: "Paired"
    - Fields: Platform, Client, Mode, Role
    - Paired: relative time with absolute tooltip

---

## Screen 14: Admin — Skills

- Summary bar: Total Skills count, Enabled count, Disabled count
- Filter buttons: "All", "Core", "Custom"
- Search input, placeholder "Search skills..."
- "Refresh" button
- Empty state: "No skills match your filters" or "No skills found. Skills are loaded from the bot's skill directories."
- Each skill card:
  - Skill name
  - Source badge: "core" or "custom"
  - Toggle switch (on/off)
  - Description text
  - Author: "By {author}" (if present)
  - Version: "v{version}" (if present)
  - While toggling: overlay with "Updating..."
  - Toggle confirmation: "Toggling {name} will restart the gateway, which may briefly interrupt active conversations. Continue?"

---

## Screen 15: Admin — Conversations

- Heading: "Recent Conversations"
- "Refresh" button
- Empty state: "No conversations yet. Conversations will appear here as you interact with your bot via Telegram or SMS."
- Each conversation row:
  - Title or "Untitled Conversation"
  - Preview text
  - Channel badge (if present)
  - "{count} messages"
  - Relative time
- Pagination: "Previous" button, "Page {n}", "Next" button
- Tapping conversation → full message thread:
  - "Back to List" button
  - Title
  - "{messageCount} messages — {date}"
  - Each message: content, timestamp, role label (user/assistant/system)

---

## Screen 16: Admin — Clients

- Section: "Referral Codes"
  - Table columns: Code, Team Member, Signups, Share Link
  - Signup count shows "{count} signup(s)"
  - "Copy Link" button per row (link format: {origin}/#signup?ref={code}), shows "Copied!" after tap
  - "Seed Team Codes" button (only when no referrals exist), shows "Seeding..." while active
  - Empty state: "No referral codes yet. Click 'Seed Team Codes' to load your team's referral codes."
  - Default seed codes: DREW2026 (Drew), !ARCHE! (ArcheForge), WHITEBOYNICK (Nicholas Hill), GLENN2026 (Glenn), BLANCHE (Lisa Quible), FLOYD (Adrian Floyd), ACE1 (Ben Woodard), RONNIE2026 (Ronnie), DAVID2026 (David), NINETEEN19 (Layla Ghafarri)

- Section: "Bot Pool"
  - Stats line: "{available} available / {assigned} assigned"
  - "Add Bot" button (toggles form), "Cancel" to close
  - Add form fields: Bot ID (required, placeholder "e.g. client-3"), Worker URL (required, placeholder "https://client-3.kidquick360.workers.dev"), Telegram Bot URL (optional, placeholder "https://t.me/botname")
  - "Add to Pool" button, shows "Adding..." while active
  - Table columns: Bot ID, Worker URL, Status ("available" or assigned), Assigned To (name or "—")
  - Empty state: "No bots in pool. Add pre-provisioned bots so signups with referral codes get auto-assigned."

- Section: "Access Codes"
  - "Refresh" button
  - "Generate Code" button (toggles form), "Cancel" to close
  - Generate form fields: Client Name (required, placeholder "e.g. Glenn Luther"), Email (optional, placeholder "client@example.com"), Worker URL (required, placeholder "https://client-name.kidquick360.workers.dev"), Telegram Bot URL (optional, placeholder "https://t.me/botname"), Platform dropdown (options: Telegram, SMS, App / Web) required
  - "Generate" button, shows "Generating..." while active
  - Table columns: Code, Client, Platform, Status ("Used" or "Unused"), Created (date), Actions
  - Code cell has "Copy" button, shows "Copied!" after tap
  - "Delete" button per row (shows spinner while deleting)
  - Empty state: "No access codes yet. Generate one to give a client access to their bot."

---

## Screen 17: Admin — Fleet Dashboard

- Each bot card:
  - Bot ID
  - Worker URL
  - Status: "healthy" / "cold" / "unreachable" / "error"
  - Assigned to (user name or unassigned)
- Summary bar: {healthy} healthy, {cold} cold, {unreachable} unreachable, {error} error, {total} total

---

## Screen 18: Alerts Feed

- List of alert cards, newest first
- Each alert shows:
  - Severity indicator: error (red), warning (yellow), info (blue), resolved (green)
  - Title (e.g. "Worker Error", "Gateway Start Failed", "R2 Sync Failed", "R2 Sync Recovered", "Sandbox Init Failed", "Proxy Error", "Gateway Unhealthy")
  - Message text
  - Bot name
  - Timestamp
  - Fields: Path (if proxy/worker error), Consecutive Failures (if sync), Error Details (truncated stack trace)
  - If Linear issue was created: "ARC-{number}" link to Linear

---

## Screen 19: Settings

- Notifications section:
  - Toggle: Bot reply notifications (on by default)
  - Toggle: Proactive messages — daily briefings, reminders (on by default)
  - Toggle: Admin alerts — errors, crashes (on by default, admin users only)
- Appearance section:
  - Theme toggle: Dark / Light / System
- Data section:
  - "Clear local cache" button
- Account section:
  - "Log Out" button
  - "Delete Account" button with confirmation

---

## Screen 20: Profile & About

- Avatar (placeholder, tappable to change)
- Name (editable)
- Email (editable)
- Phone (editable)
- "Save Changes" button
- Divider
- App version number
- "Privacy Policy" link
- "Terms of Service" link
- Copyright: "Copyright 2026 © SoulPrint™. All rights reserved."
- Social links: X/Twitter, GitHub (Pu11en), LinkedIn, Bluesky, YouTube

---

## Bottom Navigation Bar

4 tabs:

| Icon | Label | Destination |
|------|-------|-------------|
| Chat bubble | Chat | Conversation List |
| Shield | Admin | Devices (with sub-tabs: Devices, Skills, Conversations, Clients, Fleet) |
| Bell | Alerts | Alerts Feed |
| Gear | Settings | Settings |

Admin tab only visible if user has admin role.

---

## Push Notifications (3 channels)

| Channel | When | Content |
|---------|------|---------|
| Bot Replies | Bot responds to user message | "{botName}: {preview text}" |
| Proactive | Bot sends unprompted (briefings, reminders) | "{botName}: {preview text}" |
| Admin Alerts | Gateway down, sync failed, errors | "{severity}: {title} — {botName}" |

---

## Error / Empty States

| Screen | Empty State Text |
|--------|-----------------|
| Conversation List | "No conversations yet. Start chatting with your SoulPrint below." |
| Pending Devices | "No pending pairing requests. Devices will appear here when they attempt to connect without being paired." |
| Paired Devices | "No paired devices" |
| Skills | "No skills found. Skills are loaded from the bot's skill directories." |
| Skills (filtered) | "No skills match your filters" |
| Conversations (admin) | "No conversations yet. Conversations will appear here as you interact with your bot via Telegram or SMS." |
| Referral Codes | "No referral codes yet. Click 'Seed Team Codes' to load your team's referral codes." |
| Bot Pool | "No bots in pool. Add pre-provisioned bots so signups with referral codes get auto-assigned." |
| Access Codes | "No access codes yet. Generate one to give a client access to their bot." |
| Alerts Feed | "No alerts yet. When issues occur, they'll appear here." |

---

## User Flow Summary

```
First Launch → Onboarding Carousel → Login
                                       ├→ Forgot Password
                                       └→ Signup Step 1 (Info Form)
                                            → Step 2 (Quick Profile chips)
                                            → Step 3 (Chat Assessment — 36 Qs as chat bubbles + bot naming)
                                            → Step 4 (Success → Start Chatting)
                                            → Step 4b (Waitlist)

Main App (after login):
  Chat tab → Conversation List → Chat Thread → Chat Info
                                             → File Preview
  Admin tab → Devices | Skills | Conversations | Clients | Fleet
  Alerts tab → Alerts Feed
  Settings tab → Settings | Profile & About
```

---

## Brand Reference

- Font: Geist (fallback: Inter, system)
- Background: #000000
- Surface: #171717
- Border: #262626
- Primary (orange): #EA580C
- Primary hover: #C2410C
- Primary light: #FB923C
- Success: #4ADE80
- Warning: #FBBF24
- Error: #EF4444
- Text primary: #FAFAFA
- Logo files: logo.png, logo-small.png
- Footer logo: Vector (3).png
