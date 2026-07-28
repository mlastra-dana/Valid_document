import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

interface AlertMessageProps {
  tone?: "info" | "warning" | "error" | "success";
  children: ReactNode;
}

export const AlertMessage = ({ tone = "info", children }: AlertMessageProps) => {
  const styles = {
    info: "border-mercantil-blue/25 bg-mercantil-sky text-mercantil-navy",
    warning: "border-mercantil-orange/35 bg-orange-50 text-amber-900",
    error: "border-mercantil-error/30 bg-red-50 text-mercantil-error",
    success: "border-mercantil-success/30 bg-green-50 text-mercantil-success"
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;

  return (
    <div
      className={`flex gap-3 rounded-md border p-4 text-sm ${styles[tone]}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
};
