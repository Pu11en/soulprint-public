# Design Prompt: Assessment Intro Screen (Pre-Signup)

## Context

SoulPrint is a personal AI assistant in closed beta. This screen sits between the Entry Gateway ("I have an access code" / "Join the waitlist") and the Signup Info Form. When a user taps "JOIN THE WAITLIST", they land here FIRST — a single, focused screen that explains what they're about to do and why it matters. Then they proceed to sign up.

This is NOT the landing page hero. The landing page is for discovery. This screen is for the user who already clicked — they're interested but need to understand the commitment (36 questions, ~10 minutes) before they give their name and email.

Keep it short. One scroll. No fluff. Direct.

Same dark terminal/command center aesthetic.

---

## Screen Layout

### Background

- Solid black (#000000)
- Faint grid overlay (thin lines, ~5% opacity) — same as login screen
- Subtle radial glow behind the center content (dark orange, ~3% opacity, 500px radius)

### Top Bar (minimal)

- Back arrow (chevron left) → returns to Entry Gateway
- No step indicator — this is a standalone info screen, not part of the numbered signup flow

### Content (single column, centered, vertically centered on viewport)

Max-width: 480px. Padding: 24px horizontal.

---

### 1. Icon / Visual (top, centered)

- Orange swirl logo, 64×64px, centered
- Faint glow behind it (rgba(234,88,12,0.1), 120px blur radius)

### 2. Pre-headline

- "10 MINUTES. 36 QUESTIONS." — small monospace, #EA580C (orange), 12px, uppercase, wide-tracked, centered
- 16px below logo

### 3. Headline

- "THE ONLY AI SETUP YOU'LL EVER DO" — white (#FAFAFA), 24px desktop / 22px mobile, bold, Geist, uppercase, wide letter-spacing (0.1em), centered, max-width 400px
- 12px below pre-headline

### 4. Body — The Pitch (direct, no marketing fluff)

- 16px below headline
- Text: dimmed (#A3A3A3), 15px, Geist, regular weight, line-height 1.7, centered
- Max-width: 400px

Copy:

> "Every AI assistant starts from zero — it doesn't know how you think, how you talk, or how you make decisions. So you spend weeks re-explaining yourself.
>
> SoulPrint fixes that. One conversation. 36 questions across six dimensions of your personality. When it's done, your AI already knows you."

### 5. The 6 Pillars — Visual List

- 32px below body text
- Section label: "WHAT WE MAP" — small uppercase monospace, dimmed (#A3A3A3), 11px, wide-tracked, centered
- Thin divider line (#262626), 12px below label

6 items in a 2×3 grid (or 3×2 on wider screens):

| Icon | Label |
|------|-------|
| 💬 Speech bubble | COMMUNICATION |
| 🧠 Brain | EMOTIONAL INTELLIGENCE |
| ⚖️ Scale | DECISION MAKING |
| 👥 People | SOCIAL DYNAMICS |
| 💡 Lightbulb | COGNITIVE STYLE |
| 🛡️ Shield | ASSERTIVENESS |

Each grid cell:
- Dark surface (#171717), rounded corners (8px), border (#262626), padding 16px
- Icon: 20×20px, #EA580C (use simple outlined icons, not emoji — emoji shown here for reference only)
- Label: 11px, Geist Mono, uppercase, wide-tracked, #FAFAFA, centered below icon
- Gap between cells: 8px

### 6. Key Differentiators — 3 Short Lines

- 24px below the grid
- 3 one-line statements, each with an orange bullet/check mark, left-aligned within a centered block (max-width 340px):

```
✓  No right or wrong answers
✓  Takes about 10 minutes
✓  Your data stays private — never used to train models
```

Each line:
- Check mark: #EA580C, 14px
- Text: #FAFAFA, 14px, Geist, regular weight
- 8px gap between lines

### 7. CTA Button

- 32px below differentiators
- "GET STARTED →" — full width (max 400px), orange (#EA580C), uppercase monospace, rounded corners, padding 16px, 16px text
- Hover: darken to #C2410C + glow (0 0 20px rgba(234,88,12,0.3))
- On tap → navigate to Signup Info Form (name + email)

### 8. Skip/Login Link

- 12px below CTA button
- "Already have an account? **Sign in**" — dimmed (#A3A3A3), 13px, "Sign in" in #FAFAFA underlined
- Links to Login screen

---

## Animation (subtle entrance)

| Element | Animation | Trigger |
|---------|-----------|---------|
| Logo | Fade in + scale 0.9→1 | On load, 0ms |
| Pre-headline | Fade in | 200ms delay |
| Headline | Fade in + slide up 8px | 300ms delay |
| Body text | Fade in | 500ms delay |
| "WHAT WE MAP" label | Fade in | 700ms delay |
| Grid cells | Fade in + slide up 8px | 800ms delay, 80ms stagger between cells |
| Differentiators | Fade in | 1.2s delay |
| CTA button | Fade in + scale 0.95→1 | 1.4s delay |
| Sign in link | Fade in | 1.5s delay |

All animations: ease-out, 200–300ms duration each.

---

## Responsive

### Mobile (< 640px)
- Full screen, 24px padding
- Pillar grid: 2 columns × 3 rows
- Headline: 22px
- CTA button fixed at bottom above safe area (with scroll content above if needed)

### Tablet / Desktop (≥ 640px)
- Max content width: 480px, centered vertically and horizontally
- Pillar grid: 3 columns × 2 rows
- Headline: 24px
- CTA button inline (not fixed)

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

---

## Where This Screen Sits in the Flow

```
Landing Page → Entry Gateway (Access Code / Waitlist)
                                    │
                          "JOIN THE WAITLIST"
                                    │
                                    ▼
                    → THIS SCREEN (Assessment Intro) ←
                                    │
                              "GET STARTED →"
                                    │
                                    ▼
                    Step 1: Info Form (name + email)
                    Step 2: Quick Profile (3 chips)
                    Step 3: Chat Assessment (36 Qs)
                    Step 4: Results (Orb + Analytics)
                    Step 5: Access Code / Finalize
```

This screen is the "why" before the "what." It converts curious clickers into committed users by being direct about what they're doing and why it's worth 10 minutes.
