/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GA_MEASUREMENT_ID?: string;
    readonly VITE_GA_MEASUREMENT_ID_US?: string;
    readonly VITE_GOOGLE_ADS_CONVERSION_ID?: string;
    readonly VITE_GOOGLE_ADS_CONVERSION_LABEL?: string;
    readonly VITE_GOOGLE_ADS_CONVERSION_ID_US?: string;
    readonly VITE_GOOGLE_ADS_CONVERSION_LABEL_US?: string;
    readonly VITE_MARKET?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare global {
    interface Window {
        gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
        dataLayer?: unknown[];
    }
}

export {};