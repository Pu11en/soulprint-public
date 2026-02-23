/**
 * 36-question SoulPrint assessment across 6 personality pillars.
 * Mirrors assessment-session.cjs lines 37-86.
 */

export const PILLAR_ORDER = [
  'communication',
  'emotional',
  'decision',
  'social',
  'cognitive',
  'assertiveness',
] as const;

export type Pillar = (typeof PILLAR_ORDER)[number];

export const PILLAR_DISPLAY_NAMES: Record<Pillar, string> = {
  communication: 'Communication',
  emotional: 'Emotional Intelligence',
  decision: 'Decision Making',
  social: 'Social Dynamics',
  cognitive: 'Cognitive Style',
  assertiveness: 'Assertiveness',
};

export const PILLAR_QUESTIONS: Record<Pillar, string[]> = {
  communication: [
    'When you need to share something important with someone, do you prefer to write it out or talk face-to-face?',
    'Think about the last disagreement you had. How did you approach resolving it?',
    'When someone asks for your opinion, do you tend to be direct or do you soften your words first?',
    'How do you usually react when someone misunderstands what you meant?',
    'Do you find yourself thinking carefully before speaking, or do your best ideas come out as you talk?',
    'When giving feedback to someone, what matters more to you — being honest or being kind?',
  ],
  emotional: [
    "When something unexpected goes wrong, what's your first internal reaction?",
    'How comfortable are you sitting with uncertainty — say, waiting for important news?',
    'Think of a time you felt really proud of yourself. What made that moment special?',
    'When someone close to you is upset, do you try to fix the problem or just be present with them?',
    'How do you usually process strong emotions — alone, by talking it out, or something else?',
    "What's your relationship with vulnerability? Easy, uncomfortable, or somewhere in between?",
  ],
  decision: [
    'When you face a big decision, do you research extensively or go with your gut?',
    'Think about a decision you made recently that turned out well. What drove your choice?',
    "How do you handle situations where there's no clear right answer?",
    "When you're stuck between two good options, what usually tips the scale for you?",
    'Do you tend to decide quickly and adjust, or take your time to get it right the first time?',
    "How much do other people's opinions influence your decisions?",
  ],
  social: [
    'After a long week, does being around people energize you or drain you?',
    'How do you typically build trust with someone new?',
    'In a group setting, do you naturally take the lead, support others, or observe first?',
    "What's your approach to maintaining friendships — regular check-ins or picking up where you left off?",
    "How do you handle social situations where you don't know anyone?",
    "When there's tension in a group, do you address it directly or wait for it to resolve itself?",
  ],
  cognitive: [
    'When you learn something new, do you prefer to understand the big picture first or start with the details?',
    'How do you organize your thoughts when working on a complex problem?',
    'Do you trust patterns and experience more, or do you prefer fresh data for each situation?',
    "When you're brainstorming, do you work best alone or bouncing ideas off others?",
    'How do you typically handle information overload?',
    "What's your relationship with rules and systems — do you follow them, bend them, or create your own?",
  ],
  assertiveness: [
    'When someone crosses a boundary, how quickly do you address it?',
    'How comfortable are you saying no to requests — even from people you care about?',
    'In negotiations, do you push for what you want or look for middle ground first?',
    'Think of a time you stood up for something important to you. What made you speak up?',
    'How do you handle situations where you disagree with someone in authority?',
    'When you want something, do you ask for it directly or drop hints?',
  ],
};

export const PILLAR_TRANSITIONS: Record<string, string> = {
  communication:
    "I'm getting a real sense of how you communicate. Let's shift gears and talk about how you experience emotions...",
  emotional: "Beautiful. Now let's explore how you make decisions...",
  decision: "Interesting patterns emerging. I'd like to understand your social dynamics...",
  social: "That paints a clear picture. Let's dive into how you think and process information...",
  cognitive: 'Fascinating. Last area — how you assert yourself and set boundaries...',
};

export const QUESTIONS_PER_PILLAR = 6;
export const TOTAL_QUESTIONS = PILLAR_ORDER.length * QUESTIONS_PER_PILLAR; // 36
