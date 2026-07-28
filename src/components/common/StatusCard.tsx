import type { ReactNode } from "react";

interface StatusCardProps {
  title: string;
  message: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "success" | "error";
}

export const StatusCard = ({ title, message, children, actions, tone = "default" }: StatusCardProps) => {
  const titleColor =
    tone === "success" ? "text-mercantil-success" : tone === "error" ? "text-mercantil-error" : "text-mercantil-navy";

  return (
    <section className="rounded-lg border border-mercantil-border bg-white p-6 shadow-portal sm:p-8">
      <h1 className={`text-2xl font-bold ${titleColor}`}>{title}</h1>
      <p className="mt-3 leading-7 text-mercantil-text">{message}</p>
      {children ? <div className="mt-6">{children}</div> : null}
      {actions ? <div className="mt-6 flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
    </section>
  );
};
