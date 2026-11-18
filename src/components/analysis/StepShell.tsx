import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface StepShellProps {
  step: number;
  total: number;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Mobile-first frame for each step: progress bar, back button, content, sticky footer. */
const StepShell: React.FC<StepShellProps> = ({ step, total, onBack, children, footer }) => (
  <div className="min-h-[calc(100vh-5rem)] flex flex-col max-w-md mx-auto w-full px-5">
    <div className="flex items-center gap-3 pt-4 pb-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Retour"
        className={`h-9 w-9 -ml-2 flex items-center justify-center rounded-full text-ink-700 hover:bg-sand-100 transition ${
          onBack ? '' : 'invisible'
        }`}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex-1 h-1 rounded-full bg-sand-200 overflow-hidden">
        <div
          className="h-full bg-ink-900 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-ink-400 w-8 text-right">
        {step}/{total}
      </span>
    </div>
    <div className="flex-1 flex flex-col animate-fade-in" key={step}>
      {children}
    </div>
    {footer && <div className="sticky bottom-0 py-5 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent">{footer}</div>}
  </div>
);

export default StepShell;

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    type="button"
    {...props}
    className={`w-full h-14 rounded-2xl bg-ink-900 text-white text-base font-medium tracking-wide flex items-center justify-center gap-2 transition hover:bg-ink-800 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none ${className}`}
  />
);

export const OptionCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}> = ({ selected, onClick, title, subtitle }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left rounded-2xl border px-5 py-4 transition ${
      selected ? 'border-ink-900 bg-white shadow-sm ring-1 ring-ink-900' : 'border-sand-200 bg-white/60 hover:border-ink-300'
    }`}
  >
    <div className="font-medium text-ink-900">{title}</div>
    {subtitle && <div className="text-sm text-ink-500 mt-0.5">{subtitle}</div>}
  </button>
);
