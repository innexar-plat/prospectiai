import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Registers global keyboard shortcuts for dashboard navigation.
 * Shortcuts are suppressed when focus is inside form elements.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in inputs or when modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (IGNORED_TAGS.has(tag)) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          navigate('/dashboard');
          break;
        case 'h':
          e.preventDefault();
          navigate('/dashboard/historico');
          break;
        case 'l':
          e.preventDefault();
          navigate('/dashboard/leads');
          break;
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);
}
