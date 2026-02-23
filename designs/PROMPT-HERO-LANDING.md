# Design Prompt: Landing Page Hero Section

## Context

SoulPrint is a personal AI assistant in closed beta. This is the first thing visitors see — a full-viewport hero section that drives waitlist signups. Same dark terminal/command center aesthetic as the login screen (attached screenshot). The hero must communicate what SoulPrint is, why it's different, and push toward the CTA in under 5 seconds of reading.

---

## Hero Copy

### Pre-headline (small, monospace, dimmed, above the main heading)
"CLOSED BETA — LIMITED ACCESS"

### Headline (large, bold, white, wide-tracked)
"AN AI THAT ACTUALLY KNOWS YOU"

### Subheadline (medium, regular weight, dimmed)
"SoulPrint learns how you think, talk, and work — then becomes the personal assistant you never have to re-explain yourself to."

### Body (optional — only show on desktop, hide on mobile to keep it tight)
"36 questions. One conversation. A permanent understanding of who you are — your communication style, decision patterns, emotional intelligence, and how you move through the world. Your SoulPrint powers an AI that works the way you do."

### CTA Button
"JOIN THE WAITLIST →"

### Below-CTA micro-text (small, monospace, dimmed)
"Free during beta · No credit card · 24hr onboarding"

### Social proof line (below CTA block, small)
"{count} people on the waitlist" — count pulls from backend or is hardcoded initially (e.g. "147 people on the waitlist")

---

## Feature Bullets (below hero fold or integrated as a row)

3 columns / cards, icon + short text each:

| Icon | Label | Description |
|------|-------|-------------|
| Brain / fingerprint | Remembers Everything | Your tone, your preferences, your context — across every conversation. |
| Zap / lightning | Actually Does Things | Browse the web, send emails, generate images, manage calendars — not just chat. |
| Lock / shield | Your Data, Your Rules | Private. Encrypted. Never used to train models. |

---

## Layout (top to bottom, full viewport)

### Navigation Bar (fixed top, transparent → solid on scroll)

Left: Orange swirl logo (32×32px) + "SOULPRINT" wordmark (wide-tracked, uppercase, white, 14px)

Right (desktop): "Features" · "How It Works" · "Pricing" text links (dimmed, monospace) + "SIGN IN" outlined pill button

Right (mobile): hamburger icon → slide-out menu

### Hero Content (vertically centered in viewport)

1. Pre-headline — centered, small monospace, dimmed, uppercase
2. Headline — centered, 48px desktop / 32px mobile, bold, white, max-width 720px
3. Subheadline — centered, 18px desktop / 16px mobile, dimmed (#A3A3A3), max-width 560px, line-height 1.6
4. CTA button — centered, orange (#EA580C), uppercase monospace, padding 16px 48px, rounded corners, large (18px text)
   - Hover: darken to #C2410C + subtle glow (0 0 20px rgba(234,88,12,0.3))
   - On tap → scroll to waitlist form OR open signup modal
5. Micro-text — centered, below button, 12px, monospace, dimmed
6. Social proof — centered, 13px, dimmed, with a small orange dot pulsing before the text

### Background

- Solid black (#000000)
- Faint grid overlay (same as login screen — thin lines, ~5% opacity)
- Subtle radial gradient behind the headline area: dark orange/red glow (very low opacity ~3-5%), centered, 600px radius — gives a sense of depth
- Optional: very faint horizontal scan line moving slowly top-to-bottom (parallax, nearly invisible)

### Orange swirl logo — large, centered, behind the headline text
- ~300×300px, opacity 4-6%, acts as a watermark/texture behind the hero content
- Static, not animated
- Creates a subtle branded focal point without competing with the text

---

## Waitlist Form (inline or modal)

If inline (below hero after scrolling slightly):

### Form container
- Dark surface (#171717), max-width 480px, centered, rounded corners (12px), border (#262626), padding 32px
- Heading: "REQUEST ACCESS" (uppercase, wide-tracked, white, centered)

### Fields (stacked vertically)
1. Full Name — placeholder "YOUR NAME", left-icon: user, same input styling as login screen
2. Email — placeholder "EMAIL ADDRESS", left-icon: envelope
3. Phone (optional) — placeholder "PHONE (OPTIONAL)", left-icon: phone

### Submit button
"SUBMIT REQUEST →" — full width, orange, uppercase monospace

### On submit
- POST to `/api/signup` with `{ name, email, phone, platform: "app" }`
- On `{ waitlist: true }` → show the "SIGNAL RECEIVED" popup (from PROMPT-LOGIN-WAITLIST.md)
- On error → show inline error below the form

### Footer text below form
"Already have access? **Sign in**" — links to login screen

---

## Feature Section (below hero, after form)

### Section heading
"HOW IT WORKS" — uppercase, wide-tracked, centered, monospace

### 3-step horizontal row (stacks vertically on mobile)

| Step | Heading | Text |
|------|---------|------|
| 01 | ANSWER 36 QUESTIONS | A 10-minute chat that maps how you think, communicate, decide, and interact. |
| 02 | GET YOUR SOULPRINT | We build a permanent profile — your AI's foundational understanding of you. |
| 03 | START USING IT | Message your AI on Telegram, SMS, or the web. It already knows who you are. |

Each step:
- Number: large monospace, orange (#EA580C), 48px
- Heading: white, uppercase, wide-tracked, 16px
- Text: dimmed (#A3A3A3), 14px, max-width 280px
- Vertical divider line or horizontal connector between steps (desktop only)

---

## Footer

- Left: Orange swirl logo (24×24px) + "© 2026 SoulPrint™. All rights reserved."
- Center: "Privacy Policy" · "Terms of Service" links (dimmed, small)
- Right: Social icons — X/Twitter, GitHub, LinkedIn, Bluesky, YouTube (dimmed, 20×20px, hover → white)

---

## Responsive Breakpoints

### Mobile (< 640px)
- Headline: 32px, max-width 100%, padding 24px
- Subheadline: 16px
- Body paragraph: hidden
- Feature cards: stacked vertically, full width
- Nav: hamburger menu
- Steps: stacked vertically with horizontal dividers

### Tablet (640–1024px)
- Headline: 40px
- Feature cards: 3-column row
- Steps: 3-column row

### Desktop (> 1024px)
- Headline: 48px, max-width 720px
- All sections centered, max content width 1120px

---

## Animation (subtle, performant)

| Element | Animation | Trigger |
|---------|-----------|---------|
| Pre-headline | Fade in + slide down 12px | On load, 200ms delay |
| Headline | Fade in + slide up 16px | On load, 400ms delay |
| Subheadline | Fade in | On load, 600ms delay |
| CTA button | Fade in + scale from 0.95 | On load, 800ms delay |
| Social proof dot | Pulse (opacity 0.4→1→0.4) | Loop, 2s cycle |
| Feature cards | Fade in + slide up 20px | On scroll into view, 100ms stagger |
| Steps | Fade in + slide up 20px | On scroll into view, 150ms stagger |
| Background grid | Static | — |
| Background glow | Static | — |

---

## Brand Tokens

| Token | Value |
|-------|-------|
| Font | Geist (fallback: Inter, system-ui) |
| Monospace | Geist Mono (fallback: SF Mono, Menlo) |
| Background | #000000 |
| Surface | #171717 |
| Border | #262626 |
| Primary | #EA580C |
| Primary hover | #C2410C |
| Primary glow | rgba(234,88,12,0.3) |
| Text primary | #FAFAFA |
| Text dimmed | #A3A3A3 |
| Logo | Orange swirl/vortex mark |
