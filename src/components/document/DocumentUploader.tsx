import { UploadCloud } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { validateDocumentFile } from "../../lib/fileValidation";
import type { SelectedDocumentFile } from "../../types/document";
import { AlertMessage } from "../common/AlertMessage";
import { DocumentPreview } from "./DocumentPreview";

interface DocumentUploaderProps {
  disabled?: boolean;
  processing?: boolean;
  onSubmit: (selected: SelectedDocumentFile) => void;
  onFileChange?: () => void;
}

export const DocumentUploader = ({
  disabled = false,
  processing = false,
  onSubmit,
  onFileChange
}: DocumentUploaderProps) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selected, setSelected] = useState<SelectedDocumentFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    return () => {
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    };
  }, [selected]);

  const clearSelection = () => {
    if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onFileChange?.();
  };

  const selectFile = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled || processing) return;

    if (fileList.length > 1) {
      setError("Selecciona un solo archivo para continuar.");
      return;
    }

    const file = fileList[0];
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setError(validation.message ?? "El archivo no cumple con los requisitos.");
      return;
    }

    if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    const nextSelected = { file, previewUrl };
    setSelected(nextSelected);
    setError(null);
    onFileChange?.();
    onSubmit(nextSelected);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="space-y-5">
      {!selected ? (
        <div
          role="button"
          tabIndex={disabled || processing ? -1 : 0}
          onKeyDown={onKeyDown}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            selectFile(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          aria-label="Seleccionar o arrastrar documento de identidad"
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-7 text-center transition ${
            dragActive
              ? "border-mercantil-blue bg-mercantil-sky"
              : "border-[#DDE6F0] bg-white"
          } ${disabled || processing ? "cursor-not-allowed opacity-60" : "hover:border-mercantil-blue hover:bg-[#F6FBFF]"}`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#EEF7FD]">
            <UploadCloud className="h-9 w-9 text-mercantil-blue" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xl font-black text-slate-950">
            Arrastra el archivo aquí
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            PDF, JPG o PNG.
          </p>
          <label
            htmlFor={inputId}
            className="mt-6 inline-flex cursor-pointer rounded-md bg-mercantil-blue px-6 py-3 font-bold text-white shadow-sm hover:bg-mercantil-navy"
            onClick={(event) => event.stopPropagation()}
          >
            Seleccionar documento
          </label>
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        disabled={disabled || processing}
        onChange={(event) => selectFile(event.target.files)}
      />

      {error ? <AlertMessage tone="error">{error}</AlertMessage> : null}

      {selected ? (
        <div className="space-y-4">
          <DocumentPreview selected={selected} disabled={processing} onRemove={clearSelection} />
        </div>
      ) : null}
    </div>
  );
};
