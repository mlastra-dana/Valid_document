import { env } from "../config/env";

const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"] as const;
const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];

export interface FileValidationResult {
  valid: boolean;
  message?: string;
}

export const maxFileSizeBytes = env.maxFileSizeMb * 1024 * 1024;

export const isPreviewableImage = (file: File): boolean =>
  file.type === "image/jpeg" || file.type === "image/png";

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
};

export const validateDocumentFile = (file: File): FileValidationResult => {
  const extension = getFileExtension(file.name);

  if (!allowedMimeTypes.includes(file.type as (typeof allowedMimeTypes)[number])) {
    return {
      valid: false,
      message: "El formato seleccionado no está permitido. Utiliza PDF, JPG, JPEG o PNG."
    };
  }

  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      message: "La extensión del archivo no está permitida. Utiliza PDF, JPG, JPEG o PNG."
    };
  }

  if (file.size > maxFileSizeBytes) {
    return {
      valid: false,
      message: `El archivo supera el tamaño máximo permitido de ${env.maxFileSizeMb} MB.`
    };
  }

  return { valid: true };
};
