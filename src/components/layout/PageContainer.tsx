import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
}

export const PageContainer = ({ children }: PageContainerProps) => (
  <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 lg:py-16">
    {children}
  </main>
);
