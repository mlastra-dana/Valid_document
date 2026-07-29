import { env } from "../config/env";
import { mockApi } from "../mocks/handlers";
import type {
  DocumentRegistrationPayload,
  DocumentRegistrationResult,
  DocumentValidationPayload,
  DocumentValidationResponse
} from "../types/document";
import { apiRequest } from "./apiClient";

export const validateIdentityDocument = async (
  token: string,
  payload: DocumentValidationPayload,
  signal?: AbortSignal
): Promise<DocumentValidationResponse> => {
  if (env.useMockApi) return mockApi.validateDocument(payload);

  return apiRequest<DocumentValidationResponse>("/documentos-identidad/validar", {
    method: "POST",
    token,
    signal,
    body: JSON.stringify(payload)
  });
};

export const registerIdentityDocument = async (
  token: string,
  payload: DocumentRegistrationPayload,
  signal?: AbortSignal
): Promise<DocumentRegistrationResult> => {
  if (env.useMockApi) return mockApi.registerDocument(payload);

  return apiRequest<DocumentRegistrationResult>("/documentos-identidad/registrar", {
    method: "POST",
    token,
    signal,
    body: JSON.stringify(payload)
  });
};
