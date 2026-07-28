const currentYear = new Date().getFullYear();

export const AppFooter = () => (
  <footer className="mt-auto bg-mercantil-navy text-white">
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <p className="font-semibold">Mercantil Seguros, C.A. © {currentYear}</p>
        <p className="mt-1 text-white/75">
          Este portal utiliza una conexión segura para el envío de documentos.
        </p>
      </div>
      <span className="font-medium text-mercantil-yellow">Privacidad y seguridad</span>
    </div>
  </footer>
);
