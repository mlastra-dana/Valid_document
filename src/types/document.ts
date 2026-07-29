export type ValidationReasonCode =
  | "VALID_DOCUMENT"
  | "UNREADABLE_DOCUMENT"
  | "NOT_IDENTITY_DOCUMENT"
  | "TOMADOR_MISMATCH"
  | "UNSUPPORTED_FILE"
  | "FILE_TOO_LARGE"
  | "MAX_ATTEMPTS_REACHED"
  | "VALIDATION_SERVICE_ERROR";

export interface ValidationResult {
  isValid: boolean;
  isReadable: boolean;
  isIdentityDocument: boolean;
  matchesTomador: boolean;
  detectedDocumentNumber?: string | null;
  reasonCode: ValidationReasonCode;
  message: string;
}

export interface AttemptStatus {
  used: number;
  remaining: number;
  maximum: number;
}

export interface EncodedDocument {
  fileName: string;
  contentType: string;
  contentBase64: string;
}

export interface DocumentValidationPayload {
  tomadorId: string;
  dataId?: string;
  recordUid?: string;
  attemptsUsed?: number;
  maxAttempts?: number;
  document: EncodedDocument;
}

export interface DocumentValidationResponse {
  success: boolean;
  validation: ValidationResult;
  attempts: AttemptStatus;
}

export interface DocumentRegistrationPayload {
  tomadorId: string;
  dataId?: string;
  recordUid?: string;
  detectedDocumentNumber: string;
  document: EncodedDocument;
}

export interface DocumentRegistrationResult {
  success: boolean;
  documentId: string;
  indexed: boolean;
  expedienteStatus: "COMPLETED";
  completedAt: string;
}

export interface FinalFailurePayload {
  status: "VALIDATION_FAILED";
  reasonCode: ValidationReasonCode;
  attemptsUsed: number;
  tomadorId?: string;
  dataId?: string;
  recordUid?: string;
  detectedDocumentNumber?: string | null;
  fileName?: string;
}

export interface SelectedDocumentFile {
  file: File;
  previewUrl?: string;
}
