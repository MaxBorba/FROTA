import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FormFieldFeedbackProps {
  error?: string;
  warning?: string;
  success?: string;
  hint?: string;
}

export const FormFieldFeedback: React.FC<FormFieldFeedbackProps> = ({
  error,
  warning,
  success,
  hint,
}) => {
  if (error) {
    return (
      <div className="flex items-start gap-1.5 mt-1.5 p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 animate-fade-in shadow-2xs">
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <span className="leading-tight">{error}</span>
      </div>
    );
  }

  if (warning) {
    return (
      <div className="flex items-start gap-1.5 mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 animate-fade-in shadow-2xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <span className="leading-tight">{warning}</span>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>{success}</span>
      </div>
    );
  }

  if (hint) {
    return (
      <p className="text-[11px] text-slate-500 mt-1 leading-tight">
        {hint}
      </p>
    );
  }

  return null;
};
