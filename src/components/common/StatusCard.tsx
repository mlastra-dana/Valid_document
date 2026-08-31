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
    <section className="mx-auto max-w-3xl rounded-xl border border-mercantil-border bg-white p-6 shadow-portal sm:p-8">
      <h1 className={`text-3xl font-bold leading-tight sm:text-4xl ${titleColor}`}>{title}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-mercantil-muted">{message}</p>
      {children ? <div className="mt-6">{children}</div> : null}
      {actions ? <div className="mt-6 flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
    </section>
  );
};
