interface AppEnv {
  apiBaseUrl: string;
  useMockApi: boolean;
  appName: string;
  maxFileSizeMb: number;
  requestTimeoutMs: number;
}

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === "") return fallback;
  return value.toLowerCase() === "true";
};

const readPositiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const requiredUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const env: AppEnv = {
  apiBaseUrl: requiredUrl || "https://api.example.com",
  useMockApi: readBoolean(import.meta.env.VITE_USE_MOCK_API, true),
  appName:
    import.meta.env.VITE_APP_NAME?.trim() ||
    "Portal de Consignación de Documento de Identidad",
  maxFileSizeMb: readPositiveNumber(import.meta.env.VITE_MAX_FILE_SIZE_MB, 10),
  requestTimeoutMs: readPositiveNumber(import.meta.env.VITE_REQUEST_TIMEOUT_MS, 30000)
};
