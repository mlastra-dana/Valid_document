import { useCallback, useEffect, useState } from "react";
import { getExpediente } from "../api/expedienteApi";
import type { Expediente } from "../types/expediente";

interface UseExpedienteState {
  expediente: Expediente | null;
  loading: boolean;
  error: unknown;
}

export const useExpediente = (tomadorId: string | null, token: string | null) => {
  const [state, setState] = useState<UseExpedienteState>({
    expediente: null,
    loading: Boolean(tomadorId && token),
    error: null
  });

  const loadExpediente = useCallback(async () => {
    if (!tomadorId || !token) return;
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await getExpediente(tomadorId, token);
      setState({ expediente: response.data, loading: false, error: null });
    } catch (error) {
      setState({ expediente: null, loading: false, error });
    }
  }, [tomadorId, token]);

  useEffect(() => {
    void loadExpediente();
  }, [loadExpediente]);

  return {
    ...state,
    retry: loadExpediente
  };
};
