/** App version — sourced from package.json at build time via Vite's define. */
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_TIME: string = __BUILD_TIME__;

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
