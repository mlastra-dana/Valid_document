import { env } from "../config/env";
import { ApiError, type ApiErrorCode } from "../types/api";

interface RequestOptions extends RequestInit {
  token: string;
  timeoutMs?: number;
}

const statusToErrorCode = (status: number): ApiErrorCode => {
  if (status === 400) return "INVALID_LINK";
  if (status === 401) return "EXPIRED_LINK";
  if (status === 403) return "INVALID_LINK";
  if (status === 404) return "EXPEDIENTE_NOT_FOUND";
  if (status === 409) return "EXPEDIENTE_COMPLETED";
  if (status === 413) return "FILE_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 429) return "MAX_ATTEMPTS_REACHED";
  if ([500, 502, 503, 504].includes(status)) return "SERVER_ERROR";
  return "SERVER_ERROR";
};

export const apiRequest = async <T>(path: string, options: RequestOptions): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? env.requestTimeoutMs);

  try {
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
        Authorization: `Bearer ${options.token}`
      }
    });

    if (!response.ok) {
      throw new ApiError(statusToErrorCode(response.status), "La solicitud no pudo completarse.", response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("NETWORK_ERROR", "La solicitud excedió el tiempo máximo.");
    }
    throw new ApiError("NETWORK_ERROR", "No fue posible contactar el servicio.");
  } finally {
    window.clearTimeout(timeout);
  }
};
