export interface Expediente {
  tomadorId: string;
  nombreTomador?: string;
  tipoPersona?: "natural" | "juridica";
  numeroDocumentoEsperado?: string;
  expedienteCompletado: boolean;
  fechaCompletado?: string | null;
  intentosRealizados: number;
  maximoIntentos: number;
}

export interface ExpedienteResponse {
  success: boolean;
  data: Expediente;
}
