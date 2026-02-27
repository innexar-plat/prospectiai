import { Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface SearchActionBarProps {
  onIniciarBusca: () => void;
  loading?: boolean;
  disabled?: boolean;
  estimatedCredits?: number;
  className?: string;
}

export function SearchActionBar({
  onIniciarBusca,
  loading = false,
  disabled = false,
  estimatedCredits = 1,
  className,
}: SearchActionBarProps) {
  return (
    <div
      className={cn(
        'p-8 rounded-[3rem] bg-gradient-to-r from-violet-600 to-indigo-700 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden shadow-lg border border-violet-500/20',
        className
      )}
    >
      <div
        className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div className="relative z-10 flex items-center gap-6">
        <div className="w-16 h-16 rounded-[2rem] bg-white/10 backdrop-blur flex items-center justify-center text-white shrink-0">
          <Zap size={32} className="fill-current" aria-hidden />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white mb-1">Pronto para prospectar?</h3>
          <p className="text-white/90 font-bold">
            Estimamos <span className="text-white underline decoration-2 decoration-white/30 underline-offset-4">1.5M+ empresas</span> na sua região.
          </p>
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">Custo Estimado</p>
          <p className="text-xl font-black text-white">{estimatedCredits} Crédito(s)</p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          className="min-h-[44px] h-14 px-8 text-base bg-white text-violet-600 hover:bg-white/90 border-0 font-black focus:ring-2 focus:ring-white/50"
          icon={loading ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Zap size={20} aria-hidden />}
          onClick={onIniciarBusca}
          disabled={disabled || loading}
          aria-label={loading ? 'Buscando...' : 'Iniciar Busca IA'}
        >
          {loading ? 'Buscando...' : 'Iniciar Busca IA'}
        </Button>
      </div>
    </div>
  );
}
