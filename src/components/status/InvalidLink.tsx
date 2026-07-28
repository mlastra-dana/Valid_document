import { StatusCard } from "../common/StatusCard";

export const InvalidLink = () => (
  <StatusCard
    title="Enlace inválido"
    message="El enlace recibido no contiene la información necesaria para continuar. Verifica que hayas abierto el botón enviado en la comunicación original."
    tone="error"
  />
);
