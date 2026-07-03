"use client";

import { cn } from "@/utils/cn";

const STEPS = [
  { id: 1, label: "Hedef" },
  { id: 2, label: "Bütçe" },
  { id: 3, label: "Hedef Kitle" },
  { id: 4, label: "Meta Hesapları" },
  { id: 5, label: "İçerik" },
  { id: 6, label: "Özet" },
] as const;

export function questionToProgressStep(questionId?: string): number {
  if (!questionId) return 1;
  if (
    questionId === "business_goal" ||
    questionId === "lead_collection_method" ||
    questionId === "conversion_destination" ||
    questionId === "desired_result" ||
    questionId === "video_priority"
  ) {
    return 1;
  }
  if (questionId === "budget") return 2;
  if (questionId === "audience") return 3;
  if (questionId === "assets") return 4;
  if (questionId === "creative") return 5;
  if (questionId === "special_category" || questionId === "review") return 6;
  return 1;
}

type WizardProgressProps = {
  activeStep: number;
};

export function WizardProgress({ activeStep }: WizardProgressProps) {
  return (
    <nav aria-label="Wizard ilerlemesi" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 sm:gap-2">
        {STEPS.map((step, index) => {
          const done = step.id < activeStep;
          const active = step.id === activeStep;
          return (
            <li key={step.id} className="flex items-center gap-1 sm:gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs sm:px-2.5 sm:text-sm",
                  active && "bg-primary/10 font-medium text-primary",
                  done && !active && "text-muted-foreground",
                  !active && !done && "text-muted-foreground/70",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:h-6 sm:w-6 sm:text-xs",
                    active && "bg-primary text-primary-foreground",
                    done && !active && "bg-primary/20 text-primary",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {step.id}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="hidden h-px w-3 bg-border sm:block sm:w-5" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
