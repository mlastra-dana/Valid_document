import { ShieldCheck } from "lucide-react";

export const SecurityNotice = () => (
  <div className="flex gap-3 rounded-md border border-mercantil-border bg-white p-4 text-sm text-mercantil-muted">
    <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-mercantil-success" aria-hidden="true" />
    <p>
      Tu documento se transmite de forma segura al servicio autorizado. El archivo no se almacena en
      este navegador ni se conserva en almacenamiento local.
    </p>
  </div>
);
