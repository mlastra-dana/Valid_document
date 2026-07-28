export const AppHeader = () => (
  <header className="border-b border-mercantil-border bg-white">
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <img
        src="/mercantil-seguros-logo.svg"
        alt="Mercantil Seguros"
        className="h-10 w-auto max-w-[220px]"
      />
      <p className="text-sm font-semibold text-mercantil-navy sm:text-right">
        Consignación de documentos
      </p>
    </div>
    <div className="h-1 bg-mercantil-navy" />
  </header>
);
