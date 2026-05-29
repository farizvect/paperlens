"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Upload,
  MessageSquare,
  Quote,
  ChevronRight,
  ChevronLeft,
  FileText,
} from "lucide-react";

const STORAGE_KEY = "paperlens-onboarding-done";

const STEPS = [
  {
    icon: FileText,
    title: "Welcome to PaperLens",
    description:
      "Upload scientific PDFs — thesis, journals, reports — and chat with AI about their content. Your documents stay in your browser, nothing leaves your device.",
  },
  {
    icon: Upload,
    title: "Upload & Manage",
    description:
      "Drag & drop PDFs anywhere on the screen, or click the Upload button. Select multiple documents with the checkboxes in the sidebar to cross-reference them.",
  },
  {
    icon: MessageSquare,
    title: "Ask Anything",
    description:
      "Type questions about your documents in natural language. The AI searches relevant sections and cites its sources with [Source N] references you can click to verify.",
  },
  {
    icon: Quote,
    title: "Key Quotes & More",
    description:
      'Use the "Key Quotes" button to extract important citations. After each answer, follow-up suggestions help you dig deeper into the material.',
  },
];

export function Onboarding() {
  const [visible, setVisible] = React.useState(false);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    // Only show on first visit
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay so it doesn't flash on fast navigations
      const timer = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-backdrop-in"
      onClick={dismiss}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border border-[#e0ded6] bg-[#faf9f3] shadow-lg animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step content */}
        <div className="flex flex-col items-center px-6 pt-8 pb-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1B365D]/10 mb-4">
            <Icon className="h-7 w-7 text-[#1B365D]" />
          </div>
          <h2 className="text-lg font-medium text-[#2a2a28] mb-2">
            {current.title}
          </h2>
          <p className="text-sm leading-relaxed text-[#6a6a66] max-w-sm">
            {current.description}
          </p>
        </div>

        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === step
                  ? "w-6 bg-[#1B365D]"
                  : "w-1.5 bg-[#e0ded6] hover:bg-[#c0beb6]"
              )}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-[#e0ded6] px-4 py-3">
          <button
            onClick={dismiss}
            className="px-3 py-1.5 text-sm text-[#8a8a82] hover:text-[#2a2a28] transition-colors"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#e0ded6] px-3 py-1.5 text-sm text-[#6a6a66] hover:bg-[#f5f4ed] transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <button
              onClick={isLast ? dismiss : () => setStep(step + 1)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1B365D] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1B365D]/90 transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
