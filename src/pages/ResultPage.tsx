import { Link } from "react-router-dom";
import { ProcessStepper } from "../components/common/ProcessStepper";
import { StatusCard } from "../components/common/StatusCard";
import { PageContainer } from "../components/layout/PageContainer";

export const ResultPage = () => (
  <PageContainer>
    <ProcessStepper activeStep={3} />
    <StatusCard
      title="Resultado del proceso"
      message="Los resultados se muestran al finalizar la validación del enlace activo. No se comparten documentos ni tokens mediante rutas internas."
      actions={
        <Link
          to="/"
          className="rounded-md bg-mercantil-blue px-5 py-3 text-center font-semibold text-white hover:bg-mercantil-navy"
        >
          Volver al inicio
        </Link>
      }
    />
  </PageContainer>
);
