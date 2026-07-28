import type { Expediente } from "../types/expediente";
import type {
  AttemptStatus,
  DocumentRegistrationResult,
  DocumentValidationResponse,
  ValidationReasonCode
} from "../types/document";

export type MockScenario =
  | "success"
  | "completed"
  | "unreadable"
  | "wrong-document"
  | "mismatch"
  | "max-attempts"
  | "expired"
  | "server-error";

export const getMockScenario = (): MockScenario => {
  const scenario = new URLSearchParams(window.location.search).get("scenario");
  const allowed: MockScenario[] = [
    "success",
    "completed",
    "unreadable",
    "wrong-document",
    "mismatch",
    "max-attempts",
    "expired",
    "server-error"
  ];

  return allowed.includes(scenario as MockScenario) ? (scenario as MockScenario) : "success";
};

export const mockExpediente = (tomadorId: string, scenario: MockScenario): Expediente => ({
  tomadorId,
  nombreTomador: "María González",
  tipoPersona: "natural",
  numeroDocumentoEsperado: "V12345678",
  expedienteCompletado: scenario === "completed",
  fechaCompletado: scenario === "completed" ? "2026-07-27T20:30:00Z" : null,
  intentosRealizados: scenario === "max-attempts" ? 3 : 0,
  maximoIntentos: 3
});

const attemptsByScenario = (scenario: MockScenario): AttemptStatus => {
  if (scenario === "max-attempts") return { used: 3, remaining: 0, maximum: 3 };
  if (scenario === "success") return { used: 1, remaining: 2, maximum: 3 };
  return { used: 1, remaining: 2, maximum: 3 };
};

const reasonByScenario = (scenario: MockScenario): ValidationReasonCode => {
  if (scenario === "unreadable") return "UNREADABLE_DOCUMENT";
  if (scenario === "wrong-document") return "NOT_IDENTITY_DOCUMENT";
  if (scenario === "mismatch") return "TOMADOR_MISMATCH";
  if (scenario === "max-attempts") return "MAX_ATTEMPTS_REACHED";
  return "VALID_DOCUMENT";
};

export const mockValidationResponse = (scenario: MockScenario): DocumentValidationResponse => {
  const reasonCode = reasonByScenario(scenario);
  const isValid = reasonCode === "VALID_DOCUMENT";

  return {
    success: true,
    validation: {
      isValid,
      isReadable: reasonCode !== "UNREADABLE_DOCUMENT",
      isIdentityDocument: reasonCode !== "NOT_IDENTITY_DOCUMENT",
      matchesTomador: reasonCode !== "TOMADOR_MISMATCH",
      detectedDocumentNumber: reasonCode === "TOMADOR_MISMATCH" ? "V87654321" : "V12345678",
      reasonCode,
      message: isValid ? "Documento validado correctamente" : "Documento no validado"
    },
    attempts: attemptsByScenario(scenario)
  };
};

export const mockRegistrationResult = (): DocumentRegistrationResult => ({
  success: true,
  documentId: "DOC-001234",
  indexed: true,
  expedienteStatus: "COMPLETED",
  completedAt: "2026-07-27T20:30:00Z"
});
