import { useState } from 'react';
import { SoulPrintWordmark } from '../components/SoulPrintLogo';
import './LandingPage.css';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

/* ── Icon Components ── */

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.33 8H12.67M8.67 4L12.67 8L8.67 12"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.25s ease',
      }}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="#737373"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Social icons */
function IconX() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconGithub() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function IconLinkedin() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconBluesky() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.596 6.449.764 2.794 3.504 3.403 5.944 3.067-.04.016-.077.032-.113.048-3.638 1.626-3.089 5.198.97 6.281C10.945 20.822 12 18.795 12 18.795s1.055 2.027 4.603.818c4.059-1.083 4.608-4.655.97-6.281a2.292 2.292 0 0 0-.113-.048c2.44.336 5.18-.273 5.944-3.067C23.622 9.418 24 4.458 24 3.768c0-.689-.139-1.861-.902-2.203-.659-.3-1.664-.62-4.3 1.24C16.046 4.747 13.087 8.686 12 10.8Z" />
    </svg>
  );
}

function IconYoutube() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
      <path fill="#D4D4D4" d="M9.545 15.568V8.432L15.818 12z" />
    </svg>
  );
}

/* ══════════════════════════════════════ */
/* Landing Page Component                */
/* ══════════════════════════════════════ */

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqItems = [
    {
      question: 'What is SoulPrint?',
      answer:
        'SoulPrint is your personal AI companion that lives in your Telegram and SMS. It learns how you think, how you talk, and what matters to you — so every conversation feels like talking to someone who actually knows you.',
    },
    {
      question: 'What can it actually do?',
      answer:
        'Way more than chat. It can browse the web, generate images, look things up, manage your calendar, send emails, and help you plan your day — all from a simple message in Telegram or SMS.',
    },
    {
      question: 'How is this different from ChatGPT?',
      answer:
        'ChatGPT starts fresh every time. SoulPrint remembers. It carries your context, preferences, and personality across every conversation — like a best friend who never forgets. And it lives right in Telegram and SMS.',
    },
    {
      question: 'Does it work with voice?',
      answer:
        'Yes! Send a voice message in Telegram and it understands you. On your phone, you can even talk to it hands-free and hear it reply out loud.',
    },
    {
      question: 'Is my data private?',
      answer:
        'Yes. Your conversations are encrypted and private. We never use your data to train AI models. What you say stays between you and your SoulPrint — nobody else sees it.',
    },
    {
      question: 'How do I get started?',
      answer:
        "Take a quick questionnaire about how you communicate, or import your past chats from ChatGPT. Then connect via Telegram or SMS and start chatting — it's that simple.",
    },
  ];

  return (
    <div className="landing">
      {/* ═══ HERO ═══ */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-left">
            <div className="hero-title-block">
              <h1 className="hero-heading">STOP RE-EXPLAINING YOURSELF TO AI</h1>
              <p className="hero-body">
                Chat, organize, reflect, and plan with an AI that remembers your tone, your tempo,
                and your life.
              </p>
            </div>
            <div className="hero-buttons">
              <button className="btn-hero-primary" onClick={() => onNavigate('login')}>
                Get your SoulPrint
              </button>
              <button
                className="btn-hero-ghost"
                onClick={() =>
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                Explore <ArrowRight />
              </button>
            </div>
          </div>
          <div className="hero-image">
            <img
              src="/images/hero-rendered.png"
              alt="SoulPrint AI Interface"
              className="hero-image-inner"
            />
          </div>
        </div>
      </section>

      {/* ═══ FEATURES / BLOG CARDS ═══ */}
      <section className="features-section" id="features">
        <div className="features-container">
          <div className="features-header">
            <h2 className="features-heading">Your AI best friend, right in your chat.</h2>
            <p className="features-subtitle">
              SoulPrint lives in your Telegram and SMS — no new apps to download. Just message it
              like you'd message a friend.
            </p>
          </div>
          <div className="features-cards">
            <article className="fcard">
              <img
                src="/images/card-1-rendered.png"
                alt="Lives in Telegram & SMS"
                className="fcard-img"
              />
              <div className="fcard-body">
                <span className="fcard-meta">Channels</span>
                <h3 className="fcard-title">Lives in Telegram & SMS</h3>
                <p className="fcard-text">
                  No new apps to install. Just message your SoulPrint in Telegram or text via SMS —
                  the same tools you already use every day.
                </p>
              </div>
            </article>
            <article className="fcard">
              <img
                src="/images/card-2-rendered.png"
                alt="It can actually do things"
                className="fcard-img"
              />
              <div className="fcard-body">
                <span className="fcard-meta">Actions</span>
                <h3 className="fcard-title">It can actually do things</h3>
                <p className="fcard-text">
                  Browse the web, generate images, manage your calendar, send emails, look things up
                  — not just chat. It takes action for you.
                </p>
              </div>
            </article>
            <article className="fcard">
              <img
                src="/images/card-3-rendered.png"
                alt="Talks and listens"
                className="fcard-img"
              />
              <div className="fcard-body">
                <span className="fcard-meta">Voice</span>
                <h3 className="fcard-title">Talks and listens</h3>
                <p className="fcard-text">
                  Send voice messages or talk hands-free. Your SoulPrint can listen, understand
                  photos you send, and even reply out loud on your phone.
                </p>
              </div>
            </article>
            <article className="fcard">
              <img
                src="/images/card-4-rendered.png"
                alt="Your data stays yours"
                className="fcard-img"
              />
              <div className="fcard-body">
                <span className="fcard-meta">Privacy</span>
                <h3 className="fcard-title">Your data stays yours</h3>
                <p className="fcard-text">
                  Your conversations are private and encrypted. We never use your data to train AI
                  models. What you say stays between you and your SoulPrint.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ACCORDION ═══ */}
      <section className="faq-section" id="faq">
        <div className="faq-container">
          <div className="faq-accordion">
            {faqItems.map((item, i) => (
              <div key={i} className={`accordion-item${openFaq === i ? ' open' : ''}`}>
                <button
                  className="accordion-trigger"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="accordion-text">{item.question}</span>
                  <ChevronDown open={openFaq === i} />
                </button>
                {openFaq === i && (
                  <div className="accordion-content">
                    <p>{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA SECTION ═══ */}
      <section className="cta-section">
        <div className="cta-outer">
          <div className="cta-card">
            <div className="cta-left">
              <h2 className="cta-heading">Help SoulPrint Understand You Faster</h2>
              <p className="cta-desc">
                Take the SoulPrint Assessment to personalize your AI from day one. Answer a few
                questions about your communication style, preferences, and goals — and your
                assistant adapts to you instantly.
              </p>
              <button className="btn-cta-white" onClick={() => onNavigate('login')}>
                Start SoulPrint Assessment <ArrowRight />
              </button>
              <button className="btn-cta-ghost" onClick={() => onNavigate('activate')}>
                Already have an access code?
              </button>
            </div>
            <div className="cta-right">
              <img src="/images/cta-rendered.png" alt="SoulPrint Assessment" className="cta-img" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer-section">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-logo-area">
              <SoulPrintWordmark size={32} className="footer-logo" />
            </div>
            <div className="footer-social">
              <a
                href="https://x.com/soulprint"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
              >
                <IconX />
              </a>
              <a
                href="https://github.com/Pu11en"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <IconGithub />
              </a>
              <a
                href="https://www.linkedin.com/company/soulprint"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <IconLinkedin />
              </a>
              <a
                href="https://bsky.app/profile/soulprint.bsky.social"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Bluesky"
              >
                <IconBluesky />
              </a>
              <a
                href="https://youtube.com/@soulprint"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <IconYoutube />
              </a>
            </div>
            <nav className="footer-nav">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Home
              </a>
              <a href="#faq">Contact Us</a>
              <a href="#faq">FAQ</a>
            </nav>
          </div>
          <div className="footer-sep" />
          <div className="footer-bottom">
            <span className="footer-copy">
              Copyright 2026 &copy; SoulPrint&trade;. All rights reserved.
            </span>
            <div className="footer-legal">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
