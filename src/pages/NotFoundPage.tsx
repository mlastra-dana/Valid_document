import { Link } from "react-router-dom";
import { StatusCard } from "../components/common/StatusCard";
import { PageContainer } from "../components/layout/PageContainer";

export const NotFoundPage = () => (
  <PageContainer>
    <StatusCard
      title="Página no encontrada"
      message="La ruta solicitada no existe o ya no está disponible."
      actions={
        <Link
          to="/"
          className="rounded-md bg-mercantil-blue px-5 py-3 text-center font-semibold text-white hover:bg-mercantil-navy"
        >
          Ir al inicio
        </Link>
      }
    />
  </PageContainer>
);
