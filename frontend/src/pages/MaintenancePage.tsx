/**
 * Página exibida quando VITE_MAINTENANCE_MODE=true.
 * Substitui todo o app (incluindo 404) durante manutenção.
 */
export default function MaintenancePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
      style={{
        backgroundColor: 'var(--theme-bg)',
        color: 'var(--theme-text)',
      }}
    >
      <div className="max-w-md space-y-6">
        <div className="text-6xl font-black tracking-tight opacity-90" style={{ color: 'var(--theme-muted)' }}>
          Em manutenção
        </div>
        <p className="text-lg" style={{ color: 'var(--theme-muted)' }}>
          Estamos melhorando a plataforma. Volte em breve.
        </p>
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          Se a manutenção se estender, entre em contato pelo suporte.
        </p>
      </div>
    </div>
  );
}
