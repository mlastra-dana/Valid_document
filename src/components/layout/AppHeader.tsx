export const AppHeader = () => (
  <header className="border-b border-[#E7ECF3] bg-white">
    <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
      <div className="flex items-center gap-4">
        <img
          src="/icono-mercantil.png"
          alt=""
          className="h-10 w-10 object-contain"
        />
        <p className="text-sm font-black uppercase tracking-wide text-mercantil-blue">
          Consignación de documentos
        </p>
      </div>
      <img
        src="/mercantilseguros.png"
        alt="Mercantil Seguros"
        className="h-10 w-auto max-w-[190px]"
      />
    </div>
  </header>
);
