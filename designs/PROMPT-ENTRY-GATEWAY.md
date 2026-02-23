# Design Prompt: Entry Gateway Screen — Revision

## Context

This is the SoulPrint entry/gateway screen — the first screen users see after the landing page hero. It gives them two paths: "I have an access code" or "Join the waitlist." The attached screenshot shows the current version from Stitch. It needs to be updated to match the visual language and brand established in the other SoulPrint screens (login, assessment, results, etc.).

This is NOT a redesign from scratch — it's a **refinement pass** to bring this screen into alignment with the rest of the app.

---

## What to keep from the current design

- The two-option card layout (Option 01 / Option 02 stacked vertically with "OR" divider)
- The general dark background
- The title block at the top (logo + "SOULPRINT" + subtitle)
- The footer with Terms/Privacy + system status
- The overall "choose your path" concept

---

## What to change

### 1. Logo
- **Replace the fingerprint icon** with the **orange swirl/vortex** logo mark
- Keep it centered, same approximate size (~80×80px)
- Keep the dark rounded-square container behind it, but make the container match brand surface color (#171717) with border (#262626)

### 2. Title Block
- "SOULPRINT" — keep the wide-tracked uppercase, but use **Geist** font (fallback: Inter, system-ui), not the current font
- Change subtitle from "IDENTITY VERIFICATION SYSTEM" to **"— PERSONAL AI SYSTEM —"** with horizontal rule accents on each side (same pattern as the login screen's "— SYSTEM ACCESS —")
- Text color: #FAFAFA for title, #A3A3A3 (dimmed) for subtitle

### 3. Background
- Change to solid **#000000** (pure black), not the current warm brown/dark brown
- Add a faint **grid overlay** (thin lines, ~5% opacity) — same as the login screen
- Optional: subtle radial gradient behind the logo area (dark orange glow at ~3-5% opacity, 400px radius) for depth

### 4. Option Cards

Both cards should match this styling:

- **Background**: #171717 (surface)
- **Border**: 1px solid #262626 (default state)
- **Border radius**: 12px
- **Padding**: 24px
- **Hover / selected state**: border changes to #EA580C (orange), faint orange tint background (rgba(234,88,12,0.08))

**Option 01 — "I HAVE AN ACCESS CODE"**
- Label: "OPTION 01" in small monospace, #EA580C (orange), 11px, uppercase
- Heading: "I HAVE AN ACCESS CODE" in white (#FAFAFA), wide-tracked uppercase, 18px, Geist font
- Icon (right side): **key icon** — change from current style to a simple outlined key icon, #EA580C stroke, no fill, 40×40px, inside a circle container with #262626 border
- On tap → navigate to Access Code entry popup (same as login screen's access code popup)

**Option 02 — "JOIN THE WAITLIST"**
- Label: "OPTION 02" in small monospace, #A3A3A3 (dimmed, NOT orange — to visually deprioritize vs Option 01), 11px, uppercase
- Heading: "JOIN THE WAITLIST" in white (#FAFAFA), wide-tracked uppercase, 18px
- Icon (right side): **queue/list icon** or **arrow-right-to-line icon** — outlined, #A3A3A3 stroke, 40×40px, inside a circle container with #262626 border
- On tap → navigate to Signup Step 1 (Info Form — name + email)

**"OR" Divider between cards:**
- Thin horizontal lines on each side (#262626), "OR" text centered, dimmed (#A3A3A3), small monospace, 12px
- Same pattern as the current design but using brand colors

### 5. Footer

- **Left side**: "Terms of Service" · "Privacy Policy" — dimmed (#A3A3A3), small text (12px), monospace or Geist, separated by an orange dot (●) at #EA580C
- **Right side / below**: "SYSTEM ONLINE V1.0.4" — replace with **"● SYSTEM ONLINE V2.4.0"** where the dot is #4ADE80 (green, pulsing slowly), text in monospace, dimmed (#A3A3A3), 11px
- The version number (V2.4.0) is cosmetic — matches the login screen footer

### 6. Typography

All text must use the brand type system:
- **Headings**: Geist, wide letter-spacing (0.15em), uppercase
- **Labels**: Geist Mono (monospace), uppercase, small
- **Body**: Geist, regular weight
- No serif fonts anywhere

### 7. Spacing & Layout

- Vertically centered content block
- Max content width: 420px on desktop, full-width with 24px padding on mobile
- Spacing: logo → 16px → title → 8px → subtitle → 48px → Option 01 card → 24px → OR divider → 24px → Option 02 card → 48px → footer
- Safe area padding at bottom for iOS home indicator

---

## Animation (subtle)

| Element | Animation | Trigger |
|---------|-----------|---------|
| Logo | Fade in + scale 0.9→1 | On load, 0ms |
| Title | Fade in | On load, 200ms delay |
| Subtitle | Fade in | On load, 300ms delay |
| Option 01 card | Fade in + slide up 12px | On load, 500ms delay |
| OR divider | Fade in | On load, 650ms delay |
| Option 02 card | Fade in + slide up 12px | On load, 700ms delay |
| Footer | Fade in | On load, 900ms delay |
| System status dot | Pulse (opacity 0.5→1→0.5) | Loop, 2s cycle |
| Card hover/tap | Border color transition | 150ms ease |

---

## Responsive

### Mobile (< 640px)
- Full screen, 24px horizontal padding
- Cards at full width
- Logo: 72×72px
- Title: 28px

### Tablet / Desktop (≥ 640px)
- Max content width: 420px, centered horizontally and vertically
- Logo: 80×80px
- Title: 32px

---

## Brand Tokens (must match exactly)

| Token | Value |
|-------|-------|
| Font | Geist (fallback: Inter, system-ui) |
| Monospace | Geist Mono (fallback: SF Mono, Menlo) |
| Background | #000000 |
| Surface | #171717 |
| Border | #262626 |
| Primary (orange) | #EA580C |
| Primary hover | #C2410C |
| Primary tint | rgba(234,88,12,0.08) |
| Primary light | #FB923C |
| Success / Online | #4ADE80 |
| Text primary | #FAFAFA |
| Text dimmed | #A3A3A3 |
| Logo | Orange swirl/vortex mark (replaces fingerprint) |

---

## Reference Screens (for visual consistency)

This screen sits in the flow between the **Landing Page Hero** and the **Signup Info Form**. It should feel like a natural visual bridge — same dark terminal aesthetic, same grid overlay, same type system, same spacing language.

Key reference points from other screens:
- **Login screen**: The "SOULPRINT" title block + "— SYSTEM ACCESS —" subtitle pattern → use same pattern here with "— PERSONAL AI SYSTEM —"
- **Login screen**: The cosmetic footer bar (SECURE SERVER / LATENCY / BUILD / ID) → simplified here to just system status + version
- **Login screen**: Grid overlay + scan line background treatment → apply same here
- **Access Code popup**: The modal that appears when Option 01 is tapped — same design as the login screen's "ENTER ACCESS CODE" popup
- **Waitlist flow**: Option 02 leads to the Info Form (name + email), then Quick Profile, then Assessment, then Results, then waitlist confirmation

---

## User Flow from This Screen

```
Entry Gateway
  ├→ Option 01: "I HAVE AN ACCESS CODE"
  │     → Access Code popup (enter code)
  │     → Valid → redirect to bot's worker URL / success
  │     → Invalid → error state in popup
  │
  └→ Option 02: "JOIN THE WAITLIST"
        → Signup Step 1: Info Form (name + email + phone)
        → Step 2: Quick Profile (3 chip questions)
        → Step 3: Chat Assessment (36 questions + bot naming)
        → Step 4: Results Screen (SoulPrint Orb reveal)
        → Step 5: Access Code / Finalize
        → Success or Waitlist confirmation
```
