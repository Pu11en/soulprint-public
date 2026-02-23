# Design Prompt: Quick Profile Screen (Signup Step 2)

## Context

SoulPrint is a personal AI assistant in closed beta. After the user fills in their name/email/phone on the Info Form, they land on this screen. It's a quick segmentation step — 3 chip-select questions. No free text. Every answer must give us actionable data: who our users are, what they'll use the product for, and where they came from.

Same dark terminal/command center aesthetic as the login screen.

---

## Screen Layout

### Top Bar (fixed)

- Back arrow (chevron left) → returns to Info Form
- Step indicator: "STEP 2 OF 4" in small monospace, dimmed (#A3A3A3)
- Progress dots: 4 dots, second one filled orange (#EA580C), rest dimmed (#262626)

### Content (vertically centered, scrollable if needed)

Padding: 24px horizontal.

**Heading**: "Tell us a bit about you" — white (#FAFAFA), 24px, bold
**Subtitle**: "So we can set things up right." — dimmed (#A3A3A3), 15px, regular

Vertical spacing: 32px between each question block.

---

### Question 1: "What do you do?"

Label: "What do you do?" — white, 16px, medium weight, left-aligned

Chips below (single select, wrap to multiple rows):
- Founder / CEO
- Product / PM
- Engineer
- Designer
- Creative / Content
- Student
- Freelancer
- Executive
- Other

**Required** — user must select one to proceed.

### Question 2: "What will you use SoulPrint for most?"

Label: "What will you use SoulPrint for most?" — same styling as Q1

Chips (single select):
- Work tasks & productivity
- Research & learning
- Writing & content
- Scheduling & planning
- Personal assistant
- Just exploring

**Required.**

### Question 3: "How did you find us?"

Label: "How did you find us?" — same styling

Chips (single select):
- Twitter / X
- Instagram
- TikTok
- YouTube
- Friend or referral
- Search engine
- Other

**Required.**

---

### Chip Styling

- Unselected: #171717 background, #262626 border (1px), #FAFAFA text, rounded-full (24px radius), padding 10px 18px, 14px text
- Selected: #EA580C border (1.5px), #EA580C text, faint orange tint background (rgba(234,88,12,0.1))
- Hover (desktop): border lightens to #A3A3A3
- Tap feedback (mobile): brief scale pulse (scale 0.96 → 1, 100ms)
- Gap between chips: 8px horizontal, 10px vertical
- Chips wrap naturally — no horizontal scrolling

Only one chip selected per question. Tapping a new chip deselects the previous one in that group.

---

### CTA Button (bottom, fixed or below content)

"CONTINUE →" — full width, orange (#EA580C), uppercase monospace, rounded corners, padding 16px
- Disabled state: opacity 0.4, not tappable — enabled only when all 3 questions have a selection
- Loading state: "PROCESSING..." with subtle pulse
- On tap → navigate to Chat Assessment (Screen 6)

Safe area padding below for iOS home indicator.

---

## Responsive

### Mobile (< 640px)
- Full screen, 24px horizontal padding
- Chips take full available width, wrapping as needed
- Button fixed at bottom above safe area

### Tablet / Desktop (≥ 640px)
- Max content width: 480px, centered
- Button below content (not fixed), centered

---

## Brand Tokens

| Token | Value |
|-------|-------|
| Font | Geist (fallback: Inter, system-ui) |
| Monospace | Geist Mono |
| Background | #000000 |
| Surface | #171717 |
| Border | #262626 |
| Primary | #EA580C |
| Primary tint | rgba(234,88,12,0.1) |
| Text primary | #FAFAFA |
| Text dimmed | #A3A3A3 |

---

## Data sent to backend

These 3 answers are included in the final `POST /api/signup` body alongside the assessment answers:

```json
{
  "name": "Drew Pullen",
  "email": "drew@example.com",
  "quickProfile": {
    "role": "Founder / CEO",
    "useCase": "Work tasks & productivity",
    "source": "Twitter / X"
  },
  "assessmentAnswers": { ... },
  "botName": "Atlas"
}
```

The `source` field is also sent to Streak CRM as the lead source for attribution tracking.
