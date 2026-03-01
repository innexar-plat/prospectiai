export function formatDate(iso: string) {
    if (!iso) return '—';
    try {
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(iso));
    } catch {
        return '—';
    }
}
