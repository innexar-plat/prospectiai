import { LogOut } from 'lucide-react';
import type { SessionUser } from '@/lib/api';
import { authApi } from '@/lib/api';

export function AdminHeader({ user }: { user: SessionUser }) {
  const handleSignOut = async () => {
    try {
      await authApi.signOut();
    } catch {
      // ignore
    }
    const origin = window.location.origin;
    window.location.href = `${origin}/auth/signin`;
  };

  return (
    <header className="h-12 shrink-0 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between px-4">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400 truncate max-w-[180px]">
          {user.email ?? user.name ?? 'Admin'}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-sm transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </header>
  );
}
