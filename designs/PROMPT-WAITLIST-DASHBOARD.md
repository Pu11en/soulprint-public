# Design Prompt: Waitlist User Dashboard — SoulPrint Results + Status

## Context

SoulPrint is a personal AI assistant in closed beta. This screen is what a **returning waitlist user** sees after logging in. They previously completed the 36-question assessment and are waiting for a bot to be assigned. This is their personal dashboard — it shows their SoulPrint personality analysis and waitlist status.

Same dark terminal/command center aesthetic as the rest of the app. Black background, Geist font, orange accents. This should feel premium and exclusive — not like a "please wait" screen but like a VIP lounge where they can admire what's being built for them.

---

## Who Sees This Screen

Users who:
- Completed signup (name, email, phone, password)
- Completed the 36-question personality assessment
- Named their bot
- Are on the waitlist (no bot assigned yet)

They should NOT have access to chat, admin, or any other app features. Just this dashboard.

---

## Screen Layout

### Header Bar (sticky top)
- Left: SoulPrint orange swirl logo (32px) + "SOULPRINT" wordmark (white text, 14px, Geist, wide tracking)
- Right: User's name (dimmed, 13px) + "Log Out" text button (dimmed, hover → white)
- Background: #000000, border-bottom: 1px solid #262626
- Height: 56px

### Hero Section — The Orb (center of page)

