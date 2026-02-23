import React, { useState } from 'react';
import RadioCard from './RadioCard';

interface AssessmentGoalScreenProps {
  onContinue: (goal: string) => void;
  onBack: () => void;
}

export default function AssessmentGoalScreen({ onContinue, onBack }: AssessmentGoalScreenProps) {
  const [goal, setGoal] = useState('productivity');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
      {/* Left Side: Cinematic Visual (Desktop Only) */}
      <div className="hidden lg:flex relative w-1/2 h-full bg-black items-center justify-center overflow-hidden border-r border-primary/10">
        {/* Scanline Overlay */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
            backgroundSize: '100% 4px, 3px 100%',
          }}
        ></div>
        {/* Grid Background Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"></div>

        {/* Ouroboros Symbol */}
        <div className="relative z-10 w-3/4 h-3/4 flex items-center justify-center">
          <img
            alt="Glowing neon orange Ouroboros symbol"
            className="w-full h-full object-contain opacity-90 drop-shadow-[0_0_20px_rgba(222,83,13,0.6)]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2ttT-Pw6CCw044oNZncghspbx4esUVgtAHOVLZwQr_bA1YOOeyZ_fdxrIMIuyE9mAqHPJQaXyTgsrPitbmsOHRwsEYow-fU-EfgENSr2LfRI-xpIrGevnndHu3AnGG8S7TaZt0DUX-II0E-0lc44HhxUoT-wBIsROVopoGN0GxmOdweXvOkjwqBgrH_6GPhJSbW86vHcVq7r1dTQwn_AzsQ0V1gP4iUDyu1_JgXjzT5sVJVtd8Leu1XniucnSa1rPBnYUvtdIJ4iC"
          />
        </div>

        {/* Tech Branding */}
        <div className="absolute bottom-12 left-12 flex items-center gap-4">
          <div className="h-px w-12 bg-primary"></div>
          <span className="text-xs tracking-[0.3em] text-primary/80 font-medium uppercase">
            Neural Link Established
          </span>
        </div>
      </div>

      {/* Right Side: Interaction Panel */}
      <div className="w-full lg:w-1/2 h-full bg-white dark:bg-background-dark flex flex-col overflow-y-auto px-6 py-6 lg:px-24 lg:py-12 relative transition-all duration-300">
        {/* Mobile Background Watermark */}
        <div className="lg:hidden absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-10">
          <div className="w-[150vw] h-[150vw] rounded-full border-[60px] border-primary/5 translate-y-1/4"></div>
        </div>

        {/* Navigation/Status */}
        <div className="flex justify-between items-center mb-8 lg:mb-12 relative z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
            >
              <span className="material-icons text-brand-black dark:text-white group-hover:text-primary transition-colors">
                chevron_left
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
                Step 02 — Configuration
              </span>
            </div>
          </div>
          <button className="text-xs font-bold tracking-tighter uppercase border-b border-black dark:border-white pb-0.5 hover:text-primary hover:border-primary transition-colors">
            Skip Intro
          </button>
        </div>

        {/* Content Header */}
        <div className="mb-8 lg:mb-12 relative z-10">
          <h1 className="text-3xl lg:text-5xl font-bold tracking-tighter leading-[1.1] lg:leading-[0.9] text-slate-900 dark:text-white mb-4 uppercase">
            What is your
            <br />
            <span className="text-primary italic">SoulPrint's</span>
            <br />
            Purpose?
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm lg:text-base max-w-sm font-medium">
            Select the foundational neural architecture for your digital resonance. This will define
            how your AI interacts with reality.
          </p>
        </div>

        {/* Selection Cards */}
        <div className="space-y-4 max-w-md relative z-10 flex-grow">
          <RadioCard
            name="goal"
            value="productivity"
            selectedValue={goal}
            onChange={setGoal}
            icon="calendar_today"
            title="Productivity"
          />
          <RadioCard
            name="goal"
            value="companionship"
            selectedValue={goal}
            onChange={setGoal}
            icon="favorite_border"
            title="Companionship"
          />
          <RadioCard
            name="goal"
            value="analysis"
            selectedValue={goal}
            onChange={setGoal}
            icon="insights"
            title="Data Analysis"
          />
          <RadioCard
            name="goal"
            value="growth"
            selectedValue={goal}
            onChange={setGoal}
            icon="spa"
            title="Personal Growth"
          />
          <RadioCard
            name="goal"
            value="creativity"
            selectedValue={goal}
            onChange={setGoal}
            icon="palette"
            title="Creative Flow"
          />
        </div>

        {/* Footer Action */}
        <div className="mt-8 lg:mt-12 flex flex-col lg:flex-row items-center justify-between max-w-md relative z-10 gap-4">
          <div className="flex gap-1 hidden lg:flex">
            <div className="w-8 h-1 bg-primary"></div>
            <div className="w-8 h-1 bg-primary"></div>
            <div className="w-8 h-1 bg-slate-200 dark:bg-slate-700"></div>
          </div>
          <button
            onClick={() => onContinue(goal)}
            className="w-full lg:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all transform active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group"
          >
            Continue Process
            <span className="material-icons group-hover:translate-x-1 transition-transform lg:hidden">
              arrow_forward
            </span>
          </button>
          <p className="lg:hidden text-center text-xs text-gray-400 font-medium">
            Powered by SoulPrint AI Engine v2.4
          </p>
        </div>

        {/* Global Footer Info (Desktop) */}
        <div className="hidden lg:block absolute bottom-12 left-24 text-[10px] text-slate-400 uppercase tracking-widest">
          System: <span className="text-slate-900 dark:text-white font-bold">SOULPRINT V4.2</span> —
          All rights reserved
        </div>
      </div>
    </div>
  );
}
