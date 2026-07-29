import { FileText, X } from "lucide-react";
import { formatFileSize, getFileExtension, isPreviewableImage } from "../../lib/fileValidation";
import type { SelectedDocumentFile } from "../../types/document";

interface DocumentPreviewProps {
  selected: SelectedDocumentFile;
  disabled?: boolean;
  onRemove?: () => void;
}

export const DocumentPreview = ({ selected, disabled = false, onRemove }: DocumentPreviewProps) => {
  const { file, previewUrl } = selected;
  const extension = getFileExtension(file.name).replace(".", "").toUpperCase();

  return (
    <div className="relative rounded-md border border-mercantil-border bg-white p-4 pr-14">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DDE6F0] bg-white text-slate-500 shadow-sm hover:border-mercantil-blue hover:text-mercantil-blue disabled:opacity-60"
          aria-label="Eliminar documento seleccionado"
          title="Eliminar documento"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-md border border-mercantil-border bg-mercantil-background sm:w-48">
          {previewUrl && isPreviewableImage(file) ? (
            <img src={previewUrl} alt="Vista previa del documento seleccionado" className="h-full w-full object-contain" />
          ) : (
            <div className="text-center text-mercantil-muted">
              <FileText className="mx-auto h-12 w-12 text-mercantil-blue" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">Vista PDF</p>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-mercantil-navy">{file.name}</p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-mercantil-muted sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-mercantil-text">Tipo</dt>
              <dd>{extension || file.type}</dd>
            </div>
            <div>
              <dt className="font-semibold text-mercantil-text">Tamaño</dt>
              <dd>{formatFileSize(file.size)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};
