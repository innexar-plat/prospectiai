import { useVersionCheck } from '@/hooks/useVersionCheck';

export function UpdateBanner() {
  const { updateAvailable, reload } = useVersionCheck();
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-violet-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-md">
      <span className="text-sm">Nova versão disponível!</span>
      <button
        type="button"
        onClick={reload}
        className="bg-white text-violet-700 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-violet-50"
      >
        Atualizar
      </button>
    </div>
  );
}
