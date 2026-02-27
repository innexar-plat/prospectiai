/**
 * Export utility — converts arrays of objects to CSV or JSON and triggers download.
 */

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [headers.join(',')];

    for (const row of data) {
        const values = headers.map((h) => {
            const val = row[h];
            const str = val == null ? '' : String(val);
            // Escape quotes and wrap in quotes if contains comma/newline
            return `"${str.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${filename}.csv`);
}

export function exportToJSON(data: unknown[], filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${filename}.json`);
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Flatten a Place/Lead for CSV export */
export function flattenForExport(items: Record<string, unknown>[]): Record<string, unknown>[] {
    return items.map((item) => {
        const displayName = item.displayName as { text?: string } | undefined;
        return {
            nome: displayName?.text ?? item.name ?? '',
            endereco: item.formattedAddress ?? item.address ?? '',
            telefone: item.nationalPhoneNumber ?? item.phone ?? '',
            site: item.websiteUri ?? item.website ?? '',
            avaliacao: item.rating ?? '',
            avaliacoes: item.userRatingCount ?? item.reviewCount ?? '',
            tipo: Array.isArray(item.types) ? item.types.join('; ') : (item.primaryType ?? ''),
        };
    });
}
