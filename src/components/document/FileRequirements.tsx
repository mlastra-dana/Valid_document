import { FileText } from "lucide-react";
import { env } from "../../config/env";

export const FileRequirements = () => (
  <div className="rounded-xl border border-mercantil-border bg-mercantil-surface p-5">
    <div className="flex gap-3">
      <FileText className="mt-0.5 h-5 w-5 flex-none text-mercantil-blue" aria-hidden="true" />
      <div>
        <h2 className="font-semibold text-mercantil-navy">Formatos permitidos</h2>
        <p className="mt-1 text-sm leading-6 text-mercantil-muted">
          PDF, JPG, JPEG o PNG. Tamaño máximo: {env.maxFileSizeMb} MB. Solo se permite un archivo.
        </p>
      </div>
    </div>
  </div>
);
