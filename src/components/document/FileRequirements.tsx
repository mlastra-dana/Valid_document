import { FileText } from "lucide-react";
import { env } from "../../config/env";

export const FileRequirements = () => (
  <div className="rounded-xl border border-[#E7ECF3] bg-[#F8FAFC] p-5">
    <div className="flex gap-3">
      <FileText className="mt-0.5 h-5 w-5 flex-none text-mercantil-blue" aria-hidden="true" />
      <div>
        <h2 className="font-black text-mercantil-navy">Formatos permitidos</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          PDF, JPG, JPEG o PNG. Tamaño máximo: {env.maxFileSizeMb} MB. Solo se permite un archivo.
        </p>
      </div>
    </div>
  </div>
);
