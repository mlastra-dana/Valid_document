import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  title: string;
  message?: string;
}

export const LoadingScreen = ({ title, message }: LoadingScreenProps) => (
  <section className="rounded-lg border border-mercantil-border bg-white p-6 text-center shadow-portal sm:p-8" aria-busy="true">
    <Loader2 className="mx-auto h-10 w-10 animate-spin text-mercantil-blue" aria-hidden="true" />
    <h1 className="mt-4 text-xl font-bold text-mercantil-navy">{title}</h1>
    {message ? <p className="mt-2 text-mercantil-muted">{message}</p> : null}
  </section>
);
