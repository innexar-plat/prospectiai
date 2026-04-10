import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const RELOAD_KEY = 'eb_chunk_reload';

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk') ||
    error.message.includes('Importing a module script failed')
  );
}

/** Catches render errors and shows a fallback to avoid a blank screen.
 *  Automatically reloads once on chunk load errors (stale deploy). */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Auto-reload once on chunk load error (stale deploy)
    if (isChunkLoadError(error)) {
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      // Only auto-reload if we haven't reloaded in the last 30 seconds (avoid loops)
      if (!lastReload || now - Number(lastReload) > 30_000) {
        sessionStorage.setItem(RELOAD_KEY, String(now));
        window.location.reload();
        return;
      }
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunk = isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6" role="alert">
          <h1 className="text-xl font-bold text-foreground mb-2">
            {isChunk ? 'Nova versão disponível' : 'Algo deu errado'}
          </h1>
          <p className="text-muted mb-4 max-w-md text-center">
            {isChunk
              ? 'Uma atualização foi aplicada. Recarregue a página para continuar.'
              : 'Ocorreu um erro inesperado. Recarregue a página ou tente novamente mais tarde.'}
          </p>
          <button
            type="button"
            onClick={() => {
              if (isChunk) {
                window.location.reload();
              } else {
                this.setState({ hasError: false, error: null });
              }
            }}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500"
          >
            {isChunk ? 'Recarregar' : 'Tentar novamente'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
