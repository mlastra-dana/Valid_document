import { StatusCard } from "../common/StatusCard";

export const ExpiredLink = () => (
  <StatusCard
    title="Sesión o enlace expirado"
    message="El enlace ha expirado. Solicita una nueva comunicación para continuar con el expediente."
    tone="error"
  />
);
