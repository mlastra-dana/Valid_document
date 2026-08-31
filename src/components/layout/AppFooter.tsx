const currentYear = new Date().getFullYear();

export const AppFooter = () => (
  <footer className="mt-auto border-t border-mercantil-border bg-white text-mercantil-text">
    <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div>
        <p className="font-semibold text-mercantil-navy">Mercantil Seguros, C.A. © {currentYear}</p>
        <p className="mt-1 text-mercantil-muted">
          Este portal utiliza una conexión segura para el envío de documentos.
        </p>
      </div>
      <span className="font-semibold text-mercantil-blue">Privacidad y seguridad</span>
    </div>
  </footer>
);
