# Design Prompt: Login Screen + Waitlist Signup Flow

## Context

SoulPrint is a personal AI assistant platform in **closed beta**. We need testers. The login screen doubles as the entry point to a **waitlist signup** that feeds into Streak CRM. The screenshot attached shows the existing login design — keep that aesthetic but adapt it for the waitlist flow described below.

The second attachment is the **new SoulPrint logo** — an orange swirl/vortex mark. Replace the fingerprint icon in the existing design with this logo wherever it appears.

---

## What changed from the previous design spec

The old signup had 8 steps (Info → Quick Profile → Intro monologue → Goal Selection → 36-question form stepper → Naming Ceremony → Success). The new version has **4 steps**:

1. **Info Form** — name, email, phone, access code
2. **Quick Profile** — 3 chip-select questions (role, communication style, referral source)
3. **Chat Assessment** — looks like a real chat thread (bot bubbles on left, user replies on right), 36 scripted questions across 6 pillars with transition messages between pillars, then bot asks "what should I call myself?" at the end — all in one chat-style screen
4. **Success** — either "Your SoulPrint is Ready" (bot assigned) or "You're on the list" (waitlist)

The removed screens:
- "I've Been Waiting For You" intro monologue — cut
- Goal Selection (5 radio cards) — cut
- Naming Ceremony (dedicated screen) — merged into the chat assessment
- Profile and About — merged into a single screen

These changes are already reflected in the master spec (SCREENS.md). This prompt focuses on the **Login screen** and the **waitlist confirmation popup**.

---

## Screen: Login / System Access

Reference: the attached screenshot. Keep the same visual language but apply these updates:

### Layout (top to bottom)

1. **Logo**: Replace the fingerprint icon with the new orange swirl/vortex logo mark. Keep it centered, same size (~80×80px), with a subtle dark rounded-square container behind it.

2. **Title block**:
   - "SOULPRINT" in wide-tracked uppercase (same as screenshot)
   - Subtitle: "— SYSTEM ACCESS —" with horizontal rule accents on each side

3. **Email input**:
   - Left icon: envelope (mail)
   - Placeholder: "ENTER EMAIL ID" (uppercase, monospace)
   - Dark surface background (#171717), rounded corners, subtle border (#262626)

4. **Password input**:
   - Left icon: lock
   - Placeholder: "ENTER PASSCODE" (uppercase, monospace)
   - Right icon: eye toggle (show/hide)
   - Same styling as email input

5. **"Forgot password?"** — right-aligned text link below password field, monospace, dimmed text

6. **Primary CTA button**:
   - Text: "INITIALIZE SESSION →" (uppercase, monospace, with right arrow)
   - Full width, orange background (#EA580C), rounded corners, bold
   - Hover: darken to #C2410C
   - Loading state: text changes to "AUTHENTICATING..." with a subtle pulse animation

7. **Secondary links**:
   - "Don't have an account? **Sign up**" — "Sign up" is underlined, links to Signup Step 1 (Info Form)
   - "Already have an access code?" — pill-shaped outlined button, links to access code entry

8. **Footer bar** (bottom of screen, small monospace text, dimmed):
   - Left column: "SECURE SERVER: ON" / "LATENCY: {ms}ms"
   - Right column: "BUILD v2.4.0" / "ID: {sessionId}"
   - These are cosmetic/decorative — the latency can be a random value between 8–15ms, the ID is a random 3-digit + 2-letter code

### Visual details from screenshot to preserve
- Very dark background (#000000) with a faint **grid overlay** (thin lines, very low opacity ~5%)
- Subtle horizontal **scan line / gradient band** across the middle of the screen (dark red/orange tint, very faint)
- All text is monospace or wide-tracked sans-serif
- Inputs have generous padding (16–20px vertical)
- The overall feel is "secure terminal / command center" — not generic SaaS

---

## Popup: Waitlist Confirmation

After a user submits the waitlist signup (no referral code → goes to Streak CRM), show a **modal/popup overlay** before navigating to the waitlist success screen (Screen 8 in current spec).

### Trigger
- User completes Signup Step 1 (Info Form) without a valid referral code
- Backend POST to `/api/signup` returns `{ success: true, waitlist: true }`
- The submission also creates a Streak CRM box (lead) with: name, email, phone, platform, source: "Waitlist signup"

### Popup layout

1. **Backdrop**: dark overlay (#000000 at 60% opacity), blurred background

2. **Modal container**:
   - Dark surface (#171717), rounded corners (12px), border (#262626)
   - Max width: 420px, centered
   - Padding: 32px

3. **Content (top to bottom)**:
   - Orange swirl logo (small, 48×48px, centered)
   - Heading: "SIGNAL RECEIVED" (uppercase, wide-tracked, white)
   - Divider line (thin, #262626)
   - Body text: "Your neural signature has been logged. We're onboarding testers in small batches to ensure quality."
   - Body text: "You'll hear from us within **24 hours** at **{email}**."
   - Status line (monospace, dimmed, small): "STATUS: QUEUED — POSITION #{position}" where position is a random number between 12–48 (cosmetic)
   - Divider line
   - "ACKNOWLEDGED" button — full width, orange (#EA580C), uppercase monospace
   - Small text below button: "You can close this window"

4. **Animation**: modal slides up from bottom with a slight fade-in (300ms ease-out)

5. **On "ACKNOWLEDGED" tap**: close popup, navigate to waitlist success screen (Screen 8)

---

## Popup: Access Code Entry

When user taps "Already have an access code?" from the login screen:

### Popup layout

1. **Backdrop**: same dark overlay as waitlist popup

2. **Modal container**: same styling

3. **Content**:
   - Heading: "ENTER ACCESS CODE" (uppercase, wide-tracked)
   - Text input: single field, monospace, placeholder "SP-XXXXXX", auto-uppercase, centered text, larger font (20px)
   - "ACTIVATE" button — full width, orange
   - "Cancel" text link below
   - Error state: "Invalid code" in red (#EF4444) below the input
   - Loading state: "VERIFYING..." on the button

4. **On valid code**: redirect to the assigned bot's worker URL or show success screen

---

## Brand tokens (same as master spec)

| Token | Value |
|-------|-------|
| Font | Geist (fallback: Inter, system-ui) |
| Monospace font | Geist Mono (fallback: SF Mono, Menlo) |
| Background | #000000 |
| Surface | #171717 |
| Border | #262626 |
| Primary | #EA580C |
| Primary hover | #C2410C |
| Primary light | #FB923C |
| Success | #4ADE80 |
| Warning | #FBBF24 |
| Error | #EF4444 |
| Text primary | #FAFAFA |
| Text dimmed | #A3A3A3 |

## Logo

The new logo is the **orange swirl/vortex** mark (attached as the second image). It replaces the fingerprint icon from the original design. Use it:
- Login screen: centered above title, ~80×80px
- Waitlist popup: centered above heading, ~48×48px
- Onboarding carousel: on each card or as a persistent top element
- Any other place the old fingerprint appeared

---

## Files the backend expects

The waitlist signup hits `POST /api/signup` with this JSON body:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "phone": "+15551234567",
  "platform": "app"
}
```

Response for waitlist: `{ "success": true, "waitlist": true }`
Response for referred user: `{ "success": true, "platform": "telegram", "telegramBotUrl": "https://t.me/botname", "workerUrl": "...", "botId": "..." }`

Access code validation hits `POST /api/signup/validate-code` with: `{ "referralCode": "DREW2026" }`
Response: `{ "valid": true, "message": "Referred by Drew" }` or `{ "valid": false, "message": "Invalid referral code" }`
