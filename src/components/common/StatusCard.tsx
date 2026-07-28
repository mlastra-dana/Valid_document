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
    <section className="mx-auto max-w-3xl rounded-xl border border-[#DDE6F0] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.07)] sm:p-8">
      <h1 className={`text-3xl font-black leading-tight sm:text-4xl ${titleColor}`}>{title}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{message}</p>
      {children ? <div className="mt-6">{children}</div> : null}
      {actions ? <div className="mt-6 flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
    </section>
  );
};
