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
    <div className="relative rounded-md border border-mercantil-border bg-white p-3 pr-12">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DDE6F0] bg-white text-slate-500 shadow-sm hover:border-mercantil-blue hover:text-mercantil-blue disabled:opacity-60"
          aria-label="Eliminar documento seleccionado"
          title="Eliminar documento"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border border-mercantil-border bg-mercantil-background sm:w-36">
          {previewUrl && isPreviewableImage(file) ? (
            <img src={previewUrl} alt="Vista previa del documento seleccionado" className="h-full w-full object-contain" />
          ) : (
            <div className="text-center text-mercantil-muted">
              <FileText className="mx-auto h-9 w-9 text-mercantil-blue" aria-hidden="true" />
              <p className="mt-1 text-xs font-semibold">Vista PDF</p>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words pr-1 text-base font-semibold text-mercantil-navy">{file.name}</p>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm text-mercantil-muted">
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
