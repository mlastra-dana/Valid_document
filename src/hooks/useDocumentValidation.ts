import { useCallback, useEffect, useRef, useState } from "react";
import { registerIdentityDocument, validateIdentityDocument } from "../api/documentoApi";
import { registerExpedienteFailure } from "../api/expedienteApi";
import { fileToBase64 } from "../lib/base64";
import { ApiError } from "../types/api";
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

const attemptsStorageKey = (expediente: Expediente) =>
  `validoc-attempts:${expediente.dataId || expediente.tomadorId}`;

const initialAttempts = (expediente: Expediente): AttemptStatus => {
  const fallback = {
    used: expediente.intentosRealizados,
    remaining: Math.max(expediente.maximoIntentos - expediente.intentosRealizados, 0),
    maximum: expediente.maximoIntentos
  };

  try {
    const stored = window.sessionStorage.getItem(attemptsStorageKey(expediente));
    if (!stored) return fallback;

    const parsed = JSON.parse(stored) as Partial<AttemptStatus>;
    const maximum = Number(parsed.maximum || expediente.maximoIntentos);
    const used = Math.min(Number(parsed.used || 0), maximum);
    return {
      used,
      remaining: Math.max(maximum - used, 0),
      maximum
    };
  } catch {
    return fallback;
  }
};

const storeAttempts = (expediente: Expediente, attempts: AttemptStatus) => {
  try {
    window.sessionStorage.setItem(attemptsStorageKey(expediente), JSON.stringify(attempts));
  } catch {
    // Attempt persistence is best-effort; validation still works without it.
  }
};

const clearStoredAttempts = (expediente: Expediente) => {
  try {
    window.sessionStorage.removeItem(attemptsStorageKey(expediente));
  } catch {
    // Nothing to clear if sessionStorage is unavailable.
  }
};

export const useDocumentValidation = (expediente: Expediente, token: string) => {
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<ValidationFlowStatus>("idle");
  const [attempts, setAttempts] = useState<AttemptStatus>(() => initialAttempts(expediente));
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [registrationResult, setRegistrationResult] = useState<DocumentRegistrationResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  const processing = status === "encoding" || status === "validating" || status === "registering";

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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

  const cancelCurrentAttempt = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setValidationResult(null);
    setError(null);
    if (status === "validation-error" || status === "service-error") {
      setStatus("idle");
      return;
    }
    if (processing) {
      setStatus("idle");
    }
  }, [processing, status]);

  const submitDocument = useCallback(
    async (selected: SelectedDocumentFile) => {
      if (processing || attempts.remaining <= 0) return;

      setError(null);
      setValidationResult(null);
      setStatus("encoding");
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;
      const isCurrentRun = () => runIdRef.current === runId && !abortController.signal.aborted;

      try {
        const contentBase64 = await fileToBase64(selected.file);
        if (!isCurrentRun()) return;

        const document = {
          fileName: selected.file.name,
          contentType: selected.file.type,
          contentBase64
        };

        setStatus("validating");
        const response = await validateIdentityDocument(token, {
          tomadorId: expediente.tomadorId,
          dataId: expediente.dataId,
          recordUid: expediente.recordUid,
          attemptsUsed: attempts.used,
          maxAttempts: attempts.maximum,
          document
        }, abortController.signal);
        if (!isCurrentRun()) return;

        setAttempts(response.attempts);
        storeAttempts(expediente, response.attempts);
        setValidationResult(response.validation);

        if (!response.validation.isValid) {
          await registerExpedienteFailure(expediente.tomadorId, token, {
            status: "VALIDATION_FAILED",
            reasonCode: response.validation.reasonCode,
            attemptsUsed: response.attempts.used,
            tomadorId: expediente.tomadorId,
            dataId: expediente.dataId,
            recordUid: expediente.recordUid,
            detectedDocumentNumber: response.validation.detectedDocumentNumber,
            fileName: selected.file.name
          });
          if (!isCurrentRun()) return;

          if (response.attempts.remaining <= 0 || response.validation.reasonCode === "MAX_ATTEMPTS_REACHED") {
            setStatus("max-attempts");
            return;
          }

          setStatus("validation-error");
          return;
        }

        setStatus("registering");
        const registration = await registerIdentityDocument(token, {
          tomadorId: expediente.tomadorId,
          dataId: expediente.dataId,
          recordUid: expediente.recordUid,
          attemptsUsed: response.attempts.used,
          detectedDocumentNumber: response.validation.detectedDocumentNumber ?? "",
          document
        }, abortController.signal);
        if (!isCurrentRun()) return;

        setRegistrationResult(registration);
        clearStoredAttempts(expediente);
        setStatus("completed");
      } catch (caughtError) {
        if (!isCurrentRun()) return;

        if (caughtError instanceof ApiError && caughtError.code === "MAX_ATTEMPTS_REACHED") {
          setStatus("max-attempts");
          setAttempts((current) => {
            const next = { ...current, remaining: 0, used: current.maximum };
            storeAttempts(expediente, next);
            return next;
          });
          return;
        }

        setError(caughtError);
        setStatus("service-error");
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
      }
    },
    [
      attempts.maximum,
      attempts.remaining,
      attempts.used,
      expediente,
      processing,
      token
    ]
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
    resetRecoverableError: cancelCurrentAttempt,
    cancelCurrentAttempt
  };
};