- SoulPrint Orb — 256px (mobile) / 320px (desktop)
- Generated from their assessment answers (same orb they saw during signup)
- Continuously rotating, glow pulse animation
- Below orb: "MEET {BOTNAME}" — their chosen bot name, uppercase, 28px, white, Geist, wide tracking
- Below name: "Your AI, shaped by who you are" — 15px, dimmed (#A3A3A3)

### Status Card (below orb, 24px gap)

A bordered card (#171717 bg, #262626 border, 12px rounded corners, max-width 400px, centered):

- **Status indicator** at top:
  - Orange dot (pulsing) + "WAITLIST — PRIORITY ACCESS" in small monospace (11px, #EA580C, uppercase, wide tracking)
- **Body text** (14px, dimmed):
  - "Your SoulPrint profile is ready. We're setting up {botName} and will notify you when it's time to connect."
- **Email reminder** (12px, monospace, dimmed):
  - "Notifications will be sent to {email}"
- **Position indicator** (cosmetic, bottom of card):
  - Small monospace: "QUEUE POSITION: PRIORITY" (or "#3" if you want to show a number)
  - This is cosmetic — makes them feel close to the front

### Personality Profile Section (below status card, 32px gap)

- Section label: "YOUR SOULPRINT PROFILE" — small uppercase monospace, dimmed, 11px, centered
- Thin divider (#262626)

#### 6 Pillar Score Bars (same as the Results screen from signup)

Each row:
```
[Icon] COMMUNICATION                    ████████████░░░░ 78%
```

- Pillar icon (16px, dimmed) + name (12px, Geist Mono, dimmed, uppercase)
- Score percentage (12px, monospace, dimmed)
- Progress bar: track #262626, fill uses pillar color from orb, 4px height, rounded
- Animate bars on page load (grow from 0% → final width, staggered)

The 6 pillars:
1. COMMUNICATION — speech bubble icon
2. EMOTIONAL INTELLIGENCE — heart icon
3. DECISION MAKING — scale icon
4. SOCIAL DYNAMICS — people icon
5. COGNITIVE STYLE — brain icon
6. ASSERTIVENESS — shield icon

#### Personality Tags (below bars, 20px gap)
- 2-3 trait chips: #171717 bg, #262626 border, #FAFAFA text, pill shape, 12px monospace
- Examples: "Clear Communicator" · "Decisive" · "Boundary Setter"
- Centered, wrap if needed

#### Insight Line (below tags, 8px gap)
- Small dimmed monospace (12px), centered
- Example: "You lead with clarity and connect through action."

### Footer Area (bottom of content, 48px gap)

- "Want to retake the assessment?" — dimmed text link (12px)
  - On click: show confirmation ("This will reset your SoulPrint profile. Continue?")
- App version: "SOULPRINT v2.4.0" — very small, dimmed monospace (10px), centered
- Below: "© 2026 SoulPrint™. All rights reserved." — 10px, dimmed

---

## Key Design Principles

1. **This is NOT a "waiting room"** — it's a premium profile dashboard. The user should feel like they already have something valuable (their SoulPrint analysis).

2. **The orb is the hero** — it's their unique visual identity. It should dominate the screen and feel alive.

3. **Status is clear but not desperate** — "priority access" framing, not "you're #847 in line."

4. **Minimal chrome** — no sidebar, no bottom nav, no clutter. Just the orb, status, and profile. Clean.

5. **Information hierarchy**: Orb → Status → Profile → Tags → Footer

---

## Entrance Animation (staggered, same timing as Results screen)

| Time | Element | Animation |
|------|---------|-----------|
| 0s | Header | Slide down from -56px (200ms) |
| 0.2s | Orb | Scale 0.8→1.0, fade in (600ms ease-out) |
| 0.8s | Bot name | Fade in + slide up 12px (400ms) |
| 1.0s | Subtitle | Fade in (300ms) |
| 1.2s | Status card | Fade in + slide up 8px (400ms) |
| 1.6s | Profile label | Fade in (200ms) |
| 1.8s | Pillar bars | Staggered fill, 100ms between each |
| 2.4s | Tags | Fade in (300ms) |
| 2.6s | Insight line | Fade in (200ms) |

---

## Responsive

### Mobile (< 640px)
- Orb: 256px
- Full width, 24px horizontal padding
- Status card: full width minus padding
- Pillar bars: full width
- Tags wrap

### Desktop (≥ 640px)
- Orb: 320px
- Max content width: 480px, centered
- More vertical breathing room (+8px between sections)

---

## Brand Tokens

| Token | Value |
|-------|-------|
| Font | Geist (fallback: Inter, system-ui) |
| Monospace | Geist Mono (fallback: SF Mono, Menlo) |
| Background | #000000 |
| Surface | #171717 |
| Border | #262626 |
| Primary (orange) | #EA580C |
| Primary hover | #C2410C |
| Primary glow | rgba(234,88,12,0.3) |
| Text primary | #FAFAFA |
| Text dimmed | #A3A3A3 |
| Success | #4ADE80 |
| Logo | Orange swirl/vortex mark (public/images/Vector (3).png or the SVG version) |

---

## Data Shape (same as Results screen)

The dashboard pulls the same data that was generated during signup:

```json
{
  "user": {
    "name": "Drew Pullen",
    "email": "drew@soulprint.ai",
    "botName": "Atlas"
  },
  "orbConfig": {
    "c1": "oklch(75% 0.15 45)",
    "c2": "oklch(80% 0.12 190)",
    "c3": "oklch(78% 0.14 310)",
    "animationDuration": 18,
    "blurAmount": 10,
    "contrastAmount": 1.9,
    "gradientPos1": { "x": 32, "y": 65 },
    "gradientPos2": { "x": 70, "y": 38 }
  },
  "pillarScores": {
    "communication": 0.78,
    "emotional_intelligence": 0.65,
    "decision_making": 0.82,
    "social_dynamics": 0.71,
    "cognitive_style": 0.59,
    "assertiveness": 0.88
  },
  "tags": ["Clear Communicator", "Decisive", "Boundary Setter"],
  "insight": "You lead with clarity and connect through action.",
  "status": "waitlist",
  "queuePosition": "priority"
}
```

---

## What This Screen Does NOT Have

- No sidebar or bottom navigation
- No chat interface
- No admin features
- No settings (except log out)
- No way to message the bot (they don't have one yet)
- No pricing or upgrade CTAs
