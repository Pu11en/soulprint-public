# Website Builder

Build and deploy professional websites for users.

## When to Use This Skill
- User asks to build a website, landing page, or web app
- User wants to deploy HTML/CSS/JavaScript
- User mentions "personal site", "portfolio", or "company page"

## Conversation Flow

### Step 1: Understand Requirements
Ask the user:
- What's the purpose of the website?
- What style do you prefer? (minimal, bold, professional, playful)
- Any specific colors or brand elements?
- What sections do you need? (hero, about, features, contact, etc.)

### Step 2: Generate Design
1. Create mobile-first responsive HTML/CSS
2. Use modern design patterns (gradients, cards, smooth transitions)
3. Keep it fast (minimal JavaScript, optimized images)
4. Include accessibility features (ARIA labels, semantic HTML)

### Step 3: Preview & Iterate
- Show the code to the user
- Ask for feedback
- Make adjustments as needed
- Don't deploy until user approves

### Step 4: Deploy
1. Use the `deploy_website` tool
2. Provide the live URL to user
3. Explain how to make future changes

## Design Best Practices

### Layout
- Clear visual hierarchy
- Generous whitespace
- Consistent spacing (8px grid)
- Max width for readability (1200px)

### Typography
- System fonts for speed: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`
- Clear heading hierarchy (h1 > h2 > h3)
- Readable line height (1.5-1.7)

### Colors
- High contrast for accessibility
- Limit to 2-3 main colors
- Use subtle gradients for depth

### Mobile
- Touch-friendly buttons (min 44px)
- Hamburger menu for navigation
- Stack elements vertically
- Test at 375px width

## Tools Used
- `deploy_website` — Deploy to Vercel
- `generate_image` — Create hero images/icons
- `browse_website` — Screenshot for preview

## Example Output Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Name</title>
  <style>
    /* Mobile-first CSS */
  </style>
</head>
<body>
  <header><!-- Navigation --></header>
  <main>
    <section class="hero"><!-- Hero content --></section>
    <section class="features"><!-- Features --></section>
  </main>
  <footer><!-- Footer --></footer>
</body>
</html>
```

## Common Mistakes to Avoid
- Don't use heavy frameworks for simple sites
- Don't forget mobile responsiveness
- Don't deploy without user confirmation
- Don't use placeholder images in production
- Don't skip meta tags (title, description, viewport)
