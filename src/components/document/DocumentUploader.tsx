import { Camera, RefreshCw, UploadCloud } from "lucide-react";
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selected, setSelected] = useState<SelectedDocumentFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraSupported, setCameraSupported] = useState(false);

  useEffect(() => {
    return () => {
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    };
  }, [selected]);

  useEffect(() => {
    setCameraSupported(Boolean(navigator.mediaDevices?.getUserMedia));
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async (facingMode = cameraFacingMode) => {
    if (disabled || processing || !cameraSupported) return;

    setCameraLoading(true);
    setError(null);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1600 },
          height: { ideal: 1200 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError("No pudimos abrir la cámara. Verifica los permisos del navegador o carga el archivo manualmente.");
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  const clearSelection = () => {
    if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onFileChange?.();
  };

  const processFile = (file: File) => {
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
    stopCamera();
    onSubmit(nextSelected);
  };

  const selectFile = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled || processing) return;

    if (fileList.length > 1) {
      setError("Selecciona un solo archivo para continuar.");
      return;
    }

    processFile(fileList[0]);
  };

  const switchCamera = async () => {
    const nextFacingMode = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(nextFacingMode);
    await startCamera(nextFacingMode);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || disabled || processing) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setError("La cámara todavía está cargando. Inténtalo nuevamente.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("No pudimos capturar la imagen. Carga el archivo manualmente.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("No pudimos capturar la imagen. Carga el archivo manualmente.");
          return;
        }
        const file = new File([blob], `cedula-${Date.now()}.jpg`, { type: "image/jpeg" });
        processFile(file);
      },
      "image/jpeg",
      0.92
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="space-y-5">
      {!selected && cameraActive ? (
        <div className="rounded-lg border border-[#DDE6F0] bg-white p-3">
          <div className="overflow-hidden rounded-md bg-slate-950">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-contain"
              playsInline
              muted
              autoPlay
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={disabled || processing || cameraLoading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-mercantil-blue px-5 py-3 font-bold text-white hover:bg-mercantil-navy disabled:opacity-60"
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              Tomar foto
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void switchCamera()}
                disabled={disabled || processing || cameraLoading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[#DDE6F0] px-4 py-3 font-bold text-mercantil-navy hover:border-mercantil-blue hover:text-mercantil-blue disabled:opacity-60 sm:flex-none"
              >
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
                Girar cámara
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex flex-1 items-center justify-center rounded-md border border-[#DDE6F0] px-4 py-3 font-bold text-slate-600 hover:border-mercantil-blue hover:text-mercantil-blue sm:flex-none"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!selected && !cameraActive ? (
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
          className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition ${
            dragActive
              ? "border-mercantil-blue bg-mercantil-sky"
              : "border-[#DDE6F0] bg-white"
          } ${disabled || processing ? "cursor-not-allowed opacity-60" : "hover:border-mercantil-blue hover:bg-[#F6FBFF]"}`}
          >
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#EEF7FD]">
            <UploadCloud className="h-7 w-7 text-mercantil-blue" aria-hidden="true" />
          </span>
          <p className="mt-4 text-lg font-black text-slate-950">
            Arrastra el archivo aquí
          </p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
            PDF, JPG o PNG.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-mercantil-blue px-5 py-3 font-bold text-white shadow-sm hover:bg-mercantil-navy"
              onClick={(event) => event.stopPropagation()}
            >
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
              Subir archivo
            </label>
            {cameraSupported ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void startCamera();
                }}
                disabled={disabled || processing || cameraLoading}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#DDE6F0] px-5 py-3 font-bold text-mercantil-navy hover:border-mercantil-blue hover:text-mercantil-blue disabled:opacity-60"
              >
                <Camera className="h-5 w-5" aria-hidden="true" />
                Tomar foto
              </button>
            ) : null}
          </div>
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
