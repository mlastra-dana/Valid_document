import { Route, Routes } from "react-router-dom";
import { AppFooter } from "../components/layout/AppFooter";
import { AppHeader } from "../components/layout/AppHeader";
import { CompleteExpedientePage } from "../pages/CompleteExpedientePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ResultPage } from "../pages/ResultPage";

export const AppRouter = () => (
  <div className="flex min-h-screen flex-col bg-white">
    <AppHeader />
    <Routes>
      <Route path="/" element={<CompleteExpedientePage />} />
      <Route path="/completar-expediente" element={<CompleteExpedientePage />} />
      <Route path="/resultado" element={<ResultPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <AppFooter />
  </div>
);
