"use client";

import { cn } from "@/utils/cn";

const STEPS = [
  { id: 1, label: "Reklam Bilgileri" },
  { id: 2, label: "Hedef Kitle" },
  { id: 3, label: "Varlıklar" },
  { id: 4, label: "Özet" },
];

type WizardStepperProps = {
  currentStep: number;
  totalSteps: number;
};

export function WizardStepper({ currentStep, totalSteps }: WizardStepperProps) {
  const progress = Math.min(4, Math.ceil((currentStep / Math.max(totalSteps, 1)) * 4));

  return (
    <div className="panel-card px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {STEPS.map((step, index) => {
          const stepNum = index + 1;
          const active = stepNum === progress;
          const done = stepNum < progress;
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-primary/20 text-primary",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {step.id}
              </div>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 && (
                <div className="mx-2 hidden h-px w-8 bg-border sm:block lg:w-16" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
