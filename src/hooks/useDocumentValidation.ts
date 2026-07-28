import { useCallback, useEffect, useState } from "react";
import { registerIdentityDocument, validateIdentityDocument } from "../api/documentoApi";
import { registerExpedienteFailure } from "../api/expedienteApi";
import { fileToBase64 } from "../lib/base64";
import type { Expediente } from "../types/expediente";
import type {
  AttemptStatus,
  DocumentRegistrationResult,
  SelectedDocumentFile,
  ValidationResult
} from "../types/document";

export type ValidationFlowStatus =
  | "idle"
  | "encoding"
  | "validating"
  | "validation-error"
  | "max-attempts"
  | "registering"
  | "completed"
  | "service-error";

const processingMessages = [
  "Preparando el documento...",
  "Verificando legibilidad...",
  "Validando la información...",
  "Comparando los datos del tomador..."
];

export const useDocumentValidation = (expediente: Expediente, token: string) => {
  const [status, setStatus] = useState<ValidationFlowStatus>("idle");
  const [attempts, setAttempts] = useState<AttemptStatus>({
    used: expediente.intentosRealizados,
    remaining: Math.max(expediente.maximoIntentos - expediente.intentosRealizados, 0),
    maximum: expediente.maximoIntentos
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [registrationResult, setRegistrationResult] = useState<DocumentRegistrationResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  const processing = status === "encoding" || status === "validating" || status === "registering";

  useEffect(() => {
    if (!processing) {
      setMessageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setMessageIndex((current) => Math.min(current + 1, processingMessages.length - 1));
    }, 1100);

    return () => window.clearInterval(interval);
  }, [processing]);

  useEffect(() => {
    if (!processing) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [processing]);

  const resetRecoverableError = useCallback(() => {
    if (status === "validation-error" || status === "service-error") {
      setStatus("idle");
      setValidationResult(null);
      setError(null);
    }
  }, [status]);

  const submitDocument = useCallback(
    async (selected: SelectedDocumentFile) => {
      if (processing || attempts.remaining <= 0) return;

      setError(null);
      setValidationResult(null);
      setStatus("encoding");

      try {
        const contentBase64 = await fileToBase64(selected.file);
        const document = {
          fileName: selected.file.name,
          contentType: selected.file.type,
          contentBase64
        };

        setStatus("validating");
        const response = await validateIdentityDocument(token, {
          tomadorId: expediente.tomadorId,
          document
        });

        setAttempts(response.attempts);
        setValidationResult(response.validation);

        if (!response.validation.isValid) {
          if (response.attempts.remaining <= 0 || response.validation.reasonCode === "MAX_ATTEMPTS_REACHED") {
            setStatus("max-attempts");
            await registerExpedienteFailure(expediente.tomadorId, token, {
              status: "VALIDATION_FAILED",
              reasonCode: "MAX_ATTEMPTS_REACHED",
              attemptsUsed: response.attempts.used
            });
            return;
          }

          setStatus("validation-error");
          return;
        }

        setStatus("registering");
        const registration = await registerIdentityDocument(token, {
          tomadorId: expediente.tomadorId,
          detectedDocumentNumber: response.validation.detectedDocumentNumber ?? "",
          document
        });

        setRegistrationResult(registration);
        setStatus("completed");
      } catch (caughtError) {
        setError(caughtError);
        setStatus("service-error");
      }
    },
    [attempts.remaining, expediente.tomadorId, processing, token]
  );

  return {
    status,
    attempts,
    validationResult,
    registrationResult,
    error,
    processingMessage: processingMessages[messageIndex],
    processing,
    submitDocument,
    resetRecoverableError
  };
};
