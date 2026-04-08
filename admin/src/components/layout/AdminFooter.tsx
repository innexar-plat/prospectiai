export function AdminFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between text-xs text-gray-500">
      <span>Precision IA Admin © {year}</span>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-gray-700 transition-colors"
      >
        Ir para o app
      </a>
    </footer>
  );
}
