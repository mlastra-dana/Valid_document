import type { AttemptStatus } from "../../types/document";
import { AlertMessage } from "../common/AlertMessage";

interface AttemptCounterProps {
  attempts: AttemptStatus;
}

export const AttemptCounter = ({ attempts }: AttemptCounterProps) => (
  <div className="space-y-3">
    <p className="text-sm font-semibold text-mercantil-navy" aria-live="polite">
      Intentos disponibles: {attempts.remaining} de {attempts.maximum}
    </p>
    {attempts.remaining === 1 ? (
      <AlertMessage tone="warning">
        Este es tu último intento. Verifica cuidadosamente el documento antes de enviarlo.
      </AlertMessage>
    ) : null}
  </div>
);
