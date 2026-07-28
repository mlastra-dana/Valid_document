import { maskDocumentNumber } from "../../lib/documentMask";
import { mapValidationReason } from "../../lib/errorMapper";
import type { ValidationResult } from "../../types/document";
import { AlertMessage } from "../common/AlertMessage";

interface ValidationErrorProps {
  result: ValidationResult;
}

export const ValidationError = ({ result }: ValidationErrorProps) => {
  const friendly = mapValidationReason(result.reasonCode, result.detectedDocumentNumber);
  const maskedDetected =
    result.reasonCode === "TOMADOR_MISMATCH" ? maskDocumentNumber(result.detectedDocumentNumber) : "";

  return (
    <div className="space-y-4" aria-live="assertive">
      <AlertMessage tone="error">
        <p className="font-bold">{friendly.title}</p>
        <p className="mt-1">{friendly.message}</p>
        {maskedDetected ? (
          <p className="mt-2">
            Número detectado: <span className="font-semibold">{maskedDetected}</span>
          </p>
        ) : null}
      </AlertMessage>
      {friendly.recommendations ? (
        <div className="rounded-md border border-mercantil-border bg-white p-4">
          <h2 className="font-semibold text-mercantil-navy">Recomendaciones</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-mercantil-text">
            {friendly.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
