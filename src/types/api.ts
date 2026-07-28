export type ApiErrorCode =
  | "INVALID_LINK"
  | "EXPIRED_LINK"
  | "EXPEDIENTE_NOT_FOUND"
  | "EXPEDIENTE_COMPLETED"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE"
  | "VALIDATION_FAILED"
  | "MAX_ATTEMPTS_REACHED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}
