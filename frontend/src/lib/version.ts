export { APP_VERSION } from './app-version';

/** Build timestamp — sourced at build time via Vite's define. */
export const BUILD_TIME: string = __BUILD_TIME__;

declare const __BUILD_TIME__: string;
