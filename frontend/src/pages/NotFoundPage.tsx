import { Link } from 'react-router-dom';

/**
 * Página exibida para rotas inexistentes (404).
 * Em manutenção (VITE_MAINTENANCE_MODE) o usuário vê MaintenancePage no lugar do app.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="max-w-md space-y-6">
        <h1 className="text-4xl font-black text-muted">Página não encontrada</h1>
        <p className="text-muted">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl font-semibold bg-violet-600 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
