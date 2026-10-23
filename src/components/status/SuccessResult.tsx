import { formatDateTime } from "../../lib/dateFormat";
import type { DocumentRegistrationResult } from "../../types/document";
import { StatusCard } from "../common/StatusCard";

interface SuccessResultProps {
  result: DocumentRegistrationResult;
}

export const SuccessResult = ({ result }: SuccessResultProps) => (
  <StatusCard
    title="¡Documento recibido exitosamente!"
    message="Tu documento de identidad fue validado y agregado correctamente al expediente."
    tone="success"
  >
    <dl className="grid gap-4 rounded-md bg-mercantil-surface p-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="font-semibold text-mercantil-text">Estado</dt>
        <dd className="mt-1 text-mercantil-success">Expediente completado</dd>
      </div>
      <div>
        <dt className="font-semibold text-mercantil-text">Fecha de completado</dt>
        <dd className="mt-1 text-mercantil-muted">{formatDateTime(result.completedAt)}</dd>
      </div>
    </dl>
  </StatusCard>
);
