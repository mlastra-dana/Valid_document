import { ApiError } from "../types/api";
import type { ExpedienteResponse } from "../types/expediente";
import type {
  DocumentRegistrationPayload,
  DocumentRegistrationResult,
  DocumentValidationPayload,
  DocumentValidationResponse,
  FinalFailurePayload
} from "../types/document";
import {
  getMockScenario,
  mockExpediente,
  mockRegistrationResult,
  mockValidationResponse
} from "./mockData";

const sleep = (ms = 900): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

const guardScenario = async (): Promise<ReturnType<typeof getMockScenario>> => {
  const scenario = getMockScenario();
  await sleep();

  if (scenario === "expired") {
    throw new ApiError("EXPIRED_LINK", "Enlace expirado.", 401);
  }

  if (scenario === "server-error") {
    throw new ApiError("SERVER_ERROR", "Servicio temporalmente no disponible.", 503);
  }

  return scenario;
};

export const mockApi = {
  async getExpediente(tomadorId: string): Promise<ExpedienteResponse> {
    const scenario = await guardScenario();
    return {
      success: true,
      data: mockExpediente(tomadorId, scenario)
    };
  },

  async validateDocument(
    payload: DocumentValidationPayload
  ): Promise<DocumentValidationResponse> {
    void payload;
    const scenario = await guardScenario();
    return mockValidationResponse(scenario);
  },

  async registerDocument(
    payload: DocumentRegistrationPayload
  ): Promise<DocumentRegistrationResult> {
    void payload;
    await sleep(1200);
    return mockRegistrationResult();
  },

  async registerFailure(tomadorId: string, payload: FinalFailurePayload): Promise<void> {
    void tomadorId;
    void payload;
    await sleep(500);
  }
};
