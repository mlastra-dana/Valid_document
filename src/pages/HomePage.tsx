import { Link } from "react-router-dom";
import { ProcessStepper } from "../components/common/ProcessStepper";
import { SecurityNotice } from "../components/common/SecurityNotice";
import { StatusCard } from "../components/common/StatusCard";
import { PageContainer } from "../components/layout/PageContainer";

export const HomePage = () => (
  <PageContainer>
    <ProcessStepper activeStep={1} />
    <StatusCard
      title="Portal de Consignación de Documento de Identidad"
      message="Accede desde el enlace único enviado por DANAconnect para completar la carga de tu cédula de identidad."
      actions={
        <Link
          to="/completar-expediente?tomadorId=ABC123&token=TOKEN_DE_PRUEBA"
          className="rounded-md bg-mercantil-blue px-5 py-3 text-center font-semibold text-white hover:bg-mercantil-navy"
        >
          Abrir expediente de prueba
        </Link>
      }
    />
    <div className="mt-6">
      <SecurityNotice />
    </div>
  </PageContainer>
);
