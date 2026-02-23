# Design Prompt: Results Screen — SoulPrint Orb + Personality Analytics (Signup Step 4)

## Context

SoulPrint is a personal AI assistant in closed beta. The user just finished the 36-question chat assessment and named their bot. This is the **"wow moment"** — an animated results screen that visualizes their personality as a unique, generative orb + analytics breakdown. The orb becomes their bot's permanent avatar/profile picture throughout the app.

The orb is inspired by the Siri Orb component (https://21st.dev/community/components/UmairXD/siri-orb) — a circular, animated, fluid gradient sphere. But each user's orb is **unique**, generated deterministically from their 36 assessment answers. If two people answer similarly, their orbs look similar. Unique personality = unique orb.

Same dark terminal/command center aesthetic as the rest of the app. Black background, Geist font, orange accents.

---

## The SoulPrint Orb — How It Works

### Personality → Visual DNA

The 36 answers are scored across 6 personality pillars. Each pillar produces a float value from 0.0 to 1.0. These 6 values become the orb's visual parameters:

### Tunable Parameters (what changes per user)

| Parameter | Driven By | Range | Visual Effect |
|-----------|-----------|-------|---------------|
| **Color 1 (c1)** | Communication + Emotional Intelligence | Hue 0°–120° on oklch color wheel | Low = warm reds/oranges, High = yellow-greens |
| **Color 2 (c2)** | Decision Making + Cognitive Style | Hue 120°–240° | Low = greens, High = cyan-blues |
| **Color 3 (c3)** | Social Dynamics + Assertiveness | Hue 240°–360° | Low = blues, High = violets-pinks |
| **Chroma (saturation)** | Average of all 6 scores | 0.08–0.20 | Low overall = muted/pastel, High = vivid |
| **Animation speed** | (Assertiveness + Decision Making) / 2 | 12s–28s per rotation | Decisive = faster swirl, Contemplative = slower |
| **Blur amount** | (Emotional Intelligence + Cognitive Style) / 2 | 6px–16px (at 192px size) | Intuitive = soft blur, Analytical = sharp edges |
| **Contrast** | Assertiveness score | 1.4–2.4 | High assertiveness = bolder color separation |
| **Gradient position 1** | Communication score | x: 20%–45%, y: 55%–75% | Shifts focal point of first gradient |
| **Gradient position 2** | Social Dynamics score | x: 55%–85%, y: 25%–50% | Shifts focal point of second gradient |

### Orb Technical Structure

The orb is a circular `div` with:
- `border-radius: 50%`, `overflow: hidden`
- A `::before` pseudo-element with 5–6 layered `conic-gradient()` calls at different positions, each multiplied by a rotating `--angle` CSS custom property
- `filter: blur() contrast() saturate()` to blend gradients into a fluid, organic look
- `@property --angle` animated via `@keyframes rotate` for smooth continuous rotation
- A `::after` overlay with a subtle radial gradient specular highlight
- GPU-accelerated: `will-change: transform`, `translateZ(0)`

### Orb Sizes Used in the App

| Where | Size | Notes |
|-------|------|-------|
| **This results screen** | 256px–320px | Hero element, center of screen |
| Chat thread top bar | 32px | Small, next to bot name |
| Chat bubble avatar | 24px | Inline with bot messages |
| Chat Info screen | 96px | Centered, profile view |
| Conversation list | 48px | Row thumbnail |
| Profile & About | 96px | Bot avatar |
| Access Code / Finalize screen | 96px | Small reminder |
| Success screens | 256px | Celebration |

For sizes < 48px, scale blur and contrast proportionally. The orb must still be recognizable as a thumbnail.

---

## Screen Layout

### Background

Full black (#000000). **No grid overlay** on this screen — the orb is the star. Clean, dark, let the colors pop.

### Entrance Animation Sequence (staggered, 0→3s)

This is the dopamine hit. Every element stages in sequentially:

| Time | Element | Animation |
|------|---------|-----------|
| 0s | Screen | Fade in from black (300ms) |
| 0.3s | Orb | Fade in at center, scale 0.6→1.0 over 800ms (ease-out). Gradient rotation starts immediately. |
| 1.2s | Bot name | "MEET {BOTNAME}" fades in below orb, slides up 12px (400ms) |
| 1.6s | Subtitle | Fades in (300ms) |
| 2.0s | Pillar score bars | Fade in one by one, 100ms stagger between each (6 bars = 600ms total) |
| 2.2s | Personality tags | Fade in (300ms) |
| 2.8s | CTA button | Fade in (300ms) |

### Content (centered vertically, scrollable if content overflows)

**1. SoulPrint Orb** — hero element
- 280px on mobile, 320px on desktop
- Centered horizontally
- Subtle drop-shadow glow: `0 0 60px {dominantOrbColor}` at 20% opacity
- The glow pulses slowly (opacity 15%→25%→15%, 4s loop)
- The orb rotates continuously per the user's animation speed (12–28s per full rotation)

**2. Bot Name**
- "MEET {BOTNAME}" — uppercase, wide letter-spacing (0.15em), 28px, white (#FAFAFA), Geist font, centered
- 24px below the orb

**3. Subtitle**
- "Your AI, shaped by who you are" — dimmed (#A3A3A3), 15px, regular weight, centered
- 8px below the name

**4. Pillar Score Section** — the analytics
- 32px below subtitle
- Max-width: 320px, centered

#### Section label
- "YOUR SOULPRINT PROFILE" — small uppercase monospace, dimmed (#A3A3A3), 11px, wide-tracked, centered
- Thin divider line (#262626) below, 12px spacing

#### 6 Pillar Score Bars (stacked vertically, 12px gap between each)

Each bar row layout:

```
[Icon] COMMUNICATION                    ████████████░░░░ 78%
```

- **Left**: Small icon (16×16px, dimmed #A3A3A3) + pillar name in small caps (12px, Geist Mono, dimmed #A3A3A3, uppercase, wide-tracked)
- **Right**: Percentage value (12px, monospace, dimmed)
- **Below label**: Horizontal progress bar
  - Track: #262626, height 4px, rounded ends (2px radius)
  - Fill: gradient that picks from the orb's nearest color for that pillar:
    - Communication → warm from c1
    - Emotional Intelligence → blend c1→c2
    - Decision Making → from c2
    - Social Dynamics → blend c2→c3
    - Cognitive Style → from c2
    - Assertiveness → from c3
  - Width = score percentage, rounded ends
  - **Animation**: bars grow from 0% to final width over 600ms with ease-out, staggered 100ms per bar

The 6 pillars in order:
1. COMMUNICATION
2. EMOTIONAL INTELLIGENCE
3. DECISION MAKING
4. SOCIAL DYNAMICS
5. COGNITIVE STYLE
6. ASSERTIVENESS

#### Icons per pillar (simple outlined, 16px)
- Communication: message/speech bubble
- Emotional Intelligence: heart
- Decision Making: scale/balance
- Social Dynamics: people/group
- Cognitive Style: brain/lightbulb
- Assertiveness: shield/flag

**5. Personality Snapshot Tags**
- 24px below the pillar bars
- 2–3 short descriptor tags based on highest and lowest scoring pillars
- Displayed as inline pill/chip elements, horizontally centered, wrapping if needed
- Chip style: #171717 background, #262626 border, #FAFAFA text, rounded-full, padding 6px 14px, 12px monospace text
- Gap: 8px between chips

Example tags (generated from score ranges):

| Score Range | Pillar | Tag |
|-------------|--------|-----|
| 0.8–1.0 | Communication | "Clear Communicator" |
| 0.8–1.0 | Emotional Intelligence | "Emotionally Attuned" |
| 0.8–1.0 | Decision Making | "Decisive" |
| 0.8–1.0 | Social Dynamics | "Natural Connector" |
| 0.8–1.0 | Cognitive Style | "Systems Thinker" |
| 0.8–1.0 | Assertiveness | "Boundary Setter" |
| 0.0–0.3 | Communication | "Thoughtful Listener" |
| 0.0–0.3 | Emotional Intelligence | "Steady Under Pressure" |
| 0.0–0.3 | Decision Making | "Deliberate Thinker" |
| 0.0–0.3 | Social Dynamics | "Independent Operator" |
| 0.0–0.3 | Cognitive Style | "Intuitive Learner" |
| 0.0–0.3 | Assertiveness | "Diplomatic" |
| 0.4–0.7 | Any | "Balanced" (only if 4+ pillars are mid-range) |

Show top 2–3 tags. No negatives — every tag is framed positively regardless of score.

Example output: `Clear Communicator · Decisive · Natural Connector`

**6. Insight Line** (optional, below tags)
- Small monospace text, dimmed, centered, 12px
- A one-liner that combines top traits
- Example: "You lead with clarity and connect through action."
- Generated from a simple template: "You {verb} with {trait1} and {verb2} through {trait2}."

**7. CTA Button**
- 32px below the tags/insight section
- "CONTINUE →" — full width (max 320px), orange (#EA580C), uppercase monospace, rounded corners, padding 16px
- Hover: darken to #C2410C + glow (0 0 20px rgba(234,88,12,0.3))
- On tap → navigate to Access Code / Finalize screen (Step 5)

**8. Sub-text below button**
- "Your SoulPrint has been saved" — dimmed (#A3A3A3), 12px, monospace, centered
- 8px below button

---

## Orb Interaction (polish — implement if time allows)

- **Touch/hover**: Animation speed increases 2x temporarily (springs back on release) — makes it feel alive and responsive
- **Parallax tilt**: On mobile, subtle gyroscope-based parallax — the orb responds to device tilt by 2–3° — gives depth
- **Long press / double tap**: Zooms orb to near-full-screen with dark overlay backdrop — lets users admire it, tap anywhere to dismiss

---

## Orb Generation Config — Data Shape

When the assessment is complete, these values are computed client-side and stored permanently:

```json
{
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
  "tags": ["Clear Communicator", "Decisive", "Boundary Setter"]
}
```

This config renders the exact same orb everywhere in the app — results screen, chat avatars, profile, etc. It's deterministic: same config = same visual, always.

---

## Scoring Note for Designer

The pillar scores shown on this screen can be:
- **Real**: Computed from NLP/sentiment analysis of the 36 answers (dev work needed)
- **Placeholder**: Evenly distributed random values between 0.4–0.9 for design purposes

The visual design should work with ANY 6 float values between 0.0 and 1.0. For mockups, use these example values:
- Communication: 0.78
- Emotional Intelligence: 0.65
- Decision Making: 0.82
- Social Dynamics: 0.71
- Cognitive Style: 0.59
- Assertiveness: 0.88

---

## Responsive

### Mobile (< 640px)
- Orb: 256px
- Full screen, 24px horizontal padding
- Pillar bars: full width minus padding
- Tags wrap to multiple lines if needed
- Button fixed at bottom above safe area (with scroll content above)

### Tablet / Desktop (≥ 640px)
- Orb: 320px
- Max content width: 480px, centered
- Button below content, not fixed
- More breathing room between sections (increase spacings by ~8px each)

---

## Animation Summary

| Element | Animation | Duration / Timing |
|---------|-----------|-------------------|
| Screen fade-in | Opacity 0→1 | 300ms |
| Orb appear | Scale 0.6→1 + fade in | 800ms ease-out, delay 0.3s |
| Orb rotation | Continuous `--angle` rotation | 12–28s per cycle (per user) |
| Orb glow pulse | Shadow opacity 15%→25%→15% | 4s loop |
| Bot name | Fade in + slide up 12px | 400ms, delay 1.2s |
| Subtitle | Fade in | 300ms, delay 1.6s |
| "YOUR SOULPRINT PROFILE" label | Fade in | 200ms, delay 1.9s |
| Pillar bar 1 | Width 0→final% + fade in | 600ms ease-out, delay 2.0s |
| Pillar bar 2 | Width 0→final% + fade in | 600ms ease-out, delay 2.1s |
| Pillar bar 3 | Width 0→final% + fade in | 600ms ease-out, delay 2.15s |
| Pillar bar 4 | Width 0→final% + fade in | 600ms ease-out, delay 2.2s |
| Pillar bar 5 | Width 0→final% + fade in | 600ms ease-out, delay 2.25s |
| Pillar bar 6 | Width 0→final% + fade in | 600ms ease-out, delay 2.3s |
| Tags | Fade in | 300ms, delay 2.5s |
| Insight line | Fade in | 200ms, delay 2.6s |
| CTA button | Fade in + scale 0.95→1 | 300ms, delay 2.8s |
| Orb touch/hover | Speed 1x→2x→1x | 300ms spring ease |

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
| Logo | Orange swirl/vortex mark |

---

## Where This Screen Sits in the Flow

```
Step 1: Info Form (name + email)
Step 2: Quick Profile (3 chip questions)
Step 3: Chat Assessment (36 Qs + bot naming)
→ Step 4: THIS SCREEN — Results (Orb reveal + analytics) ←
Step 5: Access Code / Finalize (enter code or join waitlist)
```

The user arrives here from the chat assessment after naming their bot. The orb and scores are computed from their 36 answers. After viewing, they tap "CONTINUE" to proceed to the final step where they either enter an access code (bot gets created) or join the waitlist.
