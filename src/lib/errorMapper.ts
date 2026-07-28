import type { ValidationReasonCode } from "../types/document";
import { ApiError, type ApiErrorCode } from "../types/api";

export interface FriendlyError {
  title: string;
  message: string;
  recommendations?: string[];
}

export const mapApiError = (error: unknown): FriendlyError => {
  const code: ApiErrorCode = error instanceof ApiError ? error.code : "SERVER_ERROR";

  const messages: Record<ApiErrorCode, FriendlyError> = {
    NETWORK_ERROR: {
      title: "No pudimos conectarnos",
      message: "No pudimos conectarnos con el servicio. Revisa tu conexión e inténtalo nuevamente."
    },
    SERVER_ERROR: {
      title: "Servicio temporalmente no disponible",
      message: "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos minutos."
    },
    EXPIRED_LINK: {
      title: "Sesión o enlace expirado",
      message: "El enlace ha expirado. Solicita una nueva comunicación para continuar."
    },
    INVALID_LINK: {
      title: "Enlace inválido",
      message: "El enlace recibido no contiene la información necesaria para continuar."
    },
    EXPEDIENTE_NOT_FOUND: {
      title: "Expediente no encontrado",
      message: "No encontramos un expediente asociado a este enlace."
    },
    EXPEDIENTE_COMPLETED: {
      title: "Tu expediente ya fue completado",
      message: "El documento de identidad asociado a este enlace ya fue recibido correctamente."
    },
    FILE_TOO_LARGE: {
      title: "Archivo demasiado grande",
      message: "El archivo supera el tamaño máximo permitido de 10 MB."
    },
    UNSUPPORTED_FILE: {
      title: "Formato no permitido",
      message: "El formato seleccionado no está permitido. Utiliza PDF, JPG, JPEG o PNG."
    },
    VALIDATION_FAILED: {
      title: "No pudimos validar el documento",
      message: "Revisa el archivo seleccionado e inténtalo nuevamente."
    },
    MAX_ATTEMPTS_REACHED: {
      title: "Alcanzaste el máximo de intentos",
      message:
        "No fue posible validar el documento de identidad. Recibirás una nueva comunicación con información para continuar el proceso."
    }
  };

  return messages[code];
};

export const mapValidationReason = (
  reasonCode: ValidationReasonCode,
  detectedDocumentNumber?: string | null
): FriendlyError => {
  if (reasonCode === "UNREADABLE_DOCUMENT") {
    return {
      title: "No pudimos leer el documento",
      message:
        "La imagen está borrosa, cortada, tiene reflejos o no permite identificar correctamente los datos de la cédula.",
      recommendations: [
        "Coloca el documento sobre una superficie plana.",
        "Asegúrate de que todos los bordes sean visibles.",
        "Evita reflejos, sombras y poca iluminación.",
        "Verifica que los datos puedan leerse claramente.",
        "No utilices capturas de pantalla recortadas."
      ]
    };
  }

  if (reasonCode === "NOT_IDENTITY_DOCUMENT") {
    return {
      title: "El archivo no corresponde a una cédula de identidad",
      message:
        "Carga una imagen o PDF que contenga únicamente la cédula de identidad venezolana del tomador."
    };
  }

  if (reasonCode === "TOMADOR_MISMATCH") {
    return {
      title: "El documento no coincide con el tomador",
      message:
        detectedDocumentNumber && detectedDocumentNumber.length > 0
          ? "El número de cédula detectado no corresponde con la información asociada a este expediente."
          : "El documento cargado no corresponde con la información asociada a este expediente."
    };
  }

  if (reasonCode === "MAX_ATTEMPTS_REACHED") {
    return mapApiError(new ApiError("MAX_ATTEMPTS_REACHED", "Máximo de intentos alcanzado."));
  }

  return {
    title: "Error temporal del servicio",
    message: "No pudimos completar la validación en este momento. Inténtalo nuevamente más tarde."
  };
};
