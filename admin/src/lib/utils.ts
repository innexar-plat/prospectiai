export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

/** Route path relative to the admin BrowserRouter (no leading slash). */
export function adminPath(...segments: (string | number | undefined | null)[]): string {
    return segments
        .filter((s) => s != null && s !== '')
        .map(String)
        .join('/');
}
