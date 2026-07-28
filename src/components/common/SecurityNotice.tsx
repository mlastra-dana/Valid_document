import { ShieldCheck } from "lucide-react";

export const SecurityNotice = () => (
  <div className="flex gap-3 rounded-xl border border-[#E7ECF3] bg-[#F8FAFC] p-5 text-sm leading-6 text-slate-600">
    <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-mercantil-success" aria-hidden="true" />
    <p>Transmisión segura de documentos.</p>
  </div>
);
