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
    <nav aria-label="Progreso del proceso" className="mb-8">
      <ol className="grid grid-cols-3 gap-3 rounded-xl border border-[#E7ECF3] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
        {labels.map((label, index) => {
          const step = index + 1;
          const status = getStatus(step);
          const complete = status === "complete";
          const current = status === "active" || status === "processing";

          return (
            <li key={label} className="min-w-0">
              <div
                className={`flex min-h-14 flex-col items-center justify-center rounded-lg px-2 py-2 text-center text-xs font-bold sm:min-h-16 sm:text-sm ${
                  complete
                    ? "bg-green-50 text-mercantil-success"
                    : current
                      ? "bg-mercantil-blue text-white"
                      : "bg-white text-slate-500"
                }`}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                    complete
                      ? "border-mercantil-success bg-mercantil-success text-white"
                    : current
                        ? "border-white bg-white text-mercantil-blue"
                        : "border-[#DDE3EA] bg-[#F8FAFC]"
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
