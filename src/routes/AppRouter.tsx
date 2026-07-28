import { Route, Routes } from "react-router-dom";
import { AppFooter } from "../components/layout/AppFooter";
import { AppHeader } from "../components/layout/AppHeader";
import { CompleteExpedientePage } from "../pages/CompleteExpedientePage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ResultPage } from "../pages/ResultPage";

export const AppRouter = () => (
  <div className="flex min-h-screen flex-col bg-mercantil-background">
    <AppHeader />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/completar-expediente" element={<CompleteExpedientePage />} />
      <Route path="/resultado" element={<ResultPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <AppFooter />
  </div>
);
