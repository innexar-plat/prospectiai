export function AdminFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="shrink-0 border-t border-zinc-800 bg-zinc-900/60 px-4 py-3 flex items-center justify-between text-xs text-zinc-500">
      <span>Prospector.AI Admin © {year}</span>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        Ir para o app
      </a>
    </footer>
  );
}
