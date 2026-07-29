import { env } from "../config/env";
import { mockApi } from "../mocks/handlers";
import type { FinalFailurePayload } from "../types/document";
import type { ExpedienteResponse } from "../types/expediente";
import { apiRequest } from "./apiClient";

export const getExpediente = async (
  tomadorId: string,
  token: string
): Promise<ExpedienteResponse> => {
  if (env.useMockApi) return mockApi.getExpediente(tomadorId);

  return apiRequest<ExpedienteResponse>(`/expedientes/${encodeURIComponent(tomadorId)}`, {
    method: "GET",
    token
  });
};

export const registerExpedienteFailure = async (
  tomadorId: string,
  token: string,
  payload: FinalFailurePayload
): Promise<void> => {
  if (env.useMockApi) return mockApi.registerFailure(tomadorId, payload);

  const dataId = payload.dataId || tomadorId;
  return apiRequest<void>(`/expedientes/${encodeURIComponent(dataId)}/resultado`, {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
};
