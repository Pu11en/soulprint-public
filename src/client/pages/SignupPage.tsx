import { useState, useEffect, useCallback, useMemo } from 'react';
import { submitSignup, validateReferralCode, type SignupResponse } from '../api';
import { saveChatSession } from './ChatPage';
import AssessmentStepper, { type AssessmentAnswers } from '../components/AssessmentStepper';
import { PILLAR_ORDER } from '../data/assessmentQuestions';
import './SignupPage.css';

interface SignupPageProps {
  onNavigate: (page: string) => void;
}

const DRAFT_KEY = 'soulprint-assessment-draft';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AssessmentDraft {
  name: string;
  email: string;
  password: string;
  accessCode: string;
  answers: AssessmentAnswers;
  botName: string;
  step: number;
  currentPillar: number;
  currentQuestion: number;
  goal?: string;
  savedAt: string;
}

function loadDraft(): AssessmentDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as AssessmentDraft;
    const age = Date.now() - new Date(draft.savedAt).getTime();
    if (age > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(draft: AssessmentDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** SVG icon components — inlined to match login page style */
function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function validateBotName(value: string): string {
  if (!value.trim()) return 'Please give your bot a name';
  if (value.length > 64) return 'Name must be 64 characters or less';
  if (!/^[a-zA-Z0-9\s-]+$/.test(value)) return 'Letters, numbers, spaces, and hyphens only';
  return '';
}

/**
 * Steps:
 *   1 = Info form (name, email, phone, optional access code)
 *   2 = Profile (role, comm preference, source)
 *   3 = Intro screen ("Discover Your Blueprint")
 *   4 = Assessment stepper (36 questions)
 *   5 = Naming ceremony ("What should your bot be called?")
 *   6 = Success (bot created — had valid access code)
 *   7 = Waitlist confirmation (no access code)
 *
 * Platform is hardcoded to "app" (in-app chat).
 */
export default function SignupPage({ onNavigate }: SignupPageProps) {
  const [step, setStep] = useState(1);

  // User details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');

  // Profile
  const [nickname, setNickname] = useState('');
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [useCases, setUseCases] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [commPreference, setCommPreference] = useState('');

  // Assessment
  const [assessmentAnswers, setAssessmentAnswers] = useState<AssessmentAnswers>(() => {
    const empty: AssessmentAnswers = {};
    for (const p of PILLAR_ORDER) empty[p] = [];
    return empty;
  });
  const [assessmentPillar, setAssessmentPillar] = useState(0);
  const [assessmentQuestion, setAssessmentQuestion] = useState(0);
  const [goal, setGoal] = useState('');

  // Naming
  const [botName, setBotName] = useState('');
  const [botNameError, setBotNameError] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SignupResponse | null>(null);
  const [error, setError] = useState('');

  // Draft resume prompt
  const [draftAvailable, setDraftAvailable] = useState(false);

  // Cosmetic footer values — randomized once per mount
  const footerMeta = useMemo(() => {
    const latency = Math.floor(Math.random() * 8) + 8;
    const digits = String(Math.floor(Math.random() * 900) + 100);
    const letters =
      String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
      String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return { latency, id: `${digits}-${letters}` };
  }, []);

  // Pre-fill nickname when name is entered (only if nickname is still blank)
  useEffect(() => {
    if (name.trim() && !nickname) {
      setNickname(name.trim().split(' ')[0]);
    }
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleUseCase = useCallback((uc: string) => {
    setUseCases((prev) => (prev.includes(uc) ? prev.filter((u) => u !== uc) : [...prev, uc]));
  }, []);

  // Pre-fill access code from URL param: /#signup?ref=DREW2026
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[?&]ref=([^&]+)/);
    if (match) {
      setAccessCode(decodeURIComponent(match[1]));
    }
  }, []);

  // Check if user is already authenticated (e.g., via Google OAuth)
  // If so, skip step 1 and go to step 2 (intro)
  useEffect(() => {
    const token = localStorage.getItem('soulprint-auth-token');
    if (token && step === 1) {
      // Fetch user data and skip to intro
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user && !data.assessmentCompleted) {
            // Pre-fill user data from authenticated session
            setName(data.user.name || '');
            setEmail(data.user.email || '');
            setNickname((data.user.name || '').split(' ')[0]);
            // Skip to step 2 (profile/intro)
            setStep(2);
          }
        })
        .catch(() => {
          // If token is invalid, stay on step 1
        });
    }
  }, [step]);

  // Check for saved draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.step >= 2) {
      setDraftAvailable(true);
    }
  }, []);

  // beforeunload warning during assessment/naming
  useEffect(() => {
    if (step >= 2 && step <= 5) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [step]);

  const resumeDraft = useCallback(() => {
    const draft = loadDraft();
    if (!draft) return;
    setName(draft.name);
    setEmail(draft.email);
    setPassword(draft.password || '');
    setAccessCode(draft.accessCode);
    setAssessmentAnswers(draft.answers);
    setBotName(draft.botName);
    setAssessmentPillar(draft.currentPillar);
    setAssessmentQuestion(draft.currentQuestion);
    setGoal(draft.goal || '');
    setStep(draft.step);
    setDraftAvailable(false);
  }, []);

  const startFresh = useCallback(() => {
    clearDraft();
    setDraftAvailable(false);
  }, []);

  // Persist draft on every change during steps 2-5
  const persistDraft = useCallback(() => {
    if (step >= 2 && step <= 5) {
      saveDraft({
        name,
        email,
        password,
        accessCode,
        answers: assessmentAnswers,
        botName,
        step,
        currentPillar: assessmentPillar,
        currentQuestion: assessmentQuestion,
        goal,
        savedAt: new Date().toISOString(),
      });
    }
  }, [
    step,
    name,
    email,
    password,
    accessCode,
    assessmentAnswers,
    botName,
    assessmentPillar,
    assessmentQuestion,
    goal,
  ]);

  useEffect(() => {
    persistDraft();
  }, [persistDraft]);

  // Step 1: Submit info form → go to profile
  const handleSubmitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // If access code provided, validate it upfront
    if (accessCode.trim()) {
      try {
        const res = await validateReferralCode(accessCode.trim());
        if (!res.valid) {
          setError(res.message || 'Invalid access code. You can remove it or try another.');
          return;
        }
      } catch (err) {
        setError('Could not validate access code. Try again.');
        return;
      }
    }

    setSubmitting(false);
    setStep(2);
  };

  // Step 4: Assessment progress callback
  const handleAssessmentProgress = useCallback(
    (answers: AssessmentAnswers, pillarIdx: number, questionIdx: number) => {
      setAssessmentAnswers(answers);
      setAssessmentPillar(pillarIdx);
      setAssessmentQuestion(questionIdx);
    },
    [],
  );

  // Step 4: Assessment complete
  const handleAssessmentComplete = useCallback(
    (answers: AssessmentAnswers, selectedGoal: string) => {
      console.log('[SignupPage] Assessment complete! Going to step 5. name:', name, 'email:', email);
      setAssessmentAnswers(answers);
      setGoal(selectedGoal);
      setStep(5); // Naming ceremony
    },
    [name, email],
  );

  // Step 5: Submit everything
  const handleFinalSubmit = async () => {
    const nameErr = validateBotName(botName);
    if (nameErr) {
      setBotNameError(nameErr);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await submitSignup({
        name,
        email,
        phone: phone || undefined,
        password,
        platform: 'app',
        referralCode: accessCode.trim() || undefined,
        assessmentAnswers,
        botName: botName.trim(),
        goal,
        // Step 2 profile data (user research)
        role: role || undefined,
        commPreference: commPreference || undefined,
        source: source || undefined,
      });

      console.log('[SignupPage] submitSignup response:', JSON.stringify(res));
      if (res.success) {
        setResult(res);
        clearDraft();
        console.log('[SignupPage] res.waitlist:', res.waitlist, 'res.workerUrl:', res.workerUrl);
        if (res.waitlist) {
          console.log('[SignupPage] Going to step 7 (waitlist)');
          setStep(7); // Waitlist
        } else if (res.workerUrl) {
          // Save chat session and navigate to chat
          saveChatSession({
            email: email.trim().toLowerCase(),
            clientName: res.clientName || name,
            botName: res.botName || botName.trim(),
            workerUrl: res.workerUrl,
          });
          setStep(6); // Brief transition, then auto-navigate
          setTimeout(() => onNavigate('chat'), 2000);
        } else {
          setStep(6); // Fallback — static success
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('[SignupPage] submitSignup error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 1) {
      onNavigate('gateway');
    } else if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      setStep(3);
    } else if (step === 5) {
      setStep(4);
    } else {
      onNavigate('home');
    }
  };

  // Debug logging on step change
  useEffect(() => {
    console.log('[SignupPage] Current step:', step, 'name:', name, 'email:', email, 'botName:', botName);
  }, [step, name, email, botName]);

  return (
    <div className="signup-page">
      <div
        className={`signup-container signup-fade-in ${step === 4 ? 'signup-container-wide' : ''}`}
      >
        {/* Back button — hidden on success/waitlist */}
        {step !== 6 && step !== 7 && (
          <button className="signup-back" onClick={handleBack} type="button">
            &larr; {step === 1 ? 'Back' : 'Back'}
          </button>
        )}

        {/* Draft resume banner */}
        {step === 1 && draftAvailable && (
          <div className="signup-draft-banner">
            <p>You have an unfinished assessment.</p>
            <div className="signup-draft-actions">
              <button
                className="signup-submit-btn"
                onClick={resumeDraft}
                type="button"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <span className="signup-submit-btn-content">Resume</span>
              </button>
              <button className="signup-btn-secondary" onClick={startFresh} type="button">
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* -- Step 1: Info Form -- */}
        {step === 1 && (
          <>
            {/* Logo + Title */}
            <div className="signup-logo-wrap">
              <div className="signup-logo-icon">
                <img src="/images/Vector (3).png" alt="SoulPrint" className="signup-logo-img" />
              </div>

              <h1 className="signup-title">SOULPRINT</h1>

              <div className="signup-subtitle-row">
                <div className="signup-subtitle-line" />
                <span className="signup-subtitle-text">Create Account</span>
                <div className="signup-subtitle-line" />
              </div>
            </div>

            {/* Form */}
            <div className="signup-form-area">
              <form onSubmit={handleSubmitInfo}>
                <div className="signup-fields">
                  {/* Full Name */}
                  <div className="signup-input-wrap">
                    <div className="corner-tl" />
                    <div className="corner-tr" />
                    <div className="corner-bl" />
                    <div className="corner-br" />
                    <span className="signup-input-icon">
                      <UserIcon />
                    </span>
                    <input
                      className="signup-input"
                      type="text"
                      id="signup-name"
                      name="name"
                      placeholder="FULL NAME"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />
                    <label htmlFor="signup-name" className="sr-only">
                      Full Name
                    </label>
                  </div>

                  {/* Email */}
                  <div className="signup-input-wrap">
                    <div className="corner-tl" />
                    <div className="corner-tr" />
                    <div className="corner-bl" />
                    <div className="corner-br" />
                    <span className="signup-input-icon">
                      <EnvelopeIcon />
                    </span>
                    <input
                      className="signup-input"
                      type="email"
                      id="signup-email"
                      name="email"
                      placeholder="EMAIL ADDRESS"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <label htmlFor="signup-email" className="sr-only">
                      Email Address
                    </label>
                  </div>

                  {/* Password */}
                  <div className="signup-input-wrap">
                    <div className="corner-tl" />
                    <div className="corner-tr" />
                    <div className="corner-bl" />
                    <div className="corner-br" />
                    <span className="signup-input-icon">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      className="signup-input"
                      type={showPassword ? 'text' : 'password'}
                      id="signup-password"
                      name="password"
                      placeholder="CREATE PASSWORD"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <label htmlFor="signup-password" className="sr-only">
                      Password
                    </label>
                    <button
                      type="button"
                      className="signup-visibility-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                          <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                          <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                          <path d="m2 2 20 20" />
                        </svg>
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Access Code (Optional) */}
                  <div className="signup-input-wrap">
                    <div className="corner-tl" />
                    <div className="corner-tr" />
                    <div className="corner-bl" />
                    <div className="corner-br" />
                    <span className="signup-input-icon">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15.5 7.5 19 4" />
                        <path d="m21 2-4.3 4.3" />
                        <circle cx="10" cy="14" r="7" />
                      </svg>
                    </span>
                    <input
                      className="signup-input"
                      type="text"
                      id="signup-access-code"
                      name="accessCode"
                      placeholder="ACCESS CODE (OPTIONAL)"
                      autoComplete="off"
                      value={accessCode}
                      onChange={(e) => {
                        setAccessCode(e.target.value.toUpperCase());
                      }}
                      maxLength={20}
                    />
                    <label htmlFor="signup-access-code" className="sr-only">
                      Access Code (Optional)
                    </label>
                  </div>
                </div>

                {error && <div className="signup-error">{error}</div>}

                {/* Submit */}
                <button
                  type="submit"
                  className="signup-submit-btn"
                  disabled={submitting}
                  style={{ marginTop: 24 }}
                >
                  <span className="signup-submit-btn-content">
                    {submitting ? (
                      <>
                        <span className="signup-spinner" />
                        PROCESSING...
                      </>
                    ) : (
                      <>
                        BEGIN ASSESSMENT
                        <ArrowIcon />
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* Divider */}
              <div className="signup-divider">
                <div className="signup-divider-line" />
                <span className="signup-divider-text">OR</span>
                <div className="signup-divider-line" />
              </div>

              {/* Google Sign Up */}
              <a
                href={`/api/auth/google${accessCode ? `?code=${encodeURIComponent(accessCode)}` : ''}`}
                className="signup-google-btn"
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </a>

              {/* Bottom links */}
              <div className="signup-bottom-links">
                <button
                  type="button"
                  className="signup-login-link"
                  onClick={() => onNavigate('login')}
                >
                  Already have an account? <strong>Login</strong>
                </button>
              </div>
            </div>

            {/* Footer status bar */}
            <div className="signup-footer-bar">
              <div>
                <p>SECURE SERVER: ON</p>
                <p>LATENCY: {footerMeta.latency}ms</p>
              </div>
              <div className="signup-footer-right">
                <p>BUILD v2.4.0</p>
                <p>ID: {footerMeta.id}</p>
              </div>
            </div>
          </>
        )}

        {/* -- Step 2: Profile -- */}
        {step === 2 && (
          <div className="profile-screen">
            {/* "Welcome aboard!" heading */}
            <h1 className="profile-heading">Welcome aboard{nickname ? `, ${nickname}` : ''}!</h1>
            <p className="profile-subtitle">
              Quick intro so your SoulPrint knows who it's working with.
            </p>

            {/* NICKNAME */}
            <div className="profile-section">
              <div className="profile-section-label">
                <svg
                  className="profile-section-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>What should your SoulPrint call you?</span>
              </div>
              <div className="profile-nickname-wrap">
                <input
                  type="text"
                  className="profile-nickname-input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="First name, nickname, whatever feels right"
                  maxLength={32}
                />
              </div>
            </div>

            {/* WHAT'S YOUR ROLE? */}
            <div className="profile-section">
              <div className="profile-section-label">
                <svg
                  className="profile-section-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="14" x="2" y="7" rx="2" />
                  <path d="M16 3h-4a2 2 0 0 0-2 2v2h8V5a2 2 0 0 0-2-2z" />
                </svg>
                <span>What best describes you?</span>
              </div>
              <div className="profile-chips">
                {[
                  'Entrepreneur',
                  'Founder / CEO',
                  'Executive',
                  'Engineer',
                  'Creative',
                  'Consultant',
                  'Investor',
                  'Student',
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`profile-chip ${role === r ? 'profile-chip-active' : ''}`}
                    onClick={() => setRole(r)}
                  >
                    {role === r && <span className="profile-chip-check">&#10003;</span>}
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* INDUSTRY */}
            <div className="profile-section">
              <div className="profile-section-label">
                <svg
                  className="profile-section-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                </svg>
                <span>What's your field?</span>
              </div>
              <div className="profile-chips">
                {[
                  'Tech',
                  'Finance',
                  'Real Estate',
                  'Healthcare',
                  'Crypto / Web3',
                  'E-commerce',
                  'Media',
                  'Consulting',
                  'Legal',
                  'Education',
                  'Other',
                ].map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    className={`profile-chip ${industry === ind ? 'profile-chip-active' : ''}`}
                    onClick={() => setIndustry(ind)}
                  >
                    {industry === ind && <span className="profile-chip-check">&#10003;</span>}
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* USE CASES — multi-select */}
            <div className="profile-section">
              <div className="profile-section-label">
                <svg
                  className="profile-section-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                  <path d="m2 17 10 5 10-5" />
                  <path d="m2 12 10 5 10-5" />
                </svg>
                <span>What should your SoulPrint help with?</span>
              </div>
              <p className="profile-section-hint">Select all that apply</p>
              <div className="profile-chips">
                {[
                  'Research & Analysis',
                  'Content Creation',
                  'Scheduling & Reminders',
                  'Networking & Intros',
                  'Personal Life',
                  'Travel Planning',
                  'Health & Wellness',
                  'Learning & Growth',
                  'Business Strategy',
                  'Creative Projects',
                ].map((uc) => (
                  <button
                    key={uc}
                    type="button"
                    className={`profile-chip ${useCases.includes(uc) ? 'profile-chip-active' : ''}`}
                    onClick={() => toggleUseCase(uc)}
                  >
                    {useCases.includes(uc) && <span className="profile-chip-check">&#10003;</span>}
                    {uc}
                  </button>
                ))}
              </div>
            </div>

            {/* SOURCE */}
            <div className="profile-section">
              <div className="profile-section-label">
                <svg
                  className="profile-section-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>How did you find us?</span>
              </div>
              <div className="profile-source-grid">
                {[
                  'Friend / Referral',
                  'Social Media',
                  'AI / ChatGPT',
                  'Podcast',
                  'Google Search',
                  'Event / Conference',
                  'Ads',
                  'Other',
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`profile-chip profile-source-chip ${source === s ? 'profile-chip-active' : ''}`}
                    onClick={() => setSource(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Continue button */}
            <button
              className="signup-submit-btn"
              onClick={() => setStep(3)}
              type="button"
              style={{ marginTop: 24 }}
            >
              <span className="signup-submit-btn-content">
                CONTINUE
                <ArrowIcon />
              </span>
            </button>
          </div>
        )}

        {/* -- Step 3: Intro Screen (Orb + Pillar Preview) -- */}
        {step === 3 && (
          <div className="intro-reveal">
            {/* Logo */}
            <div className="intro-logo-wrap">
              <div className="intro-logo-glow" />
              <img src="/images/Vector (3).png" alt="SoulPrint" className="intro-logo-img" />
            </div>

            {/* Header */}
            <div className="intro-header">
              <p className="intro-label">SOULPRINT ASSESSMENT</p>
              <h1 className="intro-title">Discover Your Blueprint</h1>
              <p className="intro-subtitle">
                A short series of questions across six pillars of who you are. No right or wrong
                answers — just be real.
              </p>
            </div>

            {/* Pillar preview cards */}
            <div className="intro-pillars-grid">
              <div className="intro-pillar-card">
                <div className="intro-pillar-card-header">
                  <span className="intro-pillar-name">Communication</span>
                  <svg
                    className="intro-pillar-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="intro-pillar-desc">How you express and connect</p>
              </div>
              <div className="intro-pillar-card">
                <div className="intro-pillar-card-header">
                  <span className="intro-pillar-name">Emotional Intel.</span>
                  <svg
                    className="intro-pillar-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </div>
                <p className="intro-pillar-desc">How you feel and process</p>
              </div>
              <div className="intro-pillar-card">
                <div className="intro-pillar-card-header">
                  <span className="intro-pillar-name">Decision Making</span>
                  <svg
                    className="intro-pillar-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                </div>
                <p className="intro-pillar-desc">How you choose and commit</p>
              </div>
              <div className="intro-pillar-card">
                <div className="intro-pillar-card-header">
                  <span className="intro-pillar-name">Social Dynamics</span>
                  <svg
                    className="intro-pillar-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <p className="intro-pillar-desc">How you navigate people</p>
              </div>
              <div className="intro-pillar-card">
                <div className="intro-pillar-card-header">
                  <span className="intro-pillar-name">Cognitive Style</span>
                  <svg
                    className="intro-pillar-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z" />
                    <line x1="10" y1="22" x2="14" y2="22" />
                  </svg>
                </div>
                <p className="intro-pillar-desc">How you think and learn</p>
              </div>
              <div className="intro-pillar-card">
                <div className="intro-pillar-card-header">
                  <span className="intro-pillar-name">Assertiveness</span>
                  <svg
                    className="intro-pillar-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <p className="intro-pillar-desc">How you hold your ground</p>
              </div>
            </div>

            {/* CTA */}
            <button className="signup-submit-btn" onClick={() => setStep(4)} type="button">
              <span className="signup-submit-btn-content">
                BEGIN ASSESSMENT
                <ArrowIcon />
              </span>
            </button>
          </div>
        )}

        {/* -- Step 4: Assessment Stepper -- */}
        {step === 4 && (
          <AssessmentStepper
            initialAnswers={assessmentAnswers}
            initialPillarIndex={assessmentPillar}
            initialQuestionIndex={assessmentQuestion}
            onProgress={handleAssessmentProgress}
            onComplete={handleAssessmentComplete}
            onBack={() => setStep(3)}
          />
        )}

        {/* -- Step 5: Naming Ceremony -- */}
        {step === 5 && (
          <div className="signup-naming-screen">
            {/* Logo */}
            <div className="naming-orb-container">
              <div className="naming-orb-glow" />
              <div className="naming-orb">
                <div className="naming-orb-ring naming-orb-ring-1" />
                <div className="naming-orb-ring naming-orb-ring-2" />
                <div className="naming-orb-ring naming-orb-ring-3" />
                <div className="naming-orb-core">
                  <img src="/images/Vector (3).png" alt="SoulPrint" className="naming-orb-logo" />
                </div>
              </div>
              <div className="naming-scan-line" />
            </div>

            <h1 className="signup-heading-large">One Last Thing</h1>

            <div className="signup-naming-body">
              <p className="naming-lead">
                I've learned a lot about you,{' '}
                <span className="naming-highlight">{(name || 'friend').split(' ')[0]}</span>.
              </p>
              <p className="naming-sub">Now I need a name. What should your bot be called?</p>
            </div>

            <div className="signup-form-area naming-form-area">
              <div className="naming-input-container">
                <div className="naming-input-glow" />
                <div className="signup-input-wrap">
                  <div className="corner-tl" />
                  <div className="corner-tr" />
                  <div className="corner-bl" />
                  <div className="corner-br" />
                  <span className="signup-input-icon">
                    <BotIcon />
                  </span>
                  <input
                    className="signup-input naming-input"
                    type="text"
                    value={botName}
                    onChange={(e) => {
                      setBotName(e.target.value);
                      setBotNameError('');
                    }}
                    placeholder="GIVE ME A NAME..."
                    maxLength={64}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFinalSubmit();
                      }
                    }}
                  />
                </div>
              </div>

              {botNameError && <div className="signup-error">{botNameError}</div>}
              {error && <div className="signup-error">{error}</div>}

              <button
                className="signup-submit-btn naming-submit-btn"
                onClick={handleFinalSubmit}
                disabled={submitting || !botName.trim()}
                type="button"
              >
                <span className="signup-submit-btn-content">
                  {submitting ? (
                    <>
                      <span className="signup-spinner" />
                      CREATING SOULPRINT...
                    </>
                  ) : (
                    <>
                      CREATE MY SOULPRINT
                      <ArrowIcon />
                    </>
                  )}
                </span>
              </button>

              <div className="naming-readout">
                <span>SYS.PROFILE.READY</span>
                <span className="naming-readout-sep">|</span>
                <span>ASSESSMENT COMPLETE</span>
              </div>
            </div>
          </div>
        )}

        {/* -- Step 6: Success — brief transition then auto-nav to chat -- */}
        {step === 6 && (
          <div className="signup-naming-screen">
            <div className="naming-orb-container">
              <div className="naming-orb-glow" />
              <div className="naming-orb">
                <div className="naming-orb-ring naming-orb-ring-1" />
                <div className="naming-orb-ring naming-orb-ring-2" />
                <div className="naming-orb-ring naming-orb-ring-3" />
                <div className="naming-orb-core">
                  <img src="/images/Vector (3).png" alt="SoulPrint" className="naming-orb-logo" />
                </div>
              </div>
              <div className="naming-scan-line" />
            </div>

            <h1 className="signup-heading-large">Creating Your SoulPrint...</h1>

            <div className="signup-naming-body">
              <p className="naming-lead">
                {botName ? (
                  <>
                    <span className="naming-highlight">{botName}</span> is coming online.
                  </>
                ) : (
                  'Your bot is coming online.'
                )}
              </p>
              <p className="naming-sub">
                Initializing personality matrix and loading your assessment data.
              </p>
            </div>

            <div className="naming-readout">
              <span
                className="signup-spinner"
                style={{ width: 12, height: 12, borderWidth: 1.5 }}
              />
              <span>ESTABLISHING NEURAL LINK</span>
            </div>
          </div>
        )}

        {/* -- Step 7: Waitlist Confirmation (answers saved) -- */}
        {step === 7 && (
          <div className="signup-naming-screen">
            <div className="naming-orb-container">
              <div className="naming-orb-glow" />
              <div className="naming-orb">
                <div className="naming-orb-ring naming-orb-ring-1" />
                <div className="naming-orb-ring naming-orb-ring-2" />
                <div className="naming-orb-ring naming-orb-ring-3" />
                <div className="naming-orb-core">
                  <img src="/images/Vector (3).png" alt="SoulPrint" className="naming-orb-logo" />
                </div>
              </div>
            </div>

            <h1 className="signup-heading-large">You're On The List</h1>

            <div className="signup-naming-body">
              <p className="naming-lead">
                Thanks, <span className="naming-highlight">{(name || 'friend').split(' ')[0]}</span>.
              </p>
              <p className="naming-sub">
                Your answers are saved. When you're accepted, just log in and{' '}
                <strong style={{ color: '#d4d4d4' }}>{botName || 'your bot'}</strong> will be ready
                — no need to redo anything.
              </p>
              <p className="naming-sub" style={{ marginTop: '10px', color: '#888' }}>
                We'll reach out when a spot opens up.
              </p>
            </div>

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              marginTop: '20px',
              width: '100%',
              maxWidth: '320px'
            }}>
              <button
                className="signup-submit-btn naming-submit-btn"
                onClick={() => onNavigate('home')}
                type="button"
                style={{ 
                  background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                  border: 'none'
                }}
              >
                <span className="signup-submit-btn-content">GOT IT — BACK TO HOME</span>
              </button>
            </div>

            <div className="naming-readout" style={{ marginTop: '30px' }}>
              <span>36 ANSWERS SAVED</span>
              <span className="naming-readout-sep">|</span>
              <span>PROFILE LOCKED IN</span>
            </div>
          </div>
        )}

        {/* Fallback for unexpected steps */}
        {step > 7 && (
          <div style={{ color: 'white', padding: 40, textAlign: 'center' }}>
            <h2>Unexpected state (step {step})</h2>
            <button onClick={() => onNavigate('home')} style={{ marginTop: 20, padding: '10px 20px' }}>
              Go Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
