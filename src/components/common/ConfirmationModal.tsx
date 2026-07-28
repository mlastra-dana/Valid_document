import { X } from "lucide-react";

interface ConfirmationModalProps {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmationModal = ({ open, busy = false, onCancel, onConfirm }: ConfirmationModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" role="presentation">
      <section
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-portal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="confirm-title" className="text-xl font-bold text-mercantil-navy">
            Confirmar envío
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full p-1 text-mercantil-muted hover:bg-mercantil-sky"
            aria-label="Cerrar confirmación"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 leading-7 text-mercantil-text">
          Verifica que el documento seleccionado sea la cédula de identidad del tomador y que todos
          sus datos sean legibles.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-mercantil-border px-5 py-3 font-semibold text-mercantil-navy disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-mercantil-blue px-5 py-3 font-semibold text-white hover:bg-mercantil-navy disabled:opacity-60"
          >
            Validar documento
          </button>
        </div>
      </section>
    </div>
  );
};
