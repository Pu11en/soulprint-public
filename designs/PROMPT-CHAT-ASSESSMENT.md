# Design Prompt: Chat Assessment Screen (Signup Step 3)

## Context

This is the signup assessment for SoulPrint — a personal AI assistant platform in closed beta. The user has already completed:
1. Info Form (name, email, phone, access code)
2. Quick Profile (3 chip-select questions)

Now they land on this screen: a **fake chat UI** that asks 36 personality questions. It looks exactly like a real messaging app, but there is **no AI** — every bot message is pre-scripted and fires immediately. The goal is to feel like a natural conversation, not a form.

Same visual language as the login screen (dark terminal/command center aesthetic). Same brand tokens.

---

## Screen Layout

### Top Bar (fixed, sticky)

Full-width dark bar (#171717), border-bottom (#262626).

Left to right:
- Back arrow icon (chevron left) — tapping goes back to Quick Profile with confirmation: "You'll lose your progress. Leave?"
- Bot avatar: orange swirl logo, 32×32px, circular mask
- Bot name: "SoulPrint" in white, normal weight
- Status text below name: "online" in #4ADE80 (green), small size (12px)

Right side:
- Progress pill: rounded container (#262626 background), contains "{answered}/36" in monospace, dimmed text (#A3A3A3). The numbers update live as user answers.

### Progress Bar (below top bar, fixed)

Full-width thin bar (3px height):
- Track: #262626
- Fill: #EA580C (orange), animates width from 0% to 100% as answered/36
- Smooth transition (300ms ease) on each answer

Below the bar, centered:
- Pillar label in small uppercase monospace, dimmed (#A3A3A3): e.g. "COMMUNICATION" / "EMOTIONAL INTELLIGENCE" / "DECISION MAKING" / "SOCIAL DYNAMICS" / "COGNITIVE STYLE" / "ASSERTIVENESS"
- This label changes when the pillar changes (with a subtle fade transition)

### Message Area (scrollable, fills remaining space)

Standard chat layout. Dark background (#000000). Messages have vertical spacing of 8px between same-sender messages, 16px between different senders.

**Bot messages (left-aligned):**
- Small orange swirl avatar (24×24px, circular) to the left of the first message in a group
- Bubble: #171717 background, rounded corners (16px, with top-left corner 4px for first message in group)
- Text: #FAFAFA, 15px, regular weight
- Max width: 80% of screen width
- Timestamp below bubble: dimmed (#A3A3A3), 11px, relative time or "just now"

**User messages (right-aligned):**
- Bubble: #EA580C background, rounded corners (16px, with top-right corner 4px for first message in group)
- Text: #FAFAFA, 15px, regular weight
- Max width: 80% of screen width
- Timestamp below bubble: dimmed, 11px

**Typing indicator:**
- After user sends a reply, show a typing indicator on the bot side for 800ms before the next bot message appears
- Three animated dots (●●●) inside a bot-styled bubble, dots pulse/bounce sequentially
- This makes it feel like the bot is "thinking" even though responses are instant

### Input Bar (fixed at bottom)

Full-width dark bar (#171717), border-top (#262626), padding 12px horizontal, 8px vertical.

- Text input: dark background (#0A0A0A), rounded corners (24px full-round), placeholder "Type your answer..." in dimmed text (#A3A3A3), padding 12px 16px, white text when typing
- Send button: right side of input, circular, 40×40px
  - Disabled state (no text): dimmed (#A3A3A3), no background
  - Active state (text present): orange (#EA580C) background, white arrow-up icon
- No attach button, no mic button — this is assessment only
- Keyboard-aware: input bar pushes up above the virtual keyboard on mobile

Safe area padding at bottom for devices with home indicators (iOS).

---

## Message Flow & Timing

All messages are scripted. No network calls until final submission. Everything runs client-side.

### On screen load (t=0):

1. **Bot intro message** appears immediately (no typing indicator for the first message):
   > "Hey {firstName}! I'm going to ask you 36 quick questions so I can really get to know you. No right or wrong answers — just be yourself. Ready? Let's go 🚀"

2. After 1.2 second delay + 800ms typing indicator, bot sends **Question 1**:
   > "When you need to share something important with someone, do you prefer to write it out or talk face-to-face?"

3. Progress bar shows 0/36. Pillar label shows "COMMUNICATION".

### On each user reply:

1. User types answer and taps send
2. User bubble appears immediately, scrolls into view
3. Progress counter updates: "{n}/36"
4. Progress bar animates to new width
5. 400ms pause → typing indicator appears
6. After 800ms typing indicator → next bot message appears
7. Auto-scroll to bottom

### Pillar transitions:

When moving from one pillar to the next (after questions 6, 12, 18, 24, 30), the bot sends a **transition message** before the next question:

| After question | Transition message |
|---|---|
| 6 (end of Communication) | "I'm getting a real sense of how you communicate. Let's shift gears and talk about how you experience emotions..." |
| 12 (end of Emotional Intelligence) | "Beautiful. Now let's explore how you make decisions..." |
| 18 (end of Decision Making) | "Interesting patterns emerging. I'd like to understand your social dynamics..." |
| 24 (end of Social Dynamics) | "That paints a clear picture. Let's dive into how you think and process information..." |
| 30 (end of Cognitive Style) | "Fascinating. Last area — how you assert yourself and set boundaries..." |

Timing for transitions:
1. User sends answer to Q6/12/18/24/30
2. 600ms pause → typing indicator (1.2s, slightly longer than normal)
3. Transition message appears
4. Pillar label updates with fade animation
5. 800ms pause → typing indicator (800ms)
6. Next question appears

### After question 36 (bot naming):

1. User sends answer to Q36
2. Progress shows 36/36, bar is 100% filled
3. 600ms pause → typing indicator (1.2s)
4. Bot sends: "That was awesome, {firstName}. I feel like I really know you now. ✨"
5. 800ms pause → typing indicator (800ms)
6. Bot sends: "One last thing — what should I call myself?"
7. Input placeholder changes to "Give me a name..."
8. Pillar label changes to "NAMING"

### After user types bot name:

1. User types name and sends
2. 400ms pause → typing indicator (800ms)
3. Bot sends: "Love it. **{botName}** it is. Setting things up for you now... ⚙️"
4. 1.5 second pause
5. Auto-navigate to Success screen (Screen 7 or 8)
6. At this point, POST the full assessment data to `/api/signup`

---

## All 36 Questions (exact text)

### Communication (questions 1–6):
1. "When you need to share something important with someone, do you prefer to write it out or talk face-to-face?"
2. "Think about the last disagreement you had. How did you approach resolving it?"
3. "When someone asks for your opinion, do you tend to be direct or do you soften your words first?"
4. "How do you usually react when someone misunderstands what you meant?"
5. "Do you find yourself thinking carefully before speaking, or do your best ideas come out as you talk?"
6. "When giving feedback to someone, what matters more to you — being honest or being kind?"

### Emotional Intelligence (questions 7–12):
7. "When something unexpected goes wrong, what's your first internal reaction?"
8. "How comfortable are you sitting with uncertainty — say, waiting for important news?"
9. "Think of a time you felt really proud of yourself. What made that moment special?"
10. "When someone close to you is upset, do you try to fix the problem or just be present with them?"
11. "How do you usually process strong emotions — alone, by talking it out, or something else?"
12. "What's your relationship with vulnerability? Easy, uncomfortable, or somewhere in between?"

### Decision Making (questions 13–18):
13. "When you face a big decision, do you research extensively or go with your gut?"
14. "Think about a decision you made recently that turned out well. What drove your choice?"
15. "How do you handle situations where there's no clear right answer?"
16. "When you're stuck between two good options, what usually tips the scale for you?"
17. "Do you tend to decide quickly and adjust, or take your time to get it right the first time?"
18. "How much do other people's opinions influence your decisions?"

### Social Dynamics (questions 19–24):
19. "After a long week, does being around people energize you or drain you?"
20. "How do you typically build trust with someone new?"
21. "In a group setting, do you naturally take the lead, support others, or observe first?"
22. "What's your approach to maintaining friendships — regular check-ins or picking up where you left off?"
23. "How do you handle social situations where you don't know anyone?"
24. "When there's tension in a group, do you address it directly or wait for it to resolve itself?"

### Cognitive Style (questions 25–30):
25. "When you learn something new, do you prefer to understand the big picture first or start with the details?"
26. "How do you organize your thoughts when working on a complex problem?"
27. "Do you trust patterns and experience more, or do you prefer fresh data for each situation?"
28. "When you're brainstorming, do you work best alone or bouncing ideas off others?"
29. "How do you typically handle information overload?"
30. "What's your relationship with rules and systems — do you follow them, bend them, or create your own?"

### Assertiveness (questions 31–36):
31. "When someone crosses a boundary, how quickly do you address it?"
32. "How comfortable are you saying no to requests — even from people you care about?"
33. "In negotiations, do you push for what you want or look for middle ground first?"
34. "Think of a time you stood up for something important to you. What made you speak up?"
35. "How do you handle situations where you disagree with someone in authority?"
36. "When you want something, do you ask for it directly or drop hints?"

---

## States & Edge Cases

### Draft persistence
- All answers save to localStorage after each reply: `soulprint_assessment_draft`
- Stored as: `{ answers: { "communication_1": "user text", ... }, currentQuestion: 14, botName: null }`
- On return to this screen with a draft: bot replays all previous messages instantly (no typing delays), then resumes from where user left off
- Info Form (Screen 4) shows "You have an unfinished assessment" banner if draft exists

### Empty answer prevention
- Send button disabled when input is empty
- Minimum 2 characters required (no single-letter spam)
- No maximum character limit in the input, but answers are trimmed to 2000 chars before saving

### Bot name validation
- 1–64 characters
- Letters, numbers, spaces, hyphens only
- If invalid: bot responds "Hmm, let's keep it simple — letters, numbers, and spaces only. Try again?" and the input stays on the naming step
- If empty: send button stays disabled

### Scroll behavior
- Auto-scroll to newest message on every new message
- If user has scrolled up (reading old messages), show a "↓ New message" pill at the bottom — tapping scrolls to latest
- Smooth scroll animation (200ms)

### Back navigation
- Back arrow → confirmation dialog: "You'll lose your progress. Leave?"
- "Stay" button (primary), "Leave" button (secondary/destructive)
- Hardware back button / swipe-back gesture → same confirmation

### Offline / error
- This screen works entirely offline (all scripted, no network needed until final submit)
- On final submit failure: retry button appears above the input, "Something went wrong. Tap to retry."

---

## Responsive Behavior

### Mobile (< 640px)
- Full screen, no side margins
- Message bubbles: max-width 85%
- Input bar flush to bottom edge (above safe area)

### Tablet / Desktop (≥ 640px)
- Max container width: 640px, centered
- Side areas: solid #000000
- Same chat layout inside the container
- Input bar stays within the container, not full-width

---

## Animation Summary

| Element | Animation | Duration |
|---------|-----------|----------|
| Bot typing indicator | 3 dots bounce sequentially | Loop (each dot 400ms offset) |
| Bot message appear | Fade in + slide up 8px | 200ms ease-out |
| User message appear | Fade in + slide up 8px | 150ms ease-out |
| Progress bar fill | Width transition | 300ms ease |
| Pillar label change | Fade out → fade in | 200ms + 200ms |
| Scroll to bottom | Smooth scroll | 200ms |
| "New message" pill | Fade in | 150ms |

---

## Brand Tokens

| Token | Value |
|-------|-------|
| Font | Geist (fallback: Inter, system-ui) |
| Monospace font | Geist Mono (fallback: SF Mono, Menlo) |
| Background | #000000 |
| Surface | #171717 |
| Border | #262626 |
| Input background | #0A0A0A |
| Primary (orange) | #EA580C |
| Primary hover | #C2410C |
| Primary light | #FB923C |
| Success / Online | #4ADE80 |
| Error | #EF4444 |
| Text primary | #FAFAFA |
| Text dimmed | #A3A3A3 |
| Bot bubble bg | #171717 |
| User bubble bg | #EA580C |
| Typing dot color | #A3A3A3 |

---

## Data Shape (for developer handoff)

Answers are stored client-side during the assessment, then submitted all at once:

```json
{
  "name": "Drew Pullen",
  "email": "drew@example.com",
  "phone": "+15551234567",
  "platform": "app",
  "botName": "Atlas",
  "assessmentAnswers": {
    "communication": [
      "I usually write it out first...",
      "I try to stay calm and listen...",
      "Pretty direct, but I read the room...",
      "I'll usually clarify right away...",
      "I think before I speak most of the time...",
      "Honesty, but delivered kindly..."
    ],
    "emotional_intelligence": ["...", "...", "...", "...", "...", "..."],
    "decision_making": ["...", "...", "...", "...", "...", "..."],
    "social_dynamics": ["...", "...", "...", "...", "...", "..."],
    "cognitive_style": ["...", "...", "...", "...", "...", "..."],
    "assertiveness": ["...", "...", "...", "...", "...", "..."]
  }
}
```

POST to `/api/signup`. Response: `{ "success": true, "waitlist": true }` or `{ "success": true, "botId": "...", ... }`.
