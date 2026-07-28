import { Check } from "lucide-react";

type StepStatus = "active" | "complete" | "pending" | "processing";

interface ProcessStepperProps {
  activeStep: 1 | 2 | 3;
  completed?: boolean;
  processing?: boolean;
}

const labels = ["Identificación", "Carga del documento", "Confirmación"];

export const ProcessStepper = ({ activeStep, completed = false, processing = false }: ProcessStepperProps) => {
  const getStatus = (step: number): StepStatus => {
    if (completed || step < activeStep) return "complete";
    if (step === activeStep && processing) return "processing";
    if (step === activeStep) return "active";
    return "pending";
  };

  return (
    <nav aria-label="Progreso del proceso" className="mb-6">
      <ol className="grid grid-cols-3 gap-2">
        {labels.map((label, index) => {
          const step = index + 1;
          const status = getStatus(step);
          const complete = status === "complete";
          const current = status === "active" || status === "processing";

          return (
            <li key={label} className="min-w-0">
              <div
                className={`flex min-h-16 flex-col items-center justify-center rounded-md border px-2 py-2 text-center text-xs font-semibold sm:text-sm ${
                  complete
                    ? "border-mercantil-success bg-green-50 text-mercantil-success"
                    : current
                      ? "border-mercantil-blue bg-mercantil-sky text-mercantil-navy"
                      : "border-mercantil-border bg-white text-mercantil-muted"
                }`}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                    complete
                      ? "border-mercantil-success bg-mercantil-success text-white"
                      : current
                        ? "border-mercantil-blue bg-white text-mercantil-blue"
                        : "border-mercantil-border bg-white"
                  }`}
                >
                  {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : step}
                </span>
                <span className="truncate sm:whitespace-normal">{label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
