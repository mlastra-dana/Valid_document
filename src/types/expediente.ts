export interface Expediente {
  tomadorId: string;
  dataId?: string;
  recordUid?: string;
  nombreTomador?: string;
  tipoPersona?: "natural" | "juridica";
  numeroDocumentoEsperado?: string;
  expedienteCompletado: boolean;
  tomadorIdCompletado?: boolean;
  fechaCompletado?: string | null;
  intentosRealizados: number;
  maximoIntentos: number;
}

export interface ExpedienteResponse {
  success: boolean;
  data: Expediente;
}
