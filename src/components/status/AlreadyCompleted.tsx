import { formatDateTime } from "../../lib/dateFormat";
import type { Expediente } from "../../types/expediente";
import { MaskedDocumentNumber } from "../common/MaskedDocumentNumber";
import { StatusCard } from "../common/StatusCard";

interface AlreadyCompletedProps {
  expediente: Expediente;
}

export const AlreadyCompleted = ({ expediente }: AlreadyCompletedProps) => (
  <StatusCard
    title="Tu expediente ya fue completado"
    message="El documento de identidad asociado a este enlace ya fue recibido y procesado correctamente. No es necesario realizar ninguna acción adicional."
    tone="success"
  >
    <dl className="grid gap-4 rounded-md bg-green-50 p-4 text-sm sm:grid-cols-2">
      {expediente.nombreTomador ? (
        <div>
          <dt className="font-semibold text-mercantil-text">Tomador</dt>
          <dd className="mt-1 text-mercantil-muted">{expediente.nombreTomador}</dd>
        </div>
      ) : null}
      {expediente.numeroDocumentoEsperado ? (
        <div>
          <dt className="font-semibold text-mercantil-text">Documento</dt>
          <dd className="mt-1 text-mercantil-muted">
            <MaskedDocumentNumber value={expediente.numeroDocumentoEsperado} />
          </dd>
        </div>
      ) : null}
      {formatDateTime(expediente.fechaCompletado) ? (
        <div>
          <dt className="font-semibold text-mercantil-text">Fecha de completado</dt>
          <dd className="mt-1 text-mercantil-muted">{formatDateTime(expediente.fechaCompletado)}</dd>
        </div>
      ) : null}
      <div>
        <dt className="font-semibold text-mercantil-text">Estado</dt>
        <dd className="mt-1 text-mercantil-success">Expediente completado</dd>
      </div>
    </dl>
  </StatusCard>
);
