import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PILLAR_ORDER,
  PILLAR_DISPLAY_NAMES,
  PILLAR_QUESTIONS,
  PILLAR_TRANSITIONS,
  TOTAL_QUESTIONS,
  QUESTIONS_PER_PILLAR,
  type Pillar,
} from '../data/assessmentQuestions';
import './AssessmentStepper.css';

export interface AssessmentAnswers {
  [pillar: string]: string[];
}

interface AssessmentStepperProps {
  initialAnswers?: AssessmentAnswers;
  initialPillarIndex?: number;
  initialQuestionIndex?: number;
  onProgress: (answers: AssessmentAnswers, pillarIdx: number, questionIdx: number) => void;
  onComplete: (answers: AssessmentAnswers, goal: string) => void;
  onBack: () => void;
}

/** Pillar-specific hint messages shown below the textarea */
const PILLAR_HINTS: Record<string, string> = {
  communication: 'SoulPrint adapts tone to your communication matrix.',
  emotional: 'Mapping your emotional response patterns.',
  decision: 'Calibrating your decision-making framework.',
  social: 'Analyzing your social interaction dynamics.',
  cognitive: 'Profiling your cognitive processing style.',
  assertiveness: 'Measuring your boundary and advocacy signals.',
};

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
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

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

/** Check if Web Speech API is available */
const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export default function AssessmentStepper({
  initialAnswers,
  initialPillarIndex = 0,
  initialQuestionIndex = 0,
  onProgress,
  onComplete,
  onBack,
}: AssessmentStepperProps) {
  const [goal] = useState<string>('');

  const [answers, setAnswers] = useState<AssessmentAnswers>(() => {
    if (initialAnswers) return initialAnswers;
    const empty: AssessmentAnswers = {};
    for (const p of PILLAR_ORDER) {
      empty[p] = [];
    }
    return empty;
  });

  const [pillarIndex, setPillarIndex] = useState(initialPillarIndex);
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showTransition, setShowTransition] = useState(false);

  // Voice-to-text
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleVoice = useCallback(() => {
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        setCurrentAnswer((prev) => {
          const separator = prev && !prev.endsWith(' ') ? ' ' : '';
          return prev + separator + transcript;
        });
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // Stop listening when question changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [pillarIndex, questionIndex]);

  const pillar = PILLAR_ORDER[pillarIndex] as Pillar;
  const question = PILLAR_QUESTIONS[pillar][questionIndex];

  const answeredCount = PILLAR_ORDER.reduce((sum, p) => sum + (answers[p]?.length || 0), 0);

  const currentNumber = answeredCount + 1;
  const progressPercent = (answeredCount / TOTAL_QUESTIONS) * 100;

  useEffect(() => {
    const existing = answers[pillar]?.[questionIndex];
    setCurrentAnswer(existing || '');
  }, [pillarIndex, questionIndex, answers, pillar]);

  const notifyProgress = useCallback(
    (a: AssessmentAnswers, pi: number, qi: number) => {
      onProgress(a, pi, qi);
    },
    [onProgress],
  );

  const handleContinue = () => {
    const trimmed = currentAnswer.trim();
    if (!trimmed) return;

    const updated = { ...answers };
    const pillarAnswers = [...(updated[pillar] || [])];
    pillarAnswers[questionIndex] = trimmed;
    updated[pillar] = pillarAnswers;
    setAnswers(updated);

    const nextQI = questionIndex + 1;
    if (nextQI < QUESTIONS_PER_PILLAR) {
      setQuestionIndex(nextQI);
      setCurrentAnswer('');
      notifyProgress(updated, pillarIndex, nextQI);
    } else {
      if (pillarIndex === PILLAR_ORDER.length - 1) {
        onComplete(updated, goal);
      } else {
        const nextPI = pillarIndex + 1;
        notifyProgress(updated, nextPI, 0);
        setShowTransition(true);
        setTimeout(() => {
          setShowTransition(false);
          setPillarIndex(nextPI);
          setQuestionIndex(0);
          setCurrentAnswer('');
        }, 2000);
      }
    }
  };

  const handleBack = () => {
    if (showTransition) return;

    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    } else if (pillarIndex > 0) {
      setPillarIndex(pillarIndex - 1);
      setQuestionIndex(5);
    } else {
      onBack();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleContinue();
    }
  };

  // Pillar transition screen
  if (showTransition) {
    const completedPillar = PILLAR_ORDER[pillarIndex] as Pillar;
    const transitionText = PILLAR_TRANSITIONS[completedPillar] || 'Moving on...';

    return (
      <div className="assessment-stepper">
        {/* Header */}
        <div className="assessment-header">
          <button className="assessment-close-btn" onClick={onBack} type="button">
            <CloseIcon />
          </button>
          <div className="assessment-pillar-badge">
            Pillar: {PILLAR_DISPLAY_NAMES[completedPillar]}
          </div>
          <div className="assessment-header-spacer" />
        </div>

        {/* Progress */}
        <div className="assessment-progress">
          <div className="assessment-progress-labels">
            <span className="assessment-progress-count">
              {String(answeredCount).padStart(2, '0')}
              <span className="progress-total">/{TOTAL_QUESTIONS}</span>
            </span>
            <span className="assessment-progress-label">Assessment</span>
          </div>
          <div className="assessment-progress-track">
            <div className="assessment-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="assessment-transition">
          <p className="assessment-transition-text">{transitionText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-stepper">
      {/* Header */}
      <div className="assessment-header">
        <button className="assessment-close-btn" onClick={onBack} type="button">
          <CloseIcon />
        </button>
        <div className="assessment-pillar-badge">Pillar: {PILLAR_DISPLAY_NAMES[pillar]}</div>
        <div className="assessment-header-spacer" />
      </div>

      {/* Progress */}
      <div className="assessment-progress">
        <div className="assessment-progress-labels">
          <span className="assessment-progress-count">
            {String(currentNumber).padStart(2, '0')}
            <span className="progress-total">/{TOTAL_QUESTIONS}</span>
          </span>
          <span className="assessment-progress-label">Assessment</span>
        </div>
        <div className="assessment-progress-track">
          <div className="assessment-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Question + Answer */}
      <div className="assessment-body" key={`${pillarIndex}-${questionIndex}`}>
        <h1 className="assessment-question-text">{question}</h1>

        <div className="assessment-textarea-wrap">
          <div className={`assessment-textarea-inner ${isListening ? 'listening' : ''}`}>
            <div className="corner-tl" />
            <div className="corner-tr" />
            <div className="corner-bl" />
            <div className="corner-br" />
            <textarea
              className="assessment-textarea"
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="I usually prefer to..."
              maxLength={2000}
              autoFocus
            />
            {SpeechRecognition && (
              <button
                type="button"
                className={`assessment-mic-btn ${isListening ? 'assessment-mic-active' : ''}`}
                onClick={toggleVoice}
                aria-label={isListening ? 'Stop recording' : 'Start voice input'}
              >
                <MicIcon />
              </button>
            )}
          </div>
        </div>

        <div className={`assessment-hint ${isListening ? 'assessment-hint-listening' : ''}`}>
          <span className="assessment-hint-icon">
            <InfoIcon />
          </span>
          {isListening ? (
            <p>
              Listening... speak your answer. <strong>Tap the mic to stop.</strong>
            </p>
          ) : (
            <p>Analysis in progress: {PILLAR_HINTS[pillar] || 'Processing your response.'}</p>
          )}
        </div>
      </div>

      {/* Skip assessment option */}
      <button
        type="button"
        style={{
          background: 'none',
          border: '1px solid #444',
          color: '#666',
          fontSize: 12,
          padding: '8px 16px',
          borderRadius: 6,
          cursor: 'pointer',
          alignSelf: 'center',
          marginBottom: 8,
        }}
        onClick={() => {
          if (window.confirm('Skip the assessment? Your AI will still work, but won\'t have personalized insights about your communication style.')) {
            const filled: AssessmentAnswers = {};
            for (const p of PILLAR_ORDER) filled[p] = Array(QUESTIONS_PER_PILLAR).fill('(skipped)');
            onComplete(filled, '');
          }
        }}
      >
        Skip
      </button>

      {/* Navigation */}
      <div className="assessment-nav">
        <button className="assessment-back-btn" onClick={handleBack} type="button">
          Back
        </button>
        <button
          className="assessment-continue-btn"
          onClick={handleContinue}
          disabled={!currentAnswer.trim()}
          type="button"
        >
          <span className="assessment-continue-btn-content">
            {answeredCount === TOTAL_QUESTIONS - 1 && currentAnswer.trim() ? 'Finish' : 'Continue'}
            <ArrowIcon />
          </span>
        </button>
      </div>
    </div>
  );
}
